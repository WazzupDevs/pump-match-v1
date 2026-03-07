"use client";

import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSquadAuth } from "@/components/providers/SquadProvider";
import { ChevronLeft, Loader2, Wallet, ShieldAlert, Rocket } from "lucide-react";
import {
  SquadCommandCenter,
  type OpsStatusValue,
  type RoleSlot,
  type ActiveProposal,
} from "@/components/SquadCommandCenter";
import { Web3LoginButton } from "@/components/auth/Web3LoginButton";
import { supabase } from "@/lib/supabase/client";

/* ──────────────────────────────────────────────────────────────
   Types (local — only what's not exported by SquadCommandCenter)
   ────────────────────────────────────────────────────────────── */

type SquadStatus =
  | "active"
  | "pending_invite"
  | "pending_application"
  | "rejected"
  | "revoked"
  | "kicked"
  | "left";

type SquadMember = {
  id: string;
  user_id?: string;
  wallet_address?: string;
  walletAddress?: string;
  role?: string;
  status: SquadStatus;
  joined_at?: string;
  joinedAt?: string;
};

const OPS_STATUS_SET = new Set<OpsStatusValue>([
  "forming",
  "recruiting",
  "split_configured",
  "ready_for_launch",
  "launched",
]);

const DB_TO_TS_OPS: Record<string, OpsStatusValue> = {
  forming: "forming",
  recruiting: "recruiting",
  split_proposed: "split_configured",
  signing: "split_configured",
  launch_ready: "ready_for_launch",
};

function toOpsStatusValue(input: unknown): OpsStatusValue {
  const v = input as string;
  if (OPS_STATUS_SET.has(v as OpsStatusValue)) return v as OpsStatusValue;
  return DB_TO_TS_OPS[v] ?? "forming";
}

const TERMINAL_STATUSES = ["kicked", "left", "rejected", "revoked"] as const;

