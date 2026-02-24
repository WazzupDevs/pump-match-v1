/**
 * Server-only cryptographic signature utilities for Pump Match.
 * Includes V1.5 Canonical JSON Engine + Legacy Plaintext Handlers
 */
import "server-only";

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

export function validateMessageTimestamp(message: string): boolean {
  const match = message.match(/Timestamp:\s*(\d+)/);
  if (!match) return false;
  const ts = parseInt(match[1], 10);
  if (isNaN(ts)) return false;
  return Math.abs(Date.now() - ts) <= MESSAGE_MAX_AGE_MS;
}

export async function verifyLegacySignature(
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
      "raw", toArrayBuffer(publicKeyBytes), { name: "Ed25519" }, false, ["verify"]
    );

    return await subtle.verify("Ed25519", key, toArrayBuffer(signatureBytes), toArrayBuffer(messageBytes));
  } catch {
    return false;
  }
}

// ─── 3. PUMPMATCH V1.5 CANONICAL JSON ENGINE (Squad İşlemleri İçin) ───
export interface PumpMatchPayload {
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
  [key: string]: any;
}

export function generateCanonicalMessage(payload: Record<string, any>): Uint8Array {
  // ASCII bazlı deterministik sıralama
  const sortedKeys = Object.keys(payload).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  
  const canonicalObject: Record<string, any> = {};
  for (const key of sortedKeys) {
    if (typeof payload[key] === 'object' && payload[key] !== null) {
      throw new Error("Nested objects are not allowed in V1 Canonical JSON.");
    }
    canonicalObject[key] = payload[key];
  }
  
  const canonicalString = JSON.stringify(canonicalObject);
  return new TextEncoder().encode(canonicalString);
}

export async function verifyWalletSignature(
  publicKeyBase58: string, 
  signatureBase58: string, 
  expectedPayload: PumpMatchPayload
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

    const messageBytes = generateCanonicalMessage(expectedPayload);
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

  } catch (err: any) {
    console.error("[Signature Verification Error]", err.message);
    return { isValid: false, error: 'Internal verification failure.' };
  }
}