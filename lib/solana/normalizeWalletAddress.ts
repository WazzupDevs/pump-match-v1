import { PublicKey } from "@solana/web3.js";

export type NormalizeResult =
  | { ok: true; address: string }
  | { ok: false };

/**
 * Normalize and validate a Solana wallet address.
 * Strips "web3:solana:" prefix, trims whitespace, and validates
 * via PublicKey constructor (canonical base58 check).
 * Returns the normalized base58 string or { ok: false }.
 */
export function normalizeWalletAddress(input: string): NormalizeResult {
  try {
    let value = (input ?? "").trim();
    if (value.startsWith("web3:solana:")) {
      value = value.slice("web3:solana:".length);
    }
    if (!value) return { ok: false };

    // PublicKey constructor validates base58 and byte length (32 bytes)
    const pubkey = new PublicKey(value);
    return { ok: true, address: pubkey.toBase58() };
  } catch {
    return { ok: false };
  }
}