function maskWallet(address?: string | null) {
  if (!address || address.length < 10) return "Unknown";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function CockpitInner() {
  const params = useParams();
  const projectId = typeof params.projectId === "string" ? params.projectId : "";

  const { publicKey } = useWallet();
  const adapterWallet = publicKey?.toBase58() ?? "";

  const { userId, ready, walletAddress } = useSquadAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("Squad");
  const [founderWallet, setFounderWallet] = useState("");
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [opsStatus, setOpsStatus] = useState<OpsStatusValue>("forming");
  const [roleSlots, setRoleSlots] = useState<RoleSlot[]>([]);
  const [activeProposal, setActiveProposal] = useState<ActiveProposal>(null);
  const [signedUserIds, setSignedUserIds] = useState<string[]>([]);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Founder tespiti: wallet-adapter yerine auth profile walletAddress ile (ghost desync’e dayanıklı)
  const isFounder = useMemo(() => {
    const w = (walletAddress ?? "").trim();
    const f = (founderWallet ?? "").trim();
    return w.length > 0 && f.length > 0 && w === f;
  }, [walletAddress, founderWallet]);

  const myRole = useMemo(() => {
    if (isFounder) return "Founder";
    // Önce user_id ile yakala (en sağlam)
    const byUserId =
      userId && members.find((m) => (m.user_id ?? "").trim() === userId.trim())?.role;
    if (byUserId) return byUserId;

    // Fallback: wallet compare (profiles.wallet_address)
    const w = (walletAddress ?? "").trim();
    const byWallet =
      w &&
      members.find((m) => ((m.walletAddress ?? m.wallet_address) ?? "").trim() === w)?.role;

    return byWallet ?? "Member";
  }, [isFounder, members, userId, walletAddress]);

  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      // 1) Project meta + ops status
      const { data: proj, error: projErr } = await supabase
        .from("squad_projects")
        .select("id, project_name, created_by_wallet, ops_status")
        .eq("id", projectId)
        .maybeSingle();

      if (projErr) throw projErr;
      if (!proj) {
        if (isMounted.current) setError("Squad not found or not accessible.");
        return;
      }

      // 2) Members (RLS applies). Join profiles via FK (your schema uses profiles)
      const terminalList = `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(",")})`;
      const { data: memberRows, error: mErr } = await supabase
        .from("squad_members")
        .select(
          "id, project_id, role, status, joined_at, user_id, profiles!squad_members_user_id_fkey(wallet_address, x_handle)"
        )
        .eq("project_id", projectId)
        .not("status", "in", terminalList);

      if (mErr) throw mErr;

      const mappedMembers: SquadMember[] = (memberRows ?? []).map((row: any) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const addr =
          typeof p?.wallet_address === "string" && p.wallet_address.trim().length > 0
            ? p.wallet_address.trim()
            : "Unknown";

        return {
          id: row.id as string,
          user_id: row.user_id as string | undefined,
          walletAddress: addr,
          wallet_address: addr,
          role: (row.role as string) ?? undefined,
          status: row.status as SquadStatus,
          joinedAt: (row.joined_at as string) ?? undefined,
          joined_at: (row.joined_at as string) ?? undefined,
        };
      });

      // 3) Role slots (DB cols: role_label, max_count, min_trust_score → TS: role_type, capacity, min_trust)
      const { data: slotRows, error: sErr } = await supabase
        .from("squad_role_slots")
        .select("id, role_label, max_count, min_trust_score")
        .eq("project_id", projectId);

      if (sErr) throw sErr;

      const mappedSlots: RoleSlot[] = (slotRows ?? []).map((s: any) => ({
        id: s.id as string,
        role_type: s.role_label as string,
        capacity: s.max_count as number,
        min_trust: (s.min_trust_score as number | null) ?? null,
      }));

      // 4) Active proposal (DB col: status → TS: state; pending→draft, accepted→locked)
      const { data: proposalRows, error: pErr } = await supabase
        .from("squad_split_proposals")
        .select("id, status, created_at")
        .eq("project_id", projectId)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (pErr) throw pErr;

      const DB_TO_STATE: Record<string, "draft" | "locked" | "superseded"> = {
        pending: "draft",
        accepted: "locked",
        superseded: "superseded",
      };

      const rawProposals = (proposalRows ?? []) as any[];
      const picked = rawProposals.find((p) => p.status === "pending") ?? rawProposals[0] ?? null;

      let proposal: ActiveProposal = null;
      if (picked) {
        const { data: shareRows } = await supabase
          .from("squad_split_shares")
          .select("user_id, bps, profiles(wallet_address)")
          .eq("proposal_id", picked.id);

        const shares = (shareRows ?? []).map((s: any) => {
          const prof = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
          return {
            user_id: s.user_id as string,
            wallet: (prof?.wallet_address ?? "Unknown") as string,
            bps: s.bps as number,
          };
        });

        proposal = {
          id: picked.id as string,
          state: DB_TO_STATE[picked.status] ?? "draft",
          shares,
        };
      }

      // 5) Signatures for proposal
      let signed: string[] = [];
      if (proposal?.id) {
        const { data: sigRows, error: sigErr } = await supabase
          .from("squad_split_signatures")
          .select("signer_user_id")
          .eq("proposal_id", proposal.id);

        if (sigErr) throw sigErr;
        signed = (sigRows ?? []).map((r: any) => r.signer_user_id as string).filter(Boolean);
      }

      if (!isMounted.current) return;

      setProjectName(proj.project_name ?? "Squad");
      setFounderWallet((proj.created_by_wallet ?? "").trim());
      setOpsStatus(toOpsStatusValue(proj.ops_status));
      setMembers(mappedMembers);
      setRoleSlots(mappedSlots);
      setActiveProposal(proposal);
      setSignedUserIds(signed);
    } catch (e: any) {
      console.error("[Cockpit] fetchAll error:", e);
      if (!isMounted.current) return;
      setError(e?.message ?? "Failed to load squad data.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (ready && userId && projectId) void fetchAll();
  }, [ready, userId, projectId, fetchAll]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center p-8 max-w-sm">
          <div className="mb-6 inline-flex p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <Wallet className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Wallet Required</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Connect your wallet to access the Squad Cockpit.
          </p>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors inline-block"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -left-32 h-[500px] w-[500px] rounded-full bg-emerald-500/4 blur-[100px]" />
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-cyan-500/4 blur-[100px]" />
        <div className="absolute bottom-1/3 left-1/4 h-72 w-72 rounded-full bg-violet-500/4 blur-[100px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <Link
              href="/command-center"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to Command Center
            </Link>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              <Rocket className="inline-block h-6 w-6 text-emerald-400 mr-2 -mt-1" />
              <span className="bg-linear-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                {projectName}
              </span>
            </h1>

            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="font-mono text-slate-500">{maskWallet(walletAddress)}</span>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded uppercase tracking-wider text-[10px] font-bold">
                {myRole}
              </span>

              {/* Wallet adapter status hint (signing requires adapter) */}
              {!adapterWallet && (
                <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  Wallet adapter disconnected
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Web3LoginButton size="default" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-950/20 border border-red-800/30 rounded-2xl text-red-400 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
              <ShieldAlert className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Signature Verification Required
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Actions require a wallet signature to confirm your identity.
                  Verified by the protocol.
                </p>
              </div>
            </div>

            <SquadCommandCenter
              projectId={projectId}
              isFounder={isFounder}
              // UI identity should be profile wallet (stable); signing still uses wallet-adapter internally
              currentUserWallet={(walletAddress ?? "").trim()}
              members={members}
              onRefresh={() => void fetchAll()}
              opsStatus={opsStatus}
              roleSlots={roleSlots}
              activeProposal={activeProposal}
              signedUserIds={signedUserIds}
              currentUserId={userId}
            />
          </div>
        )}

        <p className="text-center text-xs text-slate-800 pt-2">
          PumpMatch · Season 1 · Powered by Solana
        </p>
      </div>
    </div>
  );
}

export default function SquadCockpitPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
        </div>
      }
    >
      <CockpitInner />
    </Suspense>
  );
}