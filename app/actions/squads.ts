"use server";

import { revalidatePath } from "next/cache";
import { isArchitect } from "@/lib/architect";
import { ensureUserAndProfileExists } from "@/lib/db";
import type { Database } from "@/types/supabase";

/** squad_projects: schema has created_by + created_by_wallet only (no claimed_by). */
type SquadProjectInsert = Database["public"]["Tables"]["squad_projects"]["Insert"];
/** squad_members: schema has project_id, user_id (UUID), role, status only (no claimed_by). */
type SquadMemberInsert = Database["public"]["Tables"]["squad_members"]["Insert"];

// ─────────────────────────────────────────────────────────────────────────────
// Shared Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SQUAD_PLACEHOLDER_MINT = "SQUAD_NO_MINT_" as const;
const MAX_SQUAD_MEMBERS = 5;

/** Standardized server action result. */
export type ActionResult = { success: boolean; message: string; code?: string };

/** Strip `web3:solana:` prefix and validate strict base58. NO toLowerCase. */
function normalizeSolanaAddress(input: string): string {
  let addr = input.trim();
  if (addr.startsWith("web3:solana:")) addr = addr.slice("web3:solana:".length);
  if (!BASE58_REGEX.test(addr)) {
    throw new Error("Invalid Solana address");
  }
  return addr;
}

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/** Result of verifying a client-provided access token. */
type VerifiedCaller = { userId: string; walletAddress: string | null };

/**
 * Verify a client-provided access token and return the authenticated user's UUID
 * plus their Solana wallet address (extracted from auth identities).
 *
 * This project uses `@supabase/supabase-js` with localStorage persistence (no
 * @supabase/ssr, no cookies middleware). The client retrieves the access_token
 * from `supabase.auth.getSession()` and passes it to server actions explicitly.
 * The server validates it via `supabaseAdmin.auth.getUser(token)`.
 */
async function verifyAccessToken(accessToken: string | null | undefined): Promise<VerifiedCaller | null> {
  if (!accessToken || typeof accessToken !== "string" || accessToken.length < 10) {
    console.warn("[verifyAccessToken] No access token provided");
    return null;
  }

  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
    const supabaseAdmin = getSupabaseAdmin();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      console.warn("[verifyAccessToken] Token validation failed:", error?.message ?? "no user");
      return null;
    }

    console.log("[verifyAccessToken] DIAG user.id:", user.id, "isUUID:", UUID_REGEX.test(user.id));
    console.log("[verifyAccessToken] DIAG identities:", JSON.stringify(user.identities?.map(i => ({ id: i.id, provider: i.provider })) ?? []));

    // Extract wallet address from auth identities (web3:solana:<base58>)
    let walletAddress: string | null = null;
    const identities = user.identities ?? [];
    for (const identity of identities) {
      // Supabase Web3 Auth stores identity id as "web3:solana:<base58>"
      const idStr = identity.id ?? "";
      if (idStr.startsWith("web3:solana:")) {
        const addr = idStr.slice("web3:solana:".length);
        if (BASE58_REGEX.test(addr)) {
          walletAddress = addr;
          break;
        }
      }
      // Fallback: check identity_data for address field
      const idData = identity.identity_data as Record<string, unknown> | undefined;
      if (idData?.address && typeof idData.address === "string" && BASE58_REGEX.test(idData.address)) {
        walletAddress = idData.address;
        break;
      }
    }

    return { userId: user.id, walletAddress };
  } catch (err) {
    console.error("[verifyAccessToken] Unexpected error:", err);
    return null;
  }
}

type CreateSquadResult =
  | { success: true; projectId: string; message: string; code?: string }
  | { success: false; message: string; code?: string };

/**
 * Creates a new squad (squad_projects row) and adds the creator as Leader (squad_members row).
 *
 * @param name         - Squad display name (3..32 chars after trim)
 * @param accessToken  - Supabase access_token from client session
 */
