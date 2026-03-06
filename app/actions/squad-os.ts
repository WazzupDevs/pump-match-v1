"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// ──────────────────────────────────────────────────────────────
// Squad OS — Server Actions
// ──────────────────────────────────────────────────────────────

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// DB column values (CHECK constraint in squad_projects)
const DB_OPS_STATUSES = [
  "forming",
  "recruiting",
  "split_proposed",
  "signing",
  "launch_ready",
] as const;

// TS ↔ DB mapping (client sends TS values, DB stores DB values)
const TS_TO_DB_OPS: Record<string, string> = {
  forming: "forming",
  recruiting: "recruiting",
  split_configured: "split_proposed",
  ready_for_launch: "launch_ready",
  launched: "launch_ready",
  // passthrough for legacy values that are already DB-compatible
  split_proposed: "split_proposed",
  signing: "signing",
  launch_ready: "launch_ready",
};

const DB_TO_TS_OPS: Record<string, string> = {
  forming: "forming",
  recruiting: "recruiting",
  split_proposed: "split_configured",
  signing: "split_configured",
  launch_ready: "ready_for_launch",
};

/**
 * Verify that `userId` is an active Leader of `projectId`.
 * Returns the leader's squad_members row or an error result.
 */
async function verifyLeader(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  projectId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; result: ActionResult }> {
  const { data, error } = await supabase
    .from("squad_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("role", "Leader")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return { ok: false, result: { success: false, error: "Database error." } };
  }
  if (!data) {
    return {
      ok: false,
      result: { success: false, error: "Unauthorized. Only the squad leader can perform this action." },
    };
  }
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// 1. updateSquadOpsSettings
// ──────────────────────────────────────────────────────────────

type OpsSettingsInput = {
  ops_description?: string;
  ops_website?: string;
  ops_twitter?: string;
  ops_discord?: string;
};

export async function updateSquadOpsSettings(
  projectId: string,
  userId: string,
  data: OpsSettingsInput,
): Promise<ActionResult> {
  if (!projectId || !userId) {
    return { success: false, error: "Missing projectId or userId." };
  }

  const supabase = getSupabaseAdmin();

  const auth = await verifyLeader(supabase, projectId, userId);
  if (!auth.ok) return auth.result;

  const update: Record<string, string | null> = {};
  if (data.ops_description !== undefined) update.ops_description = data.ops_description || null;
  if (data.ops_website !== undefined) update.ops_website = data.ops_website || null;
  if (data.ops_twitter !== undefined) update.ops_twitter = data.ops_twitter || null;
  if (data.ops_discord !== undefined) update.ops_discord = data.ops_discord || null;

  if (Object.keys(update).length === 0) {
    return { success: false, error: "No fields to update." };
  }

  const { error } = await supabase
    .from("squad_projects")
    .update(update)
    .eq("id", projectId);

  if (error) {
    return { success: false, error: "Failed to update settings." };
  }

  revalidatePath("/command-center");
  return { success: true, data: update };
}

// ──────────────────────────────────────────────────────────────
// 2. updateSquadOpsStatus
// ──────────────────────────────────────────────────────────────

export async function updateSquadOpsStatus(
  projectId: string,
  userId: string,
  status: string,
): Promise<ActionResult> {
  if (!projectId || !userId) {
    return { success: false, error: "Missing projectId or userId." };
  }

  const dbStatus = TS_TO_DB_OPS[status];
  if (!dbStatus) {
    return {
      success: false,
      error: `Invalid status "${status}". Accepted values: ${Object.keys(TS_TO_DB_OPS).join(", ")}`,
    };
  }

  const supabase = getSupabaseAdmin();

  const auth = await verifyLeader(supabase, projectId, userId);
  if (!auth.ok) return auth.result;

  const { error } = await supabase
    .from("squad_projects")
    .update({ ops_status: dbStatus })
    .eq("id", projectId);

  if (error) {
    return { success: false, error: "Failed to update ops status." };
  }

  revalidatePath("/command-center");
  return { success: true, data: { ops_status: status } };
}

// ──────────────────────────────────────────────────────────────
// 3. upsertRoleSlots
// ──────────────────────────────────────────────────────────────

type RoleSlotInput = {
  role_type: string;
  capacity: number;
  min_trust: number | null;
};

export async function upsertRoleSlots(
  projectId: string,
  userId: string,
  slots: RoleSlotInput[],
): Promise<ActionResult> {
  if (!projectId || !userId) {
    return { success: false, error: "Missing projectId or userId." };
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    return { success: false, error: "At least one role slot is required." };
  }

  const labels = new Set<string>();
  for (const slot of slots) {
    if (!slot.role_type || slot.role_type.trim().length === 0) {
      return { success: false, error: "Each slot must have a role_type." };
    }
    if (!Number.isInteger(slot.capacity) || slot.capacity < 1) {
      return { success: false, error: `capacity must be a positive integer for role "${slot.role_type}".` };
    }
    const trust = slot.min_trust ?? 0;
    if (!Number.isInteger(trust) || trust < 0) {
      return { success: false, error: `min_trust must be a non-negative integer for role "${slot.role_type}".` };
    }
    const normalized = slot.role_type.trim().toUpperCase();
    if (labels.has(normalized)) {
      return { success: false, error: `Duplicate role_type: "${slot.role_type}".` };
    }
    labels.add(normalized);
  }

  const supabase = getSupabaseAdmin();

  const auth = await verifyLeader(supabase, projectId, userId);
  if (!auth.ok) return auth.result;

  // Delete existing slots and re-insert (atomic upsert)
  const { error: deleteError } = await supabase
    .from("squad_role_slots")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) {
    return { success: false, error: "Failed to clear existing role slots." };
  }

  const rows = slots.map((s) => ({
    project_id: projectId,
    role_label: s.role_type.trim().toUpperCase(),
    max_count: s.capacity,
    min_trust_score: s.min_trust ?? 0,
  }));

  const { data: rawSlots, error } = await supabase
    .from("squad_role_slots")
    .insert(rows)
    .select("id, role_label, max_count, min_trust_score");

  const data = (rawSlots ?? []).map((r: any) => ({
    id: r.id as string,
    role_type: r.role_label as string,
    capacity: r.max_count as number,
    min_trust: (r.min_trust_score as number) ?? null,
  }));

  if (error) {
    return { success: false, error: "Failed to insert role slots." };
  }

  revalidatePath("/command-center");
  return { success: true, data };
}

