import "server-only";

import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
  // Short, opaque, URL-safe identifier
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
  const supabaseAdmin = getSupabaseAdmin();

  const { data: receiptRow, error } = await supabaseAdmin
    .from("wallet_receipts")
    .select("*")
    .eq("share_id", shareId)
    .maybeSingle();

  if (error || !receiptRow) {
    return null;
  }

  const receipt = mapReceiptRow(receiptRow as Record<string, unknown>);

  // Enforce visibility: only PUBLIC / VERIFIED_PUBLIC receipts are exposed
  if (!PUBLIC_VISIBILITIES.includes(receipt.visibility)) {
    return null;
  }

  const { data: snapshotRow, error: snapError } = await supabaseAdmin
    .from("score_snapshots")
    .select("*")
    .eq("id", receipt.snapshotId)
    .maybeSingle();

  if (snapError || !snapshotRow) {
    return null;
  }

  const snapshot = mapSnapshotRow(snapshotRow as Record<string, unknown>);
  return { receipt, snapshot };
}

export async function getLatestPublicReceipt(
  walletAddress: string,
): Promise<WalletReceipt | null> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("wallet_receipts")
    .select("*")
    .eq("wallet_address", walletAddress)
    .in("visibility", PUBLIC_VISIBILITIES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapReceiptRow(data as Record<string, unknown>);
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

