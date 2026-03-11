# PumpMatch

**Behavioral Intelligence & Reputation Layer for Solana**

PumpMatch helps users understand how wallets behave, how token communities are composed, and how reputation can be built from observable on-chain behavior.

We are not building another wallet explorer, another token dashboard, or a social feed disguised as analytics.  
We are building the intelligence layer that turns raw on-chain activity into explainable signals for wallets, communities, and eventually high-signal coordination.

---

## Grand Thesis

PumpMatch follows a simple strategic order:

1. **Intelligence**
2. **Reputation**
3. **Coordination**

This sequence is non-negotiable.

Without reliable intelligence, reputation becomes theater.  
Without reliable reputation, coordination becomes chaos.

PumpMatch starts by analyzing wallet behavior, expands into token and community intelligence, and eventually evolves into the trust and coordination infrastructure for high-signal squads.

---

## What PumpMatch Is

PumpMatch is a **behavioral wallet intelligence and reputation system** for Solana.

It exists to answer questions such as:

- How does this wallet actually behave?
- Is this trader fast-entry, high-churn, or conviction-driven?
- Does this token community look strong, fragile, organic, or staged?
- Which signals are credible, and how confident should we be in them?
- How can behavior and reputation eventually support better coordination?

PumpMatch does **not** reduce wallets to a single vanity metric.  
It is designed to produce **explainable, versioned, confidence-aware intelligence**.

---

## Core Design Law

PumpMatch preserves a strict hierarchy of truth:

1. **Raw Events** — immutable source truth  
2. **Features** — measurable behavioral signals  
3. **Scores** — interpreted outputs  
4. **Reputation** — application layer  
5. **Coordination** — future layer built on top

Any system that collapses these layers into a single rigid label is architecturally invalid.

---

## Product Roadmap

### Phase 1 — The Oracle
**Behavioral Wallet Intelligence**

PumpMatch begins by helping users analyze individual wallets.

Core outputs include:
- wallet behavior summaries
- style signals
- quality signals
- suspiciousness signals
- confidence-aware interpretation
- shareable public proof artifacts

This is where PumpMatch earns trust: by making wallet behavior understandable.

### Phase 2 — The Radar
**Token & Community Intelligence**

PumpMatch then expands from individual behavior to crowd behavior.

Core outputs include:
- holder composition
- fresh wallet concentration
- high-churn ratios
- conviction density
- suspicious cluster signals
- quality-weighted community interpretation

This turns PumpMatch from a wallet intelligence product into a broader market intelligence layer.

### Phase 3 — Squad OS
**Coordination Infrastructure**

Only after the intelligence and reputation layers are credible does PumpMatch expand into coordination.

This future layer may include:
- high-signal team formation
- collaboration risk analysis
- weak-link detection
- squad trust surfaces
- governance and workflow infrastructure

Coordination is built on top of intelligence. Never the other way around.

---

## Core Philosophy

### Behavior Over Balance
We measure timing, execution, holding behavior, consistency, and risk patterns — not just balances or one-off wins.

### Explainability Over Black Boxes
Important outputs should be interpretable through measurable signals, score windows, and confidence.

### Consent for Identity, Not for Analysis
Wallets may be analyzed behaviorally without public identity linkage.  
Public profiles, discoverability, and social surfaces require explicit opt-in.

### AI as Analyst, Not Oracle
AI may explain, summarize, investigate, and compose reports.  
It must not replace deterministic scoring or become database truth.

---

## Current Product Surfaces

### Analyze
Analyze a wallet and turn raw activity into behavioral signals and reputation outputs.

### Arena
A discovery surface for public intelligence, leaderboards, and future recruiting or coordination entry points.

### Command Center
A private coordination surface for future squad workflows, governance, and execution.

### Docs
The canonical product, architecture, and roadmap reference for PumpMatch.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** Tailwind CSS + shadcn/ui
- **Database:** Supabase
- **Chain Focus:** Solana
- **Wallet Signing:** `@solana/wallet-adapter-react`
- **On-Chain Data Sources:** Solana RPC / Helius-integrated flows where applicable

---

## Security Principles

- strict RLS for sensitive data paths
- masked public-safe surfaces by default
- server-side signature verification for sensitive actions
- deterministic validation for auth-critical flows
- separation between core intelligence data and presentation artifacts

---

## Public Proof Layer

PumpMatch supports shareable, masked public proof artifacts such as wallet receipts.

These are:
- presentation outputs
- safe for public sharing
- designed for virality and comparison loops

They are **not** database truth, and they must never override raw features or interpreted score snapshots.

---

## Long-Term Direction

PumpMatch is building toward a future where:

- wallets can be understood behaviorally
- communities can be evaluated structurally
- reputation can be earned through observable signals
- coordination can happen with less guesswork and less trust theater

In short:

> **PumpMatch begins as a behavioral intelligence layer for Solana, expands into token and community intelligence, and ultimately evolves into the trust and coordination infrastructure for high-signal squads.**

---

## Repository Status

This repository is currently in an active transition from legacy trust-score/matchmaking framing toward the Intelligence Core v2 architecture.

Canonical references:
- `intelligence-core-v2.md`
- `MIGRATION-V2-HARDENING.md` (allowed transitional inventory and regression checklist)
- docs sections reflecting Behavioral Intelligence
- Grand Vision & Product Roadmap
- updated Cursor rules aligned to Intelligence → Reputation → Coordination

---

## License

Private / project-specific unless otherwise stated. 