// ──────────────────────────────────────────────────────────────
// 4. createSplitProposal
// ──────────────────────────────────────────────────────────────

type SplitShareInput = {
  user_id: string;
  bps: number;
};

export async function createSplitProposal(
  projectId: string,
  userId: string,
  shares: SplitShareInput[],
): Promise<ActionResult> {
  if (!projectId || !userId) {
    return { success: false, error: "Missing projectId or userId." };
  }

  // ── BPS Validation (NON-NEGOTIABLE) ──────────────────────────
  if (!Array.isArray(shares) || shares.length < 1) {
    return { success: false, error: "At least one share is required." };
  }

  const userIds = new Set<string>();
  let totalBps = 0;

  for (const share of shares) {
    if (!share.user_id) {
      return { success: false, error: "Each share must have a user_id." };
    }
    if (!Number.isInteger(share.bps) || share.bps < 0) {
      return { success: false, error: `BPS must be a non-negative integer. Got ${share.bps} for user ${share.user_id}.` };
    }
    if (userIds.has(share.user_id)) {
      return { success: false, error: `Duplicate user_id in shares: ${share.user_id}.` };
    }
    userIds.add(share.user_id);
    totalBps += share.bps;
  }

  if (totalBps !== 10000) {
    return {
      success: false,
      error: `Total BPS must equal 10000. Got ${totalBps}.`,
    };
  }

  const supabase = getSupabaseAdmin();

  const auth = await verifyLeader(supabase, projectId, userId);
  if (!auth.ok) return auth.result;

  // Supersede any existing pending proposals for this project
  await supabase
    .from("squad_split_proposals")
    .update({ status: "superseded" })
    .eq("project_id", projectId)
    .eq("status", "pending");

  // Create the proposal
  const { data: proposal, error: proposalError } = await supabase
    .from("squad_split_proposals")
    .insert({
      project_id: projectId,
      created_by: userId,
      status: "pending",
      total_bps: 10000,
    })
    .select("id")
    .single();

  if (proposalError || !proposal) {
    return { success: false, error: "Failed to create split proposal." };
  }

  // Insert shares
  const shareRows = shares.map((s) => ({
    proposal_id: proposal.id,
    user_id: s.user_id,
    bps: s.bps,
  }));

  const { error: sharesError } = await supabase
    .from("squad_split_shares")
    .insert(shareRows);

  if (sharesError) {
    // Rollback: delete the proposal (CASCADE will clean shares if any)
    await supabase
      .from("squad_split_proposals")
      .delete()
      .eq("id", proposal.id);
    return { success: false, error: "Failed to insert split shares." };
  }

  // Update project ops_status to 'split_proposed'
  await supabase
    .from("squad_projects")
    .update({ ops_status: "split_proposed" })
    .eq("id", projectId);

  revalidatePath("/command-center");
  return { success: true, data: { proposal_id: proposal.id } };
}

