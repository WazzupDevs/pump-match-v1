"use client";

import { Navbar } from "@/components/ui/navbar";
import { ArenaLeaderboard } from "@/components/ArenaLeaderboard";
import { useSquadAuth } from "@/components/providers/SquadProvider";
import { Web3LoginButton } from "@/components/auth/Web3LoginButton";

export default function ArenaPage() {
  const { walletAddress } = useSquadAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans overflow-x-hidden">
      <Navbar>
        <Web3LoginButton size="default" />
      </Navbar>

      {/* Ambient background glows for the Arena */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 right-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <main id="main-content" className="relative pt-6 pb-20">
        <ArenaLeaderboard
          walletAddress={walletAddress ?? undefined}
          isOptedIn={true}
        />
      </main>
    </div>
  );
}
