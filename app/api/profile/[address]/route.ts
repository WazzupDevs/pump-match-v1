import { NextRequest, NextResponse } from "next/server";
import { analyzeWallet } from "@/app/actions/analyzeWallet";

export const runtime = "nodejs";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  const address = (rawAddress ?? "").trim();

  if (!BASE58_RE.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  try {
    const result = await analyzeWallet(address);
    const walletAnalysis = result.walletAnalysis;

    return NextResponse.json(walletAnalysis, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "analysis_failed" }, { status: 500 });
  }
}