// ──────────────────────────────────────────────────────────────
// 5. signSplitProposal
// ──────────────────────────────────────────────────────────────

export async function signSplitProposal(
  proposalId: string,
  userId: string,
  signature: string,
  payloadHash: string,
): Promise<ActionResult> {
  if (!proposalId || !userId || !signature || !payloadHash) {
    return { success: false, error: "Missing required fields." };
  }

  const supabase = getSupabaseAdmin();

  // Verify the proposal exists and is pending
  const { data: proposal, error: proposalError } = await supabase
    .from("squad_split_proposals")
    .select("id, project_id, status")
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    return { success: false, error: "Proposal not found." };
  }

  if (proposal.status !== "pending") {
    return { success: false, error: `Proposal is not pending. Current status: ${proposal.status}.` };
  }

  // Verify signer has a share in this proposal
  const { data: share } = await supabase
    .from("squad_split_shares")
    .select("id")
    .eq("proposal_id", proposalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!share) {
    return { success: false, error: "You are not a participant in this split proposal." };
  }

  // Insert signature (unique constraint prevents double-signing)
  const { error: sigError } = await supabase
    .from("squad_split_signatures")
    .insert({
      proposal_id: proposalId,
      signer_user_id: userId,
      signature,
      payload_hash: payloadHash,
    });

  if (sigError) {
    if (sigError.code === "23505") {
      return { success: false, error: "You have already signed this proposal." };
    }
    return { success: false, error: "Failed to record signature." };
  }

  // Check if all participants have signed
  const { count: totalShares } = await supabase
    .from("squad_split_shares")
    .select("id", { count: "exact", head: true })
    .eq("proposal_id", proposalId);

  const { count: totalSigs } = await supabase
    .from("squad_split_signatures")
    .select("id", { count: "exact", head: true })
    .eq("proposal_id", proposalId);

  const allSigned = totalShares !== null && totalSigs !== null && totalSigs >= totalShares;

  if (allSigned) {
    // All members signed — mark proposal as accepted and project as launch_ready
    await supabase
      .from("squad_split_proposals")
      .update({ status: "accepted" })
      .eq("id", proposalId);

    await supabase
      .from("squad_projects")
      .update({ ops_status: "launch_ready" })
      .eq("id", proposal.project_id);
  } else {
    // Update project ops_status to 'signing' if not already
    await supabase
      .from("squad_projects")
      .update({ ops_status: "signing" })
      .eq("id", proposal.project_id);
  }

  revalidatePath("/command-center");
  return {
    success: true,
    data: {
      signed: true,
      all_signed: allSigned,
      signatures_count: totalSigs ?? 0,
      required_count: totalShares ?? 0,
    },
  };
}

