/**
 * Architect Mode — Admin wallet bypass for local testing.
 * Gated by ENABLE_ARCHITECT_MODE=true (must be false in production).
 * Server-only: uses process.env.ADMIN_WALLET (not public).
 */

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Strip `web3:solana:` prefix, validate base58. Case-sensitive — no toLowerCase. */
export function normalizeSolanaAddress(input: string): string {
  let addr = input.trim();
  if (addr.startsWith("web3:solana:")) addr = addr.slice("web3:solana:".length);
  if (!BASE58_REGEX.test(addr)) {
    throw new Error("Invalid Solana address");
  }
  return addr;
}

export function isArchitectModeEnabled(): boolean {
  return process.env.ENABLE_ARCHITECT_MODE === "true";
}

export function isArchitectWallet(addr: string): boolean {
  const adminWallet = process.env.ADMIN_WALLET;
  if (!adminWallet) return false;
  try {
    return normalizeSolanaAddress(addr) === normalizeSolanaAddress(adminWallet);
  } catch {
    return false;
  }
}

/** Combined check: mode enabled AND wallet matches. */
export function isArchitect(addr: string): boolean {
  return isArchitectModeEnabled() && isArchitectWallet(addr);
}
