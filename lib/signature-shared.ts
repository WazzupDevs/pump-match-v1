/**
 * Client-safe canonical message generators for PumpMatch.
 * Shared between client components and server actions.
 * DO NOT import "server-only" here.
 */

// ─── Types ───

export type PumpMatchPayload = {
  action: string;
  chain: string;
  domain: string;
  env: string;
  nonce: string;
  project: string;
  role: string;
  target: string;
  timestamp: number;
  v: number;
};

export type SquadTransitionPayloadV2 = {
  v: number;
  domain: string;
  chain: string;
  projectId: string;
  actorWallet: string;
  targetWallet: string;
  actionType: string;
  nonce: string;
  timestamp: number;
};

// ─── Canonicalization ───

type Scalar = string | number | boolean | null;

function canonicalize(input: Record<string, Scalar>): Uint8Array {
  const keys = Object.keys(input).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const out: Record<string, Scalar> = {};
  for (const k of keys) {
    const v = input[k];
    if (typeof v === "object" && v !== null) {
      throw new Error("Nested objects are not allowed in canonical JSON.");
    }
    out[k] = v;
  }
  return new TextEncoder().encode(JSON.stringify(out));
}

export function generateCanonicalMessageV1(payload: PumpMatchPayload): Uint8Array {
  return canonicalize(payload as unknown as Record<string, Scalar>);
}

export function generateCanonicalMessageV2(payload: SquadTransitionPayloadV2): Uint8Array {
  return canonicalize(payload as unknown as Record<string, Scalar>);
}