export async function createSquadAction(
  name: string,
  accessToken: string,
): Promise<CreateSquadResult> {
  try {
    // ── 1. Verify caller via access token ───────────────────────────
    const caller = await verifyAccessToken(accessToken);
    if (!caller || !isValidUUID(caller.userId)) {
      return {
        success: false,
        message: "Authentication required. Please reconnect your wallet.",
        code: "UNAUTH",
      };
    }
    const callerUserId = caller.userId;

    // Lazy import — never at module top level
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
    const supabaseAdmin = getSupabaseAdmin();

    // ── 2. Validate name ───────────────────────────────────────────
    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 32) {
      return {
        success: false,
        message: "Squad name must be 3–32 characters.",
        code: "INVALID_NAME",
      };
    }

    // ── 3. Resolve caller wallet from auth identity ─────────────────
    const walletAddress = caller.walletAddress;
    if (!walletAddress) {
      return {
        success: false,
        message: "Wallet not found in auth identity. Please reconnect your wallet.",
        code: "WALLET_MISSING",
      };
    }
    // DO NOT toLowerCase — Solana base58 is case-sensitive

    // ── 4. Check duplicate active squad for this user ──────────────
    const { data: existing } = await supabaseAdmin
      .from("squad_members")
      .select("id")
      .eq("user_id", callerUserId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        message: "You are already in an active squad. Leave first.",
        code: "ALREADY_IN_SQUAD",
      };
    }

    // ── 5. Insert squad_projects ───────────────────────────────────
    // Schema: created_by, created_by_wallet only (no claimed_by). mint_address NOT NULL.
    const placeholderMint = `${SQUAD_PLACEHOLDER_MINT}${Date.now()}`;
    const projectInsert: SquadProjectInsert = {
      project_name: trimmedName,
      mint_address: placeholderMint,
      created_by: walletAddress,
      created_by_wallet: walletAddress,
      status: "active",
    };

    const { data: projectRow, error: projectError } = await supabaseAdmin
      .from("squad_projects")
      .insert(projectInsert)
      .select("id")
      .single();

    if (projectError || !projectRow) {
      console.error("[createSquadAction] squad_projects insert error:", projectError);
      return {
        success: false,
        message: "Failed to create squad. Please try again.",
        code: "PROJECT_INSERT_FAILED",
      };
    }

    const projectId = projectRow.id as string;

    // ── 6. P0 FK: ensure users + profiles exist before squad_members insert ──
    const ensured = await ensureUserAndProfileExists(
      supabaseAdmin,
      callerUserId,
      walletAddress,
    );
    if (!ensured.success) {
      await supabaseAdmin.from("squad_projects").delete().eq("id", projectId);
      return {
        success: false,
        message: ensured.message,
        code: "FK_ENSURE_FAILED",
      };
    }

    // ── 7. Insert creator as Leader into squad_members ─────────────
    // Schema: project_id, user_id (UUID), role, status only. NO claimed_by.
    console.log("[createSquadAction] DIAG insert values:", {
      projectId,
      callerUserId,
      walletAddress,
      isUUID: isValidUUID(callerUserId),
    });
    const { error: memberError } = await supabaseAdmin
      .from("squad_members")
      .insert({
        project_id: projectId,
        user_id: callerUserId,
        role: "Leader",
        status: "active",
      } satisfies SquadMemberInsert);

    if (memberError) {
      console.error("[createSquadAction] squad_members insert error:", memberError);
      // Rollback: delete the orphaned project
      await supabaseAdmin.from("squad_projects").delete().eq("id", projectId);
      return {
        success: false,
        message: "Failed to add you as squad leader. Please try again.",
        code: "MEMBER_INSERT_FAILED",
      };
    }

    revalidatePath("/command-center");
    return { success: true, message: "Squad created.", projectId };
  } catch (err) {
    console.error("[createSquadAction] unexpected error:", err);
    return {
      success: false,
      message: "An unexpected error occurred.",
      code: "INTERNAL",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Invite Agent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a squad invite. Caller identity derived from server session — no
 * leaderAddress parameter accepted (anti-spoofing).
 */
export async function inviteAgentAction(
  projectId: string,
  targetAddress: string,
  accessToken: string,
): Promise<ActionResult> {
  try {
    // ── Validate projectId ─────────────────────────────────────────
    if (!isValidUUID(projectId)) {
      return { success: false, message: "Invalid projectId.", code: "INVALID_ID" };
    }

    // ── Normalize target address ───────────────────────────────────
    let normalizedTarget: string;
    try {
      normalizedTarget = normalizeSolanaAddress(targetAddress);
    } catch {
      return { success: false, message: "Invalid target wallet address.", code: "INVALID_ADDRESS" };
    }

    // ── Auth: verify caller via access token ────────────────────────
    const caller = await verifyAccessToken(accessToken);
    if (!caller) {
      return { success: false, message: "Authentication required. Please reconnect your wallet.", code: "UNAUTH" };
    }
    const callerUserId = caller.userId;
    const callerWallet = caller.walletAddress;

    // ── Lazy load admin client ─────────────────────────────────────
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
    const supabaseAdmin = getSupabaseAdmin();

    // ── Prevent self-invite ────────────────────────────────────────
    if (callerWallet && callerWallet === normalizedTarget) {
      return { success: false, message: "You cannot invite yourself.", code: "SELF_INVITE" };
    }

    // ── Leader verification ────────────────────────────────────────
    const { data: leaderRow } = await supabaseAdmin
      .from("squad_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", callerUserId)
      .eq("role", "Leader")
      .eq("status", "active")
      .maybeSingle();

    if (!leaderRow) {
      return { success: false, message: "Only the squad leader can send invites.", code: "NOT_LEADER" };
    }

    // ── Capacity check (active + pending) ──────────────────────────
    const { count: memberCount } = await supabaseAdmin
      .from("squad_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("status", ["active", "pending_invite"]);

    if ((memberCount ?? 0) >= MAX_SQUAD_MEMBERS) {
      return { success: false, message: "Squad is full.", code: "SQUAD_FULL" };
    }

    // ── Target resolution ──────────────────────────────────────────
    const { data: targetUser } = await supabaseAdmin
      .from("users")
      .select("id, is_opted_in")
      .eq("wallet_address", normalizedTarget)
      .maybeSingle();

    if (!targetUser) {
      return { success: false, message: "Target user not found in the network.", code: "TARGET_NOT_FOUND" };
    }
    // Architect mode: bypass is_opted_in gate so admin can invite test wallets
    const callerIsArchitect = callerWallet ? isArchitect(callerWallet) : false;
    if (targetUser.is_opted_in !== true && !callerIsArchitect) {
      return { success: false, message: "Target user is not opted into the network.", code: "TARGET_NOT_OPTED_IN" };
    }

    const targetUserId = targetUser.id as string;

    // ── Duplicate prevention ───────────────────────────────────────
    // Check if target is already active in ANY squad
    const { data: activeElsewhere } = await supabaseAdmin
      .from("squad_members")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (activeElsewhere) {
      return { success: false, message: "This user is already in a squad.", code: "ALREADY_IN_SQUAD" };
    }

    // Check if target already has a pending invite in THIS squad
    const { data: pendingHere } = await supabaseAdmin
      .from("squad_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", targetUserId)
      .eq("status", "pending_invite")
      .maybeSingle();

    if (pendingHere) {
      return { success: false, message: "Already invited.", code: "ALREADY_INVITED" };
    }

    // ── P0 FK: ensure target has users + profiles before squad_members insert ──
    const ensured = await ensureUserAndProfileExists(supabaseAdmin, targetUserId, normalizedTarget);
    if (!ensured.success) {
      return { success: false, message: ensured.message, code: "FK_ENSURE_FAILED" };
    }

    // ── Insert invite ──────────────────────────────────────────────
    // Schema: project_id, user_id (UUID), role, status only. NO claimed_by.
    const { error: insertError } = await supabaseAdmin
      .from("squad_members")
      .insert({
        project_id: projectId,
        user_id: targetUserId,
        role: "Member",
        status: "pending_invite",
      } satisfies SquadMemberInsert);

    if (insertError) {
      // Unique violation (project_id, user_id)
      if (insertError.code === "23505") {
        return { success: false, message: "Already invited.", code: "ALREADY_INVITED" };
      }
      console.error("[inviteAgentAction] insert error:", insertError);
      return { success: false, message: "Failed to send invite.", code: "INSERT_FAILED" };
    }

    revalidatePath("/command-center");
    return { success: true, message: "Invite sent successfully." };
  } catch (err) {
    console.error("[inviteAgentAction] unexpected error:", err);
    return { success: false, message: "An unexpected error occurred.", code: "INTERNAL" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Respond to Invite (Accept / Reject)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accept or reject a pending squad invite. Caller identity derived from
 * server session — no userAddress parameter accepted (anti-spoofing).
 */
export async function respondToInviteAction(
  projectId: string,
  accept: boolean,
  accessToken: string,
): Promise<ActionResult> {
  try {
    // ── Validate projectId ─────────────────────────────────────────
    if (!isValidUUID(projectId)) {
      return { success: false, message: "Invalid projectId.", code: "INVALID_ID" };
    }

    // ── Auth: verify caller via access token ────────────────────────
    const caller = await verifyAccessToken(accessToken);
    if (!caller) {
      return { success: false, message: "Authentication required. Please reconnect your wallet.", code: "UNAUTH" };
    }
    const callerUserId = caller.userId;

    // ── Lazy load admin client ─────────────────────────────────────
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
    const supabaseAdmin = getSupabaseAdmin();

    // ── Verify pending invite exists ───────────────────────────────
    const { data: pendingRow } = await supabaseAdmin
      .from("squad_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", callerUserId)
      .eq("status", "pending_invite")
      .maybeSingle();

    if (!pendingRow) {
      return { success: false, message: "No pending invite found.", code: "NO_INVITE" };
    }

    if (accept) {
      // ── Ensure caller is not active in another squad ─────────────
      const { data: activeElsewhere } = await supabaseAdmin
        .from("squad_members")
        .select("id")
        .eq("user_id", callerUserId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (activeElsewhere) {
        return { success: false, message: "You are already in an active squad. Leave first.", code: "ALREADY_ACTIVE" };
      }

      // ── Capacity check: active members must be < max ─────────────
      const { count: activeCount } = await supabaseAdmin
        .from("squad_members")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "active");

      if ((activeCount ?? 0) >= MAX_SQUAD_MEMBERS) {
        return { success: false, message: "Squad is already full.", code: "SQUAD_FULL" };
      }

      // ── Accept: conditional update (status='pending' → 'active') ─
      const { error: updateError, count: updatedCount } = await supabaseAdmin
        .from("squad_members")
        .update(
          { status: "active", joined_at: new Date().toISOString() },
          { count: "exact" },
        )
        .eq("project_id", projectId)
        .eq("user_id", callerUserId)
        .eq("status", "pending_invite");

      if (updateError) {
        console.error("[respondToInviteAction] accept error:", updateError);
        return { success: false, message: "Failed to accept invite.", code: "UPDATE_FAILED" };
      }
      if (updatedCount === 0) {
        return { success: false, message: "Invite was already handled.", code: "ALREADY_HANDLED" };
      }

      revalidatePath("/command-center");
      return { success: true, message: "You have joined the squad!" };
    } else {
      // ── Reject: delete the pending row ───────────────────────────
      const { error: deleteError } = await supabaseAdmin
        .from("squad_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", callerUserId)
        .eq("status", "pending_invite");

      if (deleteError) {
        console.error("[respondToInviteAction] reject error:", deleteError);
        return { success: false, message: "Failed to reject invite.", code: "DELETE_FAILED" };
      }

      revalidatePath("/command-center");
      return { success: true, message: "Invite rejected." };
    }
  } catch (err) {
    console.error("[respondToInviteAction] unexpected error:", err);
    return { success: false, message: "An unexpected error occurred.", code: "INTERNAL" };
  }
}
