"use client";

import dynamic from "next/dynamic";

// WalletMultiButton must be dynamically imported to avoid SSR issues
// (wallet adapter uses browser APIs like window.solana)
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton,
    ),
  { ssr: false },
);

/**
 * Production Grade: Wallet Connect Button
 *
 * UX RULE: This button is ONLY for connecting/disconnecting the wallet.
 * It does NOT trigger any analysis or data fetching.
 * Analysis is triggered by a separate "Analyze My Wallet" button.
 */
export function WalletButton() {
  return (
    <WalletMultiButton
      style={{
        background: "rgba(16, 185, 129, 0.1)",
        border: "1px solid rgba(16, 185, 129, 0.4)",
        borderRadius: "9999px",
        fontSize: "13px",
        height: "40px",
        padding: "0 20px",
        color: "#6ee7b7",
        fontWeight: 500,
      }}
    />
  );
}
