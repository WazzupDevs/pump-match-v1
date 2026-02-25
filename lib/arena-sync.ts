import "server-only";

import { supabaseAdmin as supabase } from "@/lib/supabase";
import type { ArenaProjectStatus, DexScreenerPair } from "@/types";

// ──────────────────────────────────────────────────────────────
// Arena Financial Snapshot Engine — Market Cap Sync Worker
//
// Architecture:
//   1. Atomic distributed lock via Supabase RPC (acquire_lock / release_lock)
//   2. Frequency guard: skip projects updated < 2 minutes ago
//   3. DexScreener batch fetch in chunks of 30 (API limit)
//   4. Smart metric selection: marketCap vs fdv based on liquidity depth
//   5. Zero Tolerance: never overwrite with 0/null — preserve last_valid_mc
//   6. Zombie Protocol: auto-ghost tokens with dead liquidity + volume
// ──────────────────────────────────────────────────────────────

const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";
const CHUNK_SIZE = 30;
const CHUNK_DELAY_MS = 200;
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const ZOMBIE_LIQUIDITY_THRESHOLD = 1000;
const ZOMBIE_VOLUME_THRESHOLD = 100;
const HIGH_LIQUIDITY_THRESHOLD = 5000;

type ProjectRow = {
  id: string;
  project_name: string;
  mint_address: string;
  status: string;
  market_cap: number | null;
  liquidity_usd: number | null;
  volume_24h: number | null;
  last_valid_mc: number | null;
  last_mc_update: string | null;
};

type ProjectUpdate = {
  id: string;
  market_cap: number | null;
  liquidity_usd: number | null;
  volume_24h: number | null;
  last_valid_mc: number | null;
  last_mc_update: string;
  status: ArenaProjectStatus;
};

