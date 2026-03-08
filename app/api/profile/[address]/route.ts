import { NextRequest, NextResponse } from "next/server";
import { analyzeWallet } from "@/app/actions/analyzeWallet";

export const runtime = "nodejs";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function normalizeAddress(input: string): string {
  let value = (input ?? "").trim();

  if (value.startsWith("web3:solana:")) {
    value = value.slice("web3:solana:".length);
  }

  return value;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;
  const address = normalizeAddress(rawAddress);

  if (!BASE58_RE.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  try {
    const result = await analyzeWallet(address);
    const walletAnalysis = result?.walletAnalysis;

    if (!walletAnalysis) {
      return NextResponse.json({ error: "analysis_failed" }, { status: 500 });
    }

    const publicResponse = {
      address,
      trustScore: walletAnalysis.trustScore ?? 0,
      scoreLabel: walletAnalysis.scoreLabel ?? "Visible reputation surface",
      badges: Array.isArray(walletAnalysis.badges)
        ? walletAnalysis.badges
        : [],
      solBalance: walletAnalysis.solBalance ?? 0,
      tokenCount: walletAnalysis.tokenCount ?? 0,
      nftCount: walletAnalysis.nftCount ?? 0,
      assetCount: walletAnalysis.assetCount ?? 0,
      transactionCount: walletAnalysis.transactionCount ?? 0,
      tokenDiversity: walletAnalysis.tokenDiversity ?? 0,
      approxWalletAge: walletAnalysis.approxWalletAge ?? 0,
      portfolioValueUsd: walletAnalysis.portfolioValueUsd ?? 0,
      behavioral: walletAnalysis.behavioral
        ? {
            jeetIndex: walletAnalysis.behavioral.jeetIndex ?? 0,
            rugExposureIndex: walletAnalysis.behavioral.rugExposureIndex ?? 0,
            avgHoldingTimeSec:
              walletAnalysis.behavioral.avgHoldingTimeSec ?? 0,
            tradeFreqScore: walletAnalysis.behavioral.tradeFreqScore ?? 0,
            confidenceLabel:
              walletAnalysis.behavioral.confidenceLabel ?? "LOW",
          }
        : null,
      pumpStats: walletAnalysis.pumpStats
        ? {
            pumpMintsTouched:
              walletAnalysis.pumpStats.pumpMintsTouched ?? 0,
            closedPositions: walletAnalysis.pumpStats.closedPositions ?? 0,
            medianHoldTimeSeconds:
              walletAnalysis.pumpStats.medianHoldTimeSeconds ?? 0,
            jeetScore: walletAnalysis.pumpStats.jeetScore ?? 0,
            rugMagnetScore:
              walletAnalysis.pumpStats.rugMagnetScore ?? 0,
            confidence: walletAnalysis.pumpStats.confidence ?? "LOW",
          }
        : null,
    };

    return NextResponse.json(publicResponse, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json({ error: "analysis_failed" }, { status: 500 });
  }
}