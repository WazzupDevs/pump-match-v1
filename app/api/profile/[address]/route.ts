import { getPublicProfileByWallet } from "@/lib/public-intelligence";
import { NextResponse } from "next/server";
export const runtime = "nodejs";

/**
 * Staged public lookup by wallet address. This is NOT the canonical share
 * endpoint—canonical public share is GET /receipt/[shareId]. Use this API
 * only for fallback profile reads when no receipt exists or for legacy clients.
 */
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;

  try {
    console.log("[api/profile] address:", rawAddress);
    const result = await getPublicProfileByWallet(rawAddress);

    if (!result.ok) {
      console.log("[api/profile] failed — code:", result.code);
      switch (result.code) {
        case "invalid_address":
          return NextResponse.json(
            { error: "invalid_address" },
            { status: 400 },
          );
        case "not_public":
          return NextResponse.json({ error: "not_public" }, { status: 403 });
        case "snapshot_unavailable":
          return NextResponse.json(
            { error: "snapshot_unavailable" },
            { status: 404, headers: CACHE_HEADERS },
          );
        case "not_found":
          return NextResponse.json(
            { error: "not_found" },
            { status: 404, headers: CACHE_HEADERS },
          );
        default:
          return NextResponse.json(
            { error: "profile_lookup_failed" },
            { status: 500 },
          );
      }
    }

    return NextResponse.json(result.profile, {
      status: 200,
      headers: CACHE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { error: "profile_lookup_failed" },
      { status: 500 },
    );
  }
}