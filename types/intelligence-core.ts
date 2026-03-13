import type { BadgeId, PumpStats, ScoreBreakdown, VenueOverlay } from "@/types";

/** Stage 1 output: raw on-chain data collected from Helius APIs */
export type OnchainCore = {
  solBalance: number;
  transactionCount: number;
  fungibleTokens: number;
  totalNfts: number;
  totalAssets: number;
  tokenDiversity: number;
  activityCount: number;
  pumpStats: PumpStats | null;
  approxWalletAgeDays: number | null;
  portfolioValueUsd: number | undefined;
  scoreBreakdown: ScoreBreakdown;
  badges: BadgeId[];
  /** Median hold time across ALL token trades (not just pump.fun). Null if no closed positions observed. */
  generalMedianHoldTimeSeconds: number | null;
  /** Number of closed positions across ALL token trades (not just pump.fun). Null if simulation yielded zero. */
  generalClosedPositions: number | null;
  /** Unique token mints touched (entry or exit) across ALL trades. Null if no token activity observed. */
  generalUniqueMintsTraded: number | null;
  /** Unique token mints with at least one fully observed exit cycle across ALL trades. Null if no closed cycles.
   *  Semantically stronger than generalClosedPositions for breadth signals: repeated cycles on the same
   *  mint count once, and airdrop-only mints that were never exited are excluded entirely. */
  generalExitedUniqueMintsTraded: number | null;
  /** Mints where the wallet re-entered after a full exit. Null if no closed positions. */
  generalReEntryCount: number | null;
  /** Positions closed in < 1 hour across ALL token trades. Null if no closed positions. */
  generalFastCloseCount: number | null;
  /** Directional (non-LP, non-pool-mechanics) transactions from the lifecycle scan. Null if no tx data. */
  generalDirectionalTxCount: number | null;
  /** Up to 5 unique fungible token mints for market data enrichment */
  fungibleMints: string[];
  /** Venue/protocol execution overlay derived from Enhanced Transaction source tags. Null if no token activity. */
  venueOverlay: VenueOverlay | null;
};
