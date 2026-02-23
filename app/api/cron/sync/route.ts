import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { syncArenaMarketCaps } from "@/lib/arena-sync";

// ──────────────────────────────────────────────────────────────
// Vercel Cron Route — Arena Market Cap Sync
//
// Configured in vercel.json:
//   { "crons": [{ "path": "/api/cron/sync", "schedule": "*/5 * * * *" }] }
//
// Security: Validates Authorization: Bearer <CRON_SECRET>.
// Only POST requests accepted.
// ──────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // ── Auth: Verify CRON_SECRET ──
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // eslint-disable-next-line no-console
    console.error("[Cron Sync] CRON_SECRET env var is not configured.");
    return NextResponse.json(
      { success: false, error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  // SECURITY: Use constant-time comparison to prevent timing attacks.
  // String === comparison leaks secret length/value via CPU timing differences.
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader ?? "";
  const isValid =
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!isValid) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await syncArenaMarketCaps();

    return NextResponse.json(
      {
        success: result.success,
        updated: result.updated,
        processed: result.processed,
        ghosted: result.ghosted,
        skipped: result.skipped,
        message: result.success
          ? "Arena sync completed"
          : result.error || "Sync failed",
      },
      { status: result.success ? 200 : 503 },
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Arena Sync Error:", error);
    return NextResponse.json(
      {
        success: false,
        updated: 0,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// Reject non-POST methods explicitly
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed. Use POST." },
    { status: 405 },
  );
}