// ──────────────────────────────────────────────────────────────
// 6. getSquadOsData — fetch all Squad OS state for a project
// ──────────────────────────────────────────────────────────────

type SquadOsData = {
  opsStatus: string;
  roleSlots: { id: string; role_type: string; capacity: number; min_trust: number | null }[];
  activeProposal: {
    id: string;
    state: "draft" | "locked" | "superseded";
    shares: { user_id: string; wallet: string; bps: number }[];
  } | null;
  signedUserIds: string[];
  currentUserId: string | null;
};

export async function getSquadOsData(
  projectId: string,
  walletAddress?: string | null,
): Promise<ActionResult<SquadOsData>> {
  if (!projectId) {
    return { success: false, error: "Missing projectId." };
  }

  const supabase = getSupabaseAdmin();

  // 1. Fetch ops_status from squad_projects
  const { data: project, error: projErr } = await supabase
    .from("squad_projects")
    .select("ops_status")
    .eq("id", projectId)
    .single();

  if (projErr || !project) {
    return { success: false, error: "Project not found." };
  }

  // 2. Fetch role slots (DB cols → TS field names)
  const { data: rawSlots } = await supabase
    .from("squad_role_slots")
    .select("id, role_label, max_count, min_trust_score")
    .eq("project_id", projectId)
    .order("role_label");

  const roleSlots = (rawSlots ?? []).map((r: any) => ({
    id: r.id as string,
    role_type: r.role_label as string,
    capacity: r.max_count as number,
    min_trust: (r.min_trust_score as number | null) ?? null,
  }));

  // 3. Fetch active proposal (prefer pending/draft, then accepted/locked)
  const { data: proposals } = await supabase
    .from("squad_split_proposals")
    .select("id, status")
    .eq("project_id", projectId)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(2);

  const proposal =
    proposals?.find((p) => p.status === "pending") ??
    proposals?.find((p) => p.status === "accepted") ??
    null;

  const DB_STATUS_TO_STATE: Record<string, "draft" | "locked" | "superseded"> = {
    pending: "draft",
    accepted: "locked",
    superseded: "superseded",
  };

  let activeProposal: SquadOsData["activeProposal"] = null;
  let signedUserIds: string[] = [];

  if (proposal) {
    // Fetch shares with wallet address
    const { data: shares } = await supabase
      .from("squad_split_shares")
      .select("user_id, bps, profiles(wallet_address)")
      .eq("proposal_id", proposal.id);

    const mappedShares = (shares ?? []).map((s: any) => {
      const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      return {
        user_id: s.user_id as string,
        wallet: (p?.wallet_address ?? "Unknown") as string,
        bps: s.bps as number,
      };
    });

    activeProposal = {
      id: proposal.id,
      state: DB_STATUS_TO_STATE[proposal.status] ?? "draft",
      shares: mappedShares,
    };

    // Fetch signatures
    const { data: sigs } = await supabase
      .from("squad_split_signatures")
      .select("signer_user_id")
      .eq("proposal_id", proposal.id);

    signedUserIds = (sigs ?? []).map((s) => s.signer_user_id);
  }

  // 4. Resolve currentUserId from wallet address
  let currentUserId: string | null = null;
  if (walletAddress) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    currentUserId = profile?.id ?? null;
  }

  return {
    success: true,
    data: {
      opsStatus: DB_TO_TS_OPS[project.ops_status] ?? "forming",
      roleSlots: roleSlots ?? [],
      activeProposal,
      signedUserIds,
      currentUserId,
    },
  };
}
