"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSquadAuth } from "@/components/providers/SquadProvider";
import { supabase } from "@/lib/supabase/client";
import { Rocket, Swords, ShieldAlert, Loader2 } from "lucide-react";

function maskWallet(address?: string | null) {
  if (!address || address.length < 10) return "Unknown";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type SquadRow = {
  id: string;
  name: string;
  ops_status: string;
  myRole: string;
};

export default function CommandCenterIndexPage() {
  const { ready, userId, walletAddress } = useSquadAuth();
  const [squads, setSquads] = useState<SquadRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<{projectId: string, projectName: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      setLoading(false);
      return;
    }

    async function fetchSquads() {
      const wallet = (walletAddress ?? "").trim();

      const founderQuery = wallet
        ? supabase.from("squad_projects").select("id, project_name, ops_status, created_by_wallet").eq("created_by_wallet", wallet)
        : Promise.resolve({ data: [] });

      const memberQuery = supabase
        .from("squad_members")
        .select("project_id, role, status, squad_projects(id, project_name, ops_status, created_by_wallet)")
        .eq("user_id", userId)
        .in("status", ["active", "pending_invite", "pending_application"]);

      const invitesQuery = supabase.from("squad_members").select("project_id, squad_projects(project_name)").eq("user_id", userId).eq("status", "pending_invite").order("joined_at", { ascending: false }).limit(10);

      const [{ data: founderProjects }, { data: memberRows }, { data: inviteRows }] = await Promise.all([founderQuery, memberQuery, invitesQuery]);

      const squadsMap = new Map<string, SquadRow>();

      for (const p of founderProjects ?? []) {
        squadsMap.set(p.id, { id: p.id, name: p.project_name ?? "Untitled", ops_status: p.ops_status ?? "forming", myRole: "Founder" });
      }

      for (const row of (memberRows ?? []) as any[]) {
        const proj = Array.isArray(row.squad_projects) ? row.squad_projects[0] : row.squad_projects;
        if (!proj?.id) continue;
        if (!squadsMap.has(proj.id)) {
          const roleLabel =
            row.status === "pending_invite" ? "Invited"
            : row.status === "pending_application" ? "Applied"
            : (row.role ?? "Member");
          squadsMap.set(proj.id, { id: proj.id, name: proj.project_name ?? "Untitled", ops_status: proj.ops_status ?? "forming", myRole: roleLabel });
        }
      }

      setSquads(Array.from(squadsMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      
      setPendingInvites(((inviteRows ?? []) as any[]).map((r) => {
        const proj = Array.isArray(r.squad_projects) ? r.squad_projects[0] : r.squad_projects;
        return { projectId: r.project_id as string, projectName: proj?.project_name ?? "Unknown Squad" };
      }));
      setLoading(false);
    }

    fetchSquads();
  }, [ready, userId, walletAddress]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h1 className="text-2xl font-black tracking-tight">Command Center</h1>
          <p className="mt-2 text-sm text-slate-400">Connect your wallet to access your squads.</p>
          <div className="mt-5 flex gap-3">
            <Link href="/" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition-colors">Go Home</Link>
            <Link href="/arena" className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800/50 transition-colors">Browse Arena</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black tracking-tight">My Squads</h1>
            <p className="mt-2 text-sm text-slate-400">
              {walletAddress ? `Wallet: ${maskWallet(walletAddress)}` : "Wallet address not available yet."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/arena" className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/15 transition-colors">
              <Swords className="h-4 w-4" /> Arena
            </Link>
          </div>
        </div>

        {pendingInvites.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <div className="text-sm font-semibold text-emerald-200">Pending Invites</div>
            <div className="mt-2 space-y-2">
              {pendingInvites.map((inv) => (
                <Link key={inv.projectId} href={`/command-center/${inv.projectId}`} className="block rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:bg-slate-900/60 transition-colors">
                  <div className="text-sm font-semibold text-slate-200">{inv.projectName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Open cockpit to accept/reject invite</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {squads.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-200">No squads yet</div>
                <p className="mt-1 text-sm text-slate-400">Browse the Arena to join a squad, or claim a project to create your own.</p>
                <div className="mt-4 flex gap-3">
                  <Link href="/arena" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition-colors">Browse Arena</Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {squads.map((s) => (
              <Link key={s.id} href={`/command-center/${s.id}`} className="block rounded-2xl border border-slate-800 bg-slate-900/30 p-4 hover:bg-slate-900/45 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-slate-100">{s.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Role: <span className="text-slate-300 font-semibold">{s.myRole}</span>
                      <span className="mx-2 text-slate-700">·</span>
                      Ops: <span className="text-emerald-300 font-semibold">{s.ops_status}</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200">
                    <Rocket className="h-4 w-4" /> Open Cockpit
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}