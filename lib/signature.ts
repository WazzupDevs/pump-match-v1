/**
 * Server-only cryptographic signature utilities for Pump Match.
 * Used by server actions to verify wallet ownership (Ed25519).
 *
 * Centralising here avoids duplicating the same ~60 lines across every
 * "use server" file that needs signature verification.
 */
import "server-only";

// ─── Base58 Decode ────────────────────────────────────────────────────────────

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(encoded: string): Uint8Array {
  const bytes = [0];
  for (const char of encoded) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry < 0) throw new Error("Invalid base58 character");
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of encoded) {
    if (char === "1") bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

// TypeScript requires a standalone ArrayBuffer (not ArrayBufferLike) for crypto.subtle.
// Node Buffers use a shared pool so .buffer is ArrayBufferLike — slice to get ArrayBuffer.
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

// ─── Ed25519 Signature Verification ──────────────────────────────────────────

/**
 * Verify an Ed25519 wallet signature (Solana).
 * Proves that the caller owns the private key for `walletAddress`
 * without requiring an on-chain transaction.
 */
export async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signatureBase64: string,
): Promise<boolean> {
  try {
    const { subtle } = globalThis.crypto;
    const publicKeyBytes = base58Decode(walletAddress.trim());
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signatureBase64, "base64"));

    const key = await subtle.importKey(
      "raw",
      toArrayBuffer(publicKeyBytes),
      { name: "Ed25519" },
      false,
      ["verify"],
    );

    return await subtle.verify(
      "Ed25519",
      key,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(messageBytes),
    );
  } catch {
    return false;
  }
}

// ─── Timestamp Validation ─────────────────────────────────────────────────────

/**
 * SECURITY (VULN-07): Signed message timestamp validation.
 *
 * Prevents replay attacks — a captured signature is only valid for
 * MESSAGE_MAX_AGE_MS milliseconds after it was created.
 *
 * Convention: the signed message must contain a line of the form
 *   Timestamp: <unix_ms>
 * (any amount of whitespace between "Timestamp:" and the number is accepted).
 */
export const MESSAGE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function validateMessageTimestamp(message: string): boolean {
  const match = message.match(/Timestamp:\s*(\d+)/);
  if (!match) return false;
  const ts = parseInt(match[1], 10);
  if (isNaN(ts)) return false;
  return Math.abs(Date.now() - ts) <= MESSAGE_MAX_AGE_MS;
}
