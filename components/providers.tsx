"use client";

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

// Required CSS for wallet adapter modal
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Production Grade: Wallet Adapter Providers
 *
 * Wraps the app with Solana wallet connection providers.
 * - ConnectionProvider: RPC endpoint (public mainnet, API key stays server-side)
 * - WalletProvider: Supported wallets (Phantom, Solflare)
 * - WalletModalProvider: Connect/disconnect modal UI
 *
 * SECURITY: This uses a PUBLIC RPC endpoint for client-side wallet connection only.
 * All Helius API calls happen server-side via Server Actions.
 * The HELIUS_API_KEY NEVER reaches the client.
 */
export function WalletProviders({ children }: { children: ReactNode }) {
  // Public Solana mainnet RPC (for wallet connection only, not for data fetching)
  const endpoint = useMemo(() => "https://api.mainnet-beta.solana.com", []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
