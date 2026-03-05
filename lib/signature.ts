/**
 * Server-only cryptographic signature utilities for Pump Match.
 * Includes V1.5 Canonical JSON Engine + Legacy Plaintext Handlers
 */
import "server-only";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";

// ─── 1. BASE58 DECODE & UTILS ───
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

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

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

// ─── 2. LEGACY SYSTEM (AnalyzeWallet ve Eski Sync işlemleri için) ───
export const MESSAGE_MAX_AGE_MS = 5 * 60 * 1000;

export function validateMessageTimestamp(message: string, maxAgeMs: number = 300000): boolean {
  const match = message.match(/Timestamp:\s*(\d+)/);
  if (!match) return false;
  const timestamp = parseInt(match[1], 10);
  const now = Date.now();
  return !isNaN(timestamp) && (now - timestamp) <= maxAgeMs && timestamp <= now + 30000;
}

// lib/signature.ts

export async function verifyLegacySignature(
  address: string,
  message: string | Uint8Array, // 🔥 ARTIK DOĞRUDAN BYTES KABUL EDİYOR
  signatureBase58: string,
): Promise<boolean> {
  try {
    if (typeof signatureBase58 !== "string" || signatureBase58.length < 80 || signatureBase58.length > 120) {
      return false;
    }

    let messageBytes: Uint8Array;
    
    // Geriye dönük uyumluluk (V1 Endorsement için)
    if (typeof message === "string") {
      if (message.length === 0 || message.length > 500) return false;
      messageBytes = new TextEncoder().encode(message);
    } else {
      // V2 Governance ve Byte-Native işlemler için doğrudan kabul et
      if (message.length === 0 || message.length > 1024) return false;
      messageBytes = message;
    }

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = bs58.decode(signatureBase58);
    } catch {
      return false;
    }

    if (signatureBytes.length !== 64) return false;

    let publicKeyBytes: Uint8Array;
    try {
      publicKeyBytes = new PublicKey(address).toBytes();
    } catch {
      return false;
    }

    // Nacl doğrudan byte array'ler ile kusursuz ve deterministik çalışır
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}
// ─── 3. PUMPMATCH CANONICAL JSON ENGINE (Shared Implementation) ───
// Types and canonical generators are defined in signature-shared.ts (client-safe).
// Re-export them so existing imports from "@/lib/signature" keep working.
export {
  generateCanonicalMessageV1 as generateCanonicalMessage,
  generateCanonicalMessageV2,
  type PumpMatchPayload,
  type SquadTransitionPayloadV2,
} from "@/lib/signature-shared";

import {
  generateCanonicalMessageV1,
} from "@/lib/signature-shared";
import type {
  PumpMatchPayload as _PumpMatchPayload,
  SquadTransitionPayloadV2 as _SquadTransitionPayloadV2,
} from "@/lib/signature-shared";

export async function verifyWalletSignature(
  publicKeyBase58: string,
  signatureBase58: string,
  expectedPayload: _PumpMatchPayload
): Promise<{ isValid: boolean; derivedActor?: string; error?: string }> {
  try {
    if (expectedPayload.v !== 1) return { isValid: false, error: 'Unsupported protocol version.' };
    if (expectedPayload.domain !== 'pumpmatch-governance') return { isValid: false, error: 'Invalid domain separation.' };
    if (expectedPayload.env !== 'production' && expectedPayload.env !== 'development') {
      return { isValid: false, error: 'Invalid environment.' };
    }

    const now = Date.now();
    const ts = expectedPayload.timestamp;

    if (!ts || typeof ts !== 'number') return { isValid: false, error: 'Invalid timestamp.' };
    if (ts > now + 30 * 1000) return { isValid: false, error: 'Clock drift: Timestamp in future.' };
    if (ts < now - 5 * 60 * 1000) return { isValid: false, error: 'Signature expired.' };

    const messageBytes = generateCanonicalMessageV1(expectedPayload);
    const publicKeyBytes = base58Decode(publicKeyBase58.trim());
    const signatureBytes = base58Decode(signatureBase58.trim());

    const { subtle } = globalThis.crypto;
    const key = await subtle.importKey(
      "raw",
      toArrayBuffer(publicKeyBytes),
      { name: "Ed25519" },
      false,
      ["verify"],
    );

    const isVerified = await subtle.verify(
      "Ed25519",
      key,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(messageBytes),
    );

    if (!isVerified) {
      return { isValid: false, error: 'Cryptographic signature mismatch.' };
    }

    return { isValid: true, derivedActor: publicKeyBase58.trim() };

  } catch (err) {
    console.error("[Signature Verification Error]", err instanceof Error ? err.message : String(err));
    return { isValid: false, error: 'Internal verification failure.' };
  }
}

// ─── 4. SQUAD TRANSITION V2 VALIDATION ───
const SQUAD_V2_MAX_AGE_MS = 5 * 60 * 1000;
const SQUAD_V2_FUTURE_SKEW_MS = 30 * 1000;

export function validateSquadTransitionPayloadV2(
  payload: _SquadTransitionPayloadV2
): { ok: true } | { ok: false; error: string } {
  if (payload.v !== 2) return { ok: false, error: "Unsupported payload version." };
  if (payload.domain !== "pumpmatch-governance") return { ok: false, error: "Invalid domain." };
  const now = Date.now();
  const ts = Number(payload.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, error: "Invalid timestamp." };
  if (ts > now + SQUAD_V2_FUTURE_SKEW_MS) return { ok: false, error: "Timestamp in future." };
  if (now - ts > SQUAD_V2_MAX_AGE_MS) return { ok: false, error: "Signature expired." };
  return { ok: true };
}