import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletProviders } from "@/components/providers";
import { SquadProvider } from "@/components/providers/SquadProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "PumpMatch | The Trust Layer for Solana";
const DESCRIPTION =
  "Build verified Web3 squads, derive verifiable on-chain reputation, and unlock trustless collaboration across the Solana ecosystem.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  alternates: { canonical: "/" },
  other: { "theme-color": "#020617" },
  openGraph: {
    type: "website",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "PumpMatch",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PumpMatch — The Trust Layer for Solana",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-900"
        >
          Skip to content
        </a>
        <WalletProviders>
          <SquadProvider>{children}</SquadProvider>
        </WalletProviders>
      </body>
    </html>
  );
}
