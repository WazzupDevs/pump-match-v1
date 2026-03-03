 @@ The biggest cause of failure on Pump.fun and the broader Solana ecosystem isn't
 PumpMatch replaces blind trust with immutable on-chain data. We provide a matchmaking engine that verifies users based on their actual on-chain footprint. We turn "Trust" into a quantifiable data point, allowing legitimate builders to find each other and form resilient squads.
 
 ## ⚙️ How It Works (Powered by Helius)
 We don't rely on self-reported resumes or vouching. PumpMatch leverages **Helius RPCs and Data APIs** to analyze raw on-chain signals:
 - **Wallet Age Distribution:** Verifying the longevity of the actor in the ecosystem.
 - **Liquidity Behavior:** Analyzing whether the wallet historically provides or drains liquidity.
 - **Capital Survival:** Tracking wallet performance and resilience across market cycles.
 
 These signals are routed through our engine to generate a dynamic **Trust Score**, effectively matching complementary, high-trust users (e.g., matching a verified Dev with a verified Whale).
 
 ## 🛠 Tech Stack
 - **Frontend/Framework:** Next.js (App Router), React, TailwindCSS, TypeScript
 - **On-Chain Data & Infra:** Helius
 - **Wallet Connection:** Solana Wallet Adapter (Phantom, Solflare)
 
 ## 🚀 Getting Started
 
 First, clone the repository and install the dependencies:
 
 ```bash
 npm install
 # or
 yarn install
 # or
 pnpm install
+```
 
-Environment Variables
-You will need a Helius API key to run the on-chain analytics locally. Create a .env.local file in the root directory:
-NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key_here
+### Environment Variables
 
+You will need a Helius API key to run the on-chain analytics locally. Create a `.env.local` file in the root directory:
+
+```bash
+# Required (server-side only)
+HELIUS_API_KEY=your_helius_api_key_here
+
+# Optional
+NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
+NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
+SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
+REDIS_URL=your_redis_url
+REDIS_TOKEN=your_redis_token
+```
+
+> `HELIUS_API_KEY` must be kept **server-side only**. Do not expose this key in client-side environment variables.
+>
+> ⚠️ If you use the wrong prefix (for example `NEXT_PUBLIC_HELIUS_API_KEY`), your API key can be leaked to the client bundle.
+
+Then start the development server:
+
+```bash
 npm run dev
 # or
 yarn dev
+```
 
 Open http://localhost:3000 with your browser to see the result. The matchmaking UI and Trust Score engine will be active.
 
 🗺 Roadmap
 Phase 1: Mainnet Launch & Seeding the initial "Trust Network" with verified builders.
 
 Phase 2: Advanced Helius Integration (rug correlation metrics) & Public API deployment.
 
 Phase 3: Smart Contract Escrow for zero-trust, automated team role enforcement.
-
