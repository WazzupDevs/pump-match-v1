import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletProviders } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pump Match | The On-Chain Matchmaking Engine",
  description:
    "Find your perfect Web3 squad on Solana. Match with verified devs, whales, and early adopters using trust scores and on-chain reputation in the Pump.fun ecosystem.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pumpmatch.app"),
  openGraph: {
    type: "website",
    url: "/",
    title: "Pump Match | The On-Chain Matchmaking Engine",
    description:
      "Find your perfect Web3 squad on Solana. Match with verified devs, whales, and early adopters using trust scores and on-chain reputation in the Pump.fun ecosystem.",
    siteName: "Pump Match",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Pump Match — The On-Chain Matchmaking Engine for Solana",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pump Match | The On-Chain Matchmaking Engine",
    description:
      "Find your perfect Web3 squad on Solana. Match with verified devs, whales, and early adopters using trust scores and on-chain reputation in the Pump.fun ecosystem.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
