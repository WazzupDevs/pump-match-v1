import "server-only";

import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  VisibilityMode,
  WalletReceipt,
  ScoreSnapshot,
} from "@/types";

const PUBLIC_VISIBILITIES: VisibilityMode[] = ["PUBLIC", "VERIFIED_PUBLIC"];

function mapReceiptRow(row: Record<string, unknown>): WalletReceipt {
  return {
    id: row.id as string,
    shareId: row.share_id as string,
    walletAddress: row.wallet_address as string,
    snapshotId: row.snapshot_id as string,
    visibility: row.visibility as VisibilityMode,
    createdAt: row.created_at
      ? new Date(row.created_at as string).getTime()
      : Date.now(),
    expiresAt: row.expires_at
      ? new Date(row.expires_at as string).getTime()
      : undefined,
  };
}

type PublicReceiptRow = {
  share_id: string;
  wallet_address: string;
  snapshot_id: string;
  visibility: VisibilityMode;
  created_at: string | number;
  expires_at: string | number | null;
};

function toTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : Date.now();
  }
  return Date.now();
}

function mapPublicReceiptRow(row: PublicReceiptRow): WalletReceipt {
  return {
    id: row.share_id,
    shareId: row.share_id,
    walletAddress: row.wallet_address,
    snapshotId: row.snapshot_id,
    visibility: row.visibility,
    createdAt: toTimestamp(row.created_at),
    expiresAt: row.expires_at ? toTimestamp(row.expires_at) : undefined,
  };
}

function mapSnapshotRow(row: Record<string, unknown>): ScoreSnapshot {
  return {
    id: row.id as string,
    walletAddress: row.wallet_address as string,
    modelVersion: row.model_version as ScoreSnapshot["modelVersion"],
    scoreWindow: row.score_window as ScoreSnapshot["scoreWindow"],
    style: row.style as ScoreSnapshot["style"],
    quality: row.quality as ScoreSnapshot["quality"],
    risk: row.risk as ScoreSnapshot["risk"],
    confidence: row.confidence as ScoreSnapshot["confidence"],
    summary: row.summary as ScoreSnapshot["summary"],
    sampleSize: row.sample_size as number,
    computedAt:
      typeof row.computed_at === "number"
        ? (row.computed_at as number)
        : new Date(row.computed_at as string).getTime(),
  };
}

export function generateShareId(): string {
  return randomBytes(8).toString("hex");
}

export async function createReceipt(
  walletAddress: string,
  snapshotId: string,
  visibility: VisibilityMode = "PUBLIC",
): Promise<WalletReceipt | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const shareId = generateShareId();

  const { data, error } = await supabaseAdmin
    .from("wallet_receipts")
    .insert({
      share_id: shareId,
      wallet_address: walletAddress,
      snapshot_id: snapshotId,
      visibility,
    })
    .select("*")
    .single();

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[createReceipt] Supabase insert error:", error);
    return null;
  }

  return mapReceiptRow(data as Record<string, unknown>);
}

export async function getReceiptByShareId(
  shareId: string,
): Promise<{ receipt: WalletReceipt; snapshot: ScoreSnapshot } | null> {
  const supabase = supabaseServer;

  const { data: receiptRow, error } = await supabase
    .from("v_public_receipts")
    .select(
      "share_id, wallet_address, snapshot_id, visibility, created_at, expires_at",
    )
    .eq("share_id", shareId)
    .maybeSingle();

  if (error || !receiptRow) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[getReceiptByShareId] query error:", error.message);
    }
    return null;
  }

  const receipt = mapPublicReceiptRow(receiptRow as PublicReceiptRow);

  if (!PUBLIC_VISIBILITIES.includes(receipt.visibility)) {
    return null;
  }

  const { data: snapshotRow, error: snapError } = await supabase
    .from("score_snapshots")
    .select("*")
    .eq("id", receipt.snapshotId)
    .maybeSingle();

  if (snapError || !snapshotRow) {
    if (snapError) {
      // eslint-disable-next-line no-console
      console.error("[getReceiptByShareId] snapshot query error:", snapError.message);
    }
    return null;
  }

  const snapshot = mapSnapshotRow(snapshotRow as Record<string, unknown>);
  return { receipt, snapshot };
}

/**
 * Returns the latest valid public receipt for the given wallet.
 * Use for canonical redirect and share: when present, /profile/[address]
 * should redirect to /receipt/[shareId]. This is the canonical public share
 * primitive; public visibility and public receipt are related but not identical.
 */
export async function getLatestPublicReceipt(
  walletAddress: string,
): Promise<WalletReceipt | null> {
  const supabase = supabaseServer;

  const { data, error } = await supabase
    .from("v_public_receipts")
    .select(
      "share_id, wallet_address, snapshot_id, visibility, created_at, expires_at",
    )
    .eq("wallet_address", walletAddress)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[getLatestPublicReceipt] query error:", error.message);
    }
    return null;
  }

  const receipt = mapPublicReceiptRow(data as PublicReceiptRow);

  if (!PUBLIC_VISIBILITIES.includes(receipt.visibility)) {
    return null;
  }

  return receipt;
}

export async function getUserVisibility(
  walletAddress: string,
): Promise<VisibilityMode | null> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("visibility_mode")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const raw = data.visibility_mode as string | null;
  const allowed: VisibilityMode[] = [
    "GHOST",
    "CLAIMED_PRIVATE",
    "PUBLIC",
    "VERIFIED_PUBLIC",
  ];

  if (!raw || !allowed.includes(raw as VisibilityMode)) {
    return null;
  }

  return raw as VisibilityMode;
}

export async function getUserLatestSnapshotId(
  walletAddress: string,
): Promise<{ userId: string; latestSnapshotId: string | null } | null> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, latest_snapshot_id")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    userId: data.id as string,
    latestSnapshotId: (data.latest_snapshot_id as string | null) ?? null,
  };
}
