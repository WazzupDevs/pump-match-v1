import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { getReceiptByShareId, getLatestPublicReceipt } from "@/lib/receipts";
import type {
  BadgeId,
  ConfidenceTier,
  PublicProfileDTO,
  PublicProfileLookupResult,
  PublicReceiptSurfaceDTO,
  ScoreSnapshot,
  VisibilityMode,
  WalletReceipt,
} from "@/types";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type LatestIntelligenceRow =
  Database["public"]["Views"]["v_wallet_latest_intelligence"]["Row"];

type UserCompatibilityRow = {
  trust_score: number | null;
  active_badges: BadgeId[] | null;
};

export function normalizePublicWalletAddress(input: string): string {
  let value = (input ?? "").trim();
  if (value.startsWith("web3:solana:")) {
    value = value.slice("web3:solana:".length);
  }
  return value;
}

export function isValidPublicWalletAddress(input: string): boolean {
  return BASE58_RE.test(input);
}

function isPublicVisibility(
  value: VisibilityMode | null | undefined,
): value is "PUBLIC" | "VERIFIED_PUBLIC" {
  return value === "PUBLIC" || value === "VERIFIED_PUBLIC";
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asTier(value: unknown): ConfidenceTier {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW"
    ? (value as ConfidenceTier)
    : "LOW";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function mapSnapshotAxes(row: LatestIntelligenceRow) {
  return {
    styleScores: row.style
      ? {
          sniper: asNumber((row.style as Record<string, unknown>).sniper),
          scalper: asNumber((row.style as Record<string, unknown>).scalper),
          swing: asNumber((row.style as Record<string, unknown>).swing),
          conviction: asNumber((row.style as Record<string, unknown>).conviction),
        }
      : null,
    qualityScores: row.quality
      ? {
          consistency: asNumber(
            (row.quality as Record<string, unknown>).consistency,
          ),
          pnlQuality: asNumber(
            (row.quality as Record<string, unknown>).pnlQuality,
          ),
          longevity: asNumber(
            (row.quality as Record<string, unknown>).longevity,
          ),
          overall: asNumber((row.quality as Record<string, unknown>).overall),
        }
      : null,
    riskScores: row.risk
      ? {
          churn: asNumber((row.risk as Record<string, unknown>).churn),
          rugExposure: asNumber(
            (row.risk as Record<string, unknown>).rugExposure,
          ),
          suspiciousness: asNumber(
            (row.risk as Record<string, unknown>).suspiciousness,
          ),
        }
      : null,
    intelligenceConfidence: row.confidence
      ? {
          overall: asNumber(
            (row.confidence as Record<string, unknown>).overall,
          ),
          tier: asTier((row.confidence as Record<string, unknown>).tier),
          sampleSize:
            typeof row.sample_size === "number"
              ? row.sample_size
              : asNumber(
                  (row.confidence as Record<string, unknown>).sampleSize,
                ),
        }
      : null,
    intelligenceSummary: row.summary
      ? {
          primaryStyle: asString(
            (row.summary as Record<string, unknown>).primaryStyle,
            "Unknown",
          ),
          scoreLabel: asString(
            (row.summary as Record<string, unknown>).scoreLabel,
            "Visible intelligence surface",
          ),
          summary: asString(
            (row.summary as Record<string, unknown>).summary,
            "No public intelligence summary available.",
          ),
        }
      : null,
  };
}

function mapLatestIntelligenceRowToPublicProfileDTO(
  row: LatestIntelligenceRow,
  user: UserCompatibilityRow | null,
): PublicProfileDTO {
  const axes = mapSnapshotAxes(row);

  // Canonical: styleScores, qualityScores, riskScores, intelligenceConfidence, intelligenceSummary.
  // Compatibility (outward): trustScore, top-level scoreLabel, badges — kept for existing consumers.
  return {
    address: row.wallet_address,
    visibilityMode: (row.visibility_mode ?? "GHOST") as VisibilityMode,
    trustScore: typeof user?.trust_score === "number" ? user.trust_score : 0,
    scoreLabel:
      axes.intelligenceSummary?.scoreLabel ?? "Visible intelligence surface",
    badges: asStringArray(user?.active_badges),

    solBalance: null,
    tokenCount: null,
    nftCount: null,
    assetCount: null,
    transactionCount: null,
    tokenDiversity: null,
    approxWalletAge: null,
    portfolioValueUsd: null,
    behavioral: null,
    pumpStats: null,

    styleScores: axes.styleScores,
    qualityScores: axes.qualityScores,
    riskScores: axes.riskScores,
    intelligenceConfidence: axes.intelligenceConfidence,
    intelligenceSummary: axes.intelligenceSummary,

    latestSnapshotId: row.latest_snapshot_id ?? null,
    receiptShareId: null,
  };
}

function mapReceiptSurface(
  receipt: WalletReceipt,
  snapshot: ScoreSnapshot,
): PublicReceiptSurfaceDTO {
  return {
    shareId: receipt.shareId,
    walletAddress: receipt.walletAddress,
    visibility: receipt.visibility as "PUBLIC" | "VERIFIED_PUBLIC",
    createdAt: receipt.createdAt,
    expiresAt: receipt.expiresAt,
    snapshotId: receipt.snapshotId,
    trustScore: snapshot.quality.overall,
    badges: [],
    behavioral: null,
    intelligenceSummary: {
      primaryStyle: snapshot.summary.primaryStyle,
      scoreLabel: snapshot.summary.scoreLabel,
      summary: snapshot.summary.summary,
    },
    intelligenceConfidence: {
      overall: snapshot.confidence.overall,
      tier: snapshot.confidence.tier,
      sampleSize: snapshot.confidence.sampleSize,
    },
  };
}

/**
 * Staged public fallback read model: returns public profile by wallet address.
 * This is NOT the canonical public share artifact. The canonical share is
 * /receipt/[shareId]; when receiptShareId is set, prefer redirecting to
 * that route. Public visibility (user opted in) and having a published
 * receipt are related but not identical—receipt is consent-first share.
 */
export async function getPublicProfileByWallet(
  input: string,
): Promise<PublicProfileLookupResult> {
  const address = normalizePublicWalletAddress(input);

  if (!isValidPublicWalletAddress(address)) {
    return { ok: false, code: "invalid_address" };
  }

  const { data: row, error } = await supabaseServer
    .from("v_wallet_latest_intelligence")
    .select(`
      user_id, wallet_address, visibility_mode, latest_snapshot_id,
      style, quality, risk, confidence, summary, sample_size, computed_at
    `)
    .eq("wallet_address", address)
    .maybeSingle();

  if (error || !row) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[getPublicProfileByWallet] query error:", error.message);
    }
    return { ok: false, code: "not_found" };
  }

  const typedRow = row as LatestIntelligenceRow;

  if (!isPublicVisibility(typedRow.visibility_mode)) {
    return { ok: false, code: "not_public" };
  }

  if (
    !typedRow.latest_snapshot_id ||
    !typedRow.summary ||
    !typedRow.confidence
  ) {
    return { ok: false, code: "snapshot_unavailable" };
  }

  const { data: userRow } = await supabaseServer
    .from("users")
    .select("trust_score, active_badges")
    .eq("wallet_address", address)
    .maybeSingle();

  const profile = mapLatestIntelligenceRowToPublicProfileDTO(
    typedRow,
    ((userRow as UserCompatibilityRow | null) ?? null) as UserCompatibilityRow | null,
  );

  const latestReceipt = await getLatestPublicReceipt(address);
  if (latestReceipt) {
    profile.receiptShareId = latestReceipt.shareId;
  }

  return { ok: true, profile };
}

export async function getPublicReceiptSurface(
  shareId: string,
): Promise<PublicReceiptSurfaceDTO | null> {
  const result = await getReceiptByShareId(shareId);
  if (!result) return null;

  const { receipt, snapshot } = result;

  if (!isPublicVisibility(receipt.visibility)) {
    return null;
  }

  return mapReceiptSurface(receipt, snapshot);
}