type DexScreenerResponse = {
  pairs?: DexScreenerPair[];
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch token pairs from DexScreener for a batch of mint addresses.
 * Returns the raw pairs array or empty on failure.
 */
async function fetchDexScreenerChunk(
  mintAddresses: string[],
): Promise<DexScreenerPair[]> {
  const joined = mintAddresses.join(",");
  try {
    const response = await fetch(`${DEXSCREENER_BASE}/${joined}`);
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(
        `[Arena Sync] DexScreener HTTP ${response.status} for chunk`,
      );
      return [];
    }
    const data = (await response.json()) as DexScreenerResponse;
    return data.pairs ?? [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[Arena Sync] DexScreener fetch exception:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

/**
 * For a given mint address, find the best pair from DexScreener results.
 * Logic: filter pairs by baseToken.address, sort by liquidity.usd DESC, take top.
 */
function findBestPair(
  pairs: DexScreenerPair[],
  mintAddress: string,
): DexScreenerPair | null {
  const mintLower = mintAddress.toLowerCase();
  const matching = pairs.filter(
    (p) => p.baseToken.address.toLowerCase() === mintLower,
  );

  if (matching.length === 0) return null;

  matching.sort(
    (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
  );

  return matching[0];
}

/**
 * Main sync worker. Call this from a cron job, API route, or edge function.
 *
 * Returns a summary object with counts for logging/monitoring.
 */
export async function syncArenaMarketCaps(): Promise<{
  success: boolean;
  processed: number;
  updated: number;
  ghosted: number;
  skipped: number;
  error?: string;
}> {
  // ── 1. Atomic Lock ──
  const { data: lockAcquired, error: lockError } = await supabase.rpc(
    "acquire_lock",
    { p_key: "arena_sync", p_worker_id: "worker_1" },
  );

  if (lockError) {
    // eslint-disable-next-line no-console
    console.error("[Arena Sync] Lock RPC error:", lockError);
    return {
      success: false,
      processed: 0,
      updated: 0,
      ghosted: 0,
      skipped: 0,
      error: "Lock acquisition failed",
    };
  }

  if (lockAcquired === false) {
    // eslint-disable-next-line no-console
    console.log("[Arena Sync] Lock not acquired — sync already in progress.");
    return {
      success: false,
      processed: 0,
      updated: 0,
      ghosted: 0,
      skipped: 0,
      error: "Sync already in progress",
    };
  }

  let processed = 0;
  let updated = 0;
  let ghosted = 0;
  let skipped = 0;

  try {
    // ── 2. Fetch all projects ──
    const { data: projects, error: fetchError } = await supabase
      .from("squad_projects")
      .select(
        "id, project_name, mint_address, status, market_cap, liquidity_usd, volume_24h, last_valid_mc, last_mc_update",
      );

    if (fetchError || !projects) {
      // eslint-disable-next-line no-console
      console.error("[Arena Sync] Failed to fetch projects:", fetchError);
      return {
        success: false,
        processed: 0,
        updated: 0,
        ghosted: 0,
        skipped: 0,
        error: "Failed to fetch projects",
      };
    }

    const allProjects = projects as ProjectRow[];

    // ── Frequency Guard: filter stale projects only ──
    const now = Date.now();
    const staleProjects = allProjects.filter((p) => {
      if (!p.last_mc_update) return true; // Never updated
      const lastUpdate = new Date(p.last_mc_update).getTime();
      return now - lastUpdate >= STALE_THRESHOLD_MS;
    });

    if (staleProjects.length === 0) {
      // eslint-disable-next-line no-console
      console.log("[Arena Sync] All projects are fresh. Nothing to sync.");
      return { success: true, processed: 0, updated: 0, ghosted: 0, skipped: 0 };
    }

    // ── 3. Chunk processing ──
    const mintAddresses = staleProjects.map((p) => p.mint_address);

    for (let i = 0; i < mintAddresses.length; i += CHUNK_SIZE) {
      const chunkMints = mintAddresses.slice(i, i + CHUNK_SIZE);
      const chunkProjects = staleProjects.slice(i, i + CHUNK_SIZE);

      // Inter-chunk delay (skip on first chunk)
      if (i > 0) {
        await delay(CHUNK_DELAY_MS);
      }

      // ── 4. DexScreener Fetch ──
      const pairs = await fetchDexScreenerChunk(chunkMints);

      const updates: ProjectUpdate[] = [];

      for (const project of chunkProjects) {
        processed++;

        const bestPair = findBestPair(pairs, project.mint_address);

        if (!bestPair) {
          // No data from DexScreener — skip, preserve existing values
          skipped++;
          continue;
        }

        const liquidityUsd = bestPair.liquidity?.usd ?? 0;
        const volume24h = bestPair.volume?.h24 ?? 0;
        const rawMarketCap = bestPair.marketCap ?? 0;
        const rawFdv = bestPair.fdv ?? 0;

        // ── Smart Metric Selection ──
        // High liquidity → use circulating marketCap (more accurate)
        // Low liquidity → use FDV (circulating MC unreliable with thin pools)
        const selectedMc =
          liquidityUsd > HIGH_LIQUIDITY_THRESHOLD ? rawMarketCap : rawFdv;

        // ── Zero Tolerance: never overwrite with 0 ──
        if (selectedMc <= 0) {
          skipped++;
          continue;
        }

        // ── Zombie Protocol ──
        let newStatus: ArenaProjectStatus = project.status as ArenaProjectStatus;
        if (
          liquidityUsd < ZOMBIE_LIQUIDITY_THRESHOLD &&
          volume24h < ZOMBIE_VOLUME_THRESHOLD
        ) {
          newStatus = "ghost";
          ghosted++;
        } else if (newStatus === "ghost") {
          // Resurrect if metrics recovered
          newStatus = "active";
        }

        updates.push({
          id: project.id,
          market_cap: rawMarketCap > 0 ? rawMarketCap : null,
          liquidity_usd: liquidityUsd > 0 ? liquidityUsd : null,
          volume_24h: volume24h > 0 ? volume24h : null,
          last_valid_mc: selectedMc,
          last_mc_update: new Date().toISOString(),
          status: newStatus,
        });
      }

      // ── 5. Bulk Commit (per chunk) ──
      if (updates.length > 0) {
        // Supabase upsert with id as conflict key
        const { error: upsertError } = await supabase
          .from("squad_projects")
          .upsert(updates, { onConflict: "id" });

        if (upsertError) {
          // eslint-disable-next-line no-console
          console.error(
            "[Arena Sync] Bulk upsert error for chunk:",
            upsertError,
          );
        } else {
          updated += updates.length;
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[Arena Sync] Complete: ${processed} processed, ${updated} updated, ${ghosted} ghosted, ${skipped} skipped`,
    );

    return { success: true, processed, updated, ghosted, skipped };
  } finally {
    // ── Release Lock (always, even on error) ──
    const { error: releaseError } = await supabase.rpc("release_lock", {
      p_key: "arena_sync",
      p_worker_id: "worker_1",
    });
    if (releaseError) {
      // eslint-disable-next-line no-console
      console.error("[Arena Sync] Failed to release lock:", releaseError);
    }
  }
}
