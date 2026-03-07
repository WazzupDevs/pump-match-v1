# PumpMatch Intelligence Core Specification (v2)

# PumpMatch Intelligence Core Specification

**Version:** 2.0  
**Status:** Internal Canonical Draft  
**Owner:** Product / Data / Engineering  
**Scope:** Solana Behavioral Wallet Intelligence  
**Replaces:** `PUMPMATCH PROTOCOL: TRUST SCORE & MATCHING SPECIFICATION (v1)`

## 1. Purpose

PumpMatch is not a blockchain explorer.
PumpMatch is a **behavioral wallet intelligence** and **reputation layer** for Solana.

The system exists to:

* understand not just what wallets hold, but **how they behave**
* measure not just token distribution, but **community quality and risk structure**
* provide users with **multi-axis, explainable analysis**, not a single opaque “trust” label
* create a **shareable public proof layer** that remains resilient against manipulation

Core principle:

> **We do not score vanity. We score behavior.**

---

## 2. Core Philosophy

### 2.1 Behavior Over Balance

A wallet’s value is not defined by balance size or one lucky win.
The real signal comes from entry timing, exit discipline, holding duration, repeated strategy, and risk behavior.

### 2.2 Intelligence Over Labels

Labels such as `Jeet`, `Diamond Hand`, or `Sniper` are **not database truth**.
They are presentation-layer outputs derived from measurable signals.

The database should store:

* raw events
* normalized trades
* measurable features
* explainable scores
* score confidence

### 2.3 Explainability Over Magic

Every meaningful score must be explainable.
The system must be able to answer:

* which features influenced the score
* over which time window the score was computed
* what the sample size was
* how confident the system is in the result

### 2.4 Consent for Identity, Not for Analysis

A wallet may be analyzed behaviorally without public identity consent.
However, the following require explicit opt-in:

* profile claiming
* public identity linking
* discoverability in social/public directories
* public proof publication under a user identity

### 2.5 Versioning Over Permanence

Scoring models will evolve.
Therefore:

* raw events are immutable
* derived features are versioned
* scores are versioned
* public outputs must remain reproducible against the model version that generated them

### 2.6 Suspicion Is a First-Class Signal

High PnL alone does not imply quality.
The system must explicitly account for suspicious behavior, coordination risk, and manipulation patterns.

---

## 3. System Scope

PumpMatch v2 is centered around three layers:

### 3.1 Intelligence Layer

Produces measurable wallet and token intelligence.

Includes:

* wallet behavior features
* wallet score snapshots
* token holder composition
* suspiciousness signals
* confidence values
* explainability outputs

### 3.2 Identity Layer

Optional layer for users who claim wallets and create public profiles.

Includes:

* claimed wallet ownership
* public profile metadata
* optional social links
* visibility controls
* verification state

### 3.3 Presentation Layer

Transforms intelligence into human-readable outputs.

Includes:

* receipts
* badges
* titles
* wallet summary cards
* public proof pages

---

## 4. Data Model Principles

### 4.1 Raw Events Are Immutable

Raw chain data must never be overwritten after ingestion, except in explicit corrective maintenance flows.

### 4.2 Features Are Measurements

Features are observable or derived measurements such as:

* median hold time
* launch-window buy ratio
* win rate
* realized PnL distribution
* repeat token ratio
* suspicious overlap ratio

Features are not labels.

### 4.3 Scores Are Interpretations

Scores are model outputs derived from features.
They may change as models improve.

Examples:

* `sniper_score`
* `swing_score`
* `conviction_score`
* `overall_quality_score`
* `non_suspicious_score`

### 4.4 Personas Are Presentation Artifacts

A persona is a UI-level rendering of score patterns.
It must never be treated as immutable truth.

Example:

* database truth: `sniper_score = 82`, `median_hold_time_mins = 6`
* UI output: `High-Frequency Launch Trader`

### 4.5 All Meaningful Outputs Must Be Windowed

Feature and score computations must be tied to an explicit time window such as:

* `7d`
* `30d`
* `90d`
* `all`

---

## 5. Score Taxonomy

PumpMatch v2 does not rely on a single trust score.
It uses multiple score families.

### 5.1 Style Scores

Describe *how* a wallet tends to trade.

Examples:

* `sniper_score`
* `scalper_score`
* `swing_score`
* `conviction_score`
* `momentum_score`
* `dip_buyer_score`

### 5.2 Quality Scores

Describe *how good* or durable the wallet’s behavior appears.

Examples:

* `consistency_score`
* `pnl_quality_score`
* `risk_adjusted_score`
* `longevity_score`
* `overall_quality_score`

### 5.3 Suspiciousness Scores

Describe risk of manipulation, inorganic behavior, or low-integrity patterns.

Examples:

* `non_suspicious_score`
* `coordination_risk_score`
* `fresh_wallet_anomaly_score`
* `concentration_risk_score`
* `wash_like_behavior_score`

### 5.4 Confidence Scores

Describe how much trust the system has in its own output.

Examples:

* `style_confidence`
* `quality_confidence`
* `overall_confidence`

Confidence should consider:

* sample size
* feature coverage
* recency
* signal stability

### 5.5 Future Collaboration Scores

Not part of MVP core.

Reserved for:

* partner compatibility
* squad stability
* weak-link group scoring
* complementary role fit

---

## 6. Wallet Analysis Rules

### 6.1 No Hard Persona Storage

The system must not store rigid labels like:

* `persona = jeet`
* `persona = smart_money`

Instead it stores:

* measurable features
* score snapshots
* presentation outputs derived from current logic

### 6.2 Low-Sample Wallets Must Be Penalized in Confidence

A wallet with insufficient trade history must not receive strong claims.

Example:

* high `sniper_score`, low sample size → low confidence
* strong PnL, only two trades → low quality confidence

### 6.3 Performance Must Be Contextual

PnL without context is insufficient.

Evaluation should consider:

* number of trades
* number of unique tokens
* consistency over time
* concentration of returns
* whether returns depend on a single outlier trade

### 6.4 Timing Matters

Behavioral intelligence must consider:

* seconds from token launch
* speed of first entry
* speed of first exit
* short-hold ratios
* long-hold ratios

### 6.5 Behavior Over Any Single Win

No wallet should be designated high-quality purely because of one successful trade.

---

## 7. Token Intelligence Rules

### 7.1 Token Analysis Is Community Analysis

A token’s quality is not determined only by chart shape or holder count.
It is influenced by the behavior profile of its holder base.

### 7.2 Token Holder Intelligence May Include

* holder concentration
* fresh wallet ratio
* high-churn ratio
* conviction holder ratio
* suspicious cluster ratio
* quality-weighted holder score
* sell pressure score

### 7.3 Community Quality Is Explainable

Any token-level “community quality” output must be supported by the underlying holder composition signals.

### 7.4 Manipulation Resistance

The system must be designed with the assumption that teams may intentionally stage wallet behavior to appear high-quality.

Therefore token intelligence should consider:

* shared funding sources
* synchronized entry timing
* synchronized exits
* repeated co-holding patterns
* unusual fresh-wallet concentration

---

## 8. Privacy and Visibility Modes

### 8.1 Ghost Mode (Default)

Any wallet may be analyzed.
But unless claimed or made public, it does not become a public identity object.

In Ghost Mode:

* behavioral analysis is allowed
* public identity publication is not allowed
* public discoverability is not allowed
* internal caching is allowed
* temporary or internal derived processing is allowed

### 8.2 Claimed Private Mode

A user claims a wallet but does not make it public.

In Claimed Private Mode:

* wallet ownership is known to the account owner
* profile editing is allowed
* public discoverability is off
* social identity linking is optional
* public receipt publishing may be disabled by default

### 8.3 Public Profile Mode

A claimed wallet may be published as a public profile.

In Public Profile Mode:

* public summary becomes visible
* shareable receipts may be generated
* optional social metadata may be shown
* the wallet becomes discoverable according to visibility settings

### 8.4 Verified Public Mode

Reserved for enhanced profile trust and future attestation logic.

May include:

* stronger claim verification
* social verification
* platform-reviewed status
* future attestations

---

## 9. Anti-Abuse and Anti-Probing Requirements

### 9.1 Rate Limiting

The system must apply query rate limits to prevent:

* graph enumeration
* mass wallet scraping
* token holder mapping abuse
* discovery abuse

### 9.2 Snapshot Caching

Wallet and token intelligence results may be cached for short periods to reduce recomputation and probing pressure.

### 9.3 Search Throttling

Repeated sequential requests across wallets or tokens should be monitored and throttled where necessary.

### 9.4 Limited Graph Exposure

Relationship graphs, cluster evidence, and suspiciousness signals must not be exposed in ways that make reverse-engineering of the platform trivial.

### 9.5 Social Layer Sybil Protections

If social endorsement features are reintroduced in the future, they must include:

* trust weighting
* decay logic
* anti-sybil controls
* endorsement caps
* graph abuse detection

---

## 10. Explainability Standard

Every major score output should support an explainability object containing:

* `score_name`
* `model_version`
* `score_window`
* `sample_size`
* `confidence`
* top contributing features
* feature values
* normalized values
* feature weights
* human-readable explanation

Example:

```json
{
  "score_name": "conviction_score",
  "model_version": "v2.1",
  "score_window": "30d",
  "sample_size": 48,
  "confidence": 0.84,
  "top_factors": [
    {
      "feature": "pct_positions_held_over_24h",
      "value": 62.5,
      "weight": 0.30,
      "contribution": 0.22
    },
    {
      "feature": "median_hold_time_mins",
      "value": 930,
      "weight": 0.25,
      "contribution": 0.18
    }
  ],
  "summary": "This wallet frequently holds positions beyond intraday windows and shows low short-term churn."
}
```

---

## 11. Database Truth Hierarchy

The system should distinguish clearly between storage layers:

### 11.1 Raw Truth

Immutable source events.

Examples:

* signatures
* swaps
* transfers
* launch timestamps
* price snapshots

### 11.2 Derived Measurements

Normalized, measurable outputs.

Examples:

* hold time
* win rate
* realized PnL
* launch-window entry ratio
* short-hold ratio

### 11.3 Interpreted Scores

Versioned model outputs.

Examples:

* style scores
* quality scores
* suspiciousness scores
* confidence scores

### 11.4 Presentation Outputs

Human-readable results.

Examples:

* wallet title
* badge label
* receipt headline
* profile card summary

---

## 12. Identity Layer Rules

### 12.1 Wallet Claiming Is Separate From Wallet Analysis

Ownership and analysis are distinct concerns.

A wallet may be:

* analyzed without being claimed
* claimed without being public
* public without being platform-verified

### 12.2 Identity Data Must Not Directly Rewrite Intelligence Data

User-edited profile fields must never alter raw features or score outputs.

### 12.3 Social Links Are Optional and Secondary

Identity metadata may improve discoverability, but it must not become the primary determinant of intelligence scoring.

---

## 13. The Weak Link Principle

The Weak Link Principle remains valid, but it is **not part of MVP core wallet scoring**.

It is reserved for future collaboration modules such as:

* squad trust
* partner risk
* collaboration quality
* collective failure risk

In such contexts, the system should assume that one low-integrity or low-trust participant may materially increase group risk.

This principle must not distort the core wallet intelligence engine.

---

## 14. Legacy Elements Explicitly Retired From v1

The following concepts from the old trust protocol are retired from core scoring:

* deterministic single-score trust formula
* hardcoded badge bonus arithmetic
* role-based intent bonus matrix
* match confidence as the central product primitive
* badge-driven score inflation

They may reappear later only as:

* presentation signals
* secondary heuristics
* optional collaboration modules

They are not core intelligence primitives in v2.

---

## 15. MVP Product Definition

### 15.1 MVP Goal

Deliver a wallet intelligence experience where a user can input a Solana wallet and receive:

* behavior summary
* style profile
* quality signals
* confidence-aware interpretation
* shareable proof output

### 15.2 MVP Includes

* wallet lookup
* normalized swap history
* wallet-token position summaries
* feature snapshots
* score snapshots
* score explainability
* public/private profile controls
* shareable receipt generation

### 15.3 MVP Excludes

* social feed
* KOL marketplace
* copy-trade positioning
* full relationship graphs
* role-matching marketplace
* public leaderboards optimized for clout farming

---

## 16. Versioning Rules

### 16.1 Raw Data

Never overwritten in normal operation.

### 16.2 Feature Snapshots

Must include:

* `feature_version`
* `feature_window`
* `computed_at`

### 16.3 Score Snapshots

Must include:

* `model_version`
* `score_window`
* `computed_at`

### 16.4 Public Receipts

Must remain reproducible against the exact score snapshot used at creation time.

---

## 17. Product Language Rules

PumpMatch should avoid language that implies:

* guaranteed safety
* investment advice
* copy-trade endorsement
* moral certainty

Preferred language:

* behavior profile
* reputation signal
* confidence-aware score
* public proof
* wallet intelligence
* community quality

Avoid as primary product language:

* doxxing
* guaranteed trust
* copy this trader
* safe token
* certified alpha

---

## 18. Future Roadmap

### v2.1

* richer behavior timeline
* score drift analysis
* wallet evolution tracking

### v2.2

* token community intelligence
* holder composition snapshots
* sell pressure and suspicious concentration models

### v3.0

* behavior graph
* relationship and coordination scoring
* collaboration risk systems
* weak-link squad models
* verified public attestations

---

## 19. Final Design Law

PumpMatch must always preserve this hierarchy:

> **Raw events are truth.
> Features are measurements.
> Scores are interpretations.
> Personas are presentation.**

Any implementation that collapses these layers into one rigid label system is architecturally invalid.

---

## 20. Canonical Statement

PumpMatch is a **behavioral wallet intelligence and reputation layer for Solana**.
It does not reduce wallets to balances, badges, or a single trust number.
It produces versioned, explainable, confidence-aware interpretations of wallet and token behavior while preserving consent for identity exposure.

## Implementation Constraints

- Raw events must not be overwritten during standard processing.
- Scores must always be tied to a model version and score window.
- Features must always be tied to a feature version and feature window.
- Personas must never be stored as immutable database truth.
- Public identity metadata must remain separate from intelligence outputs.
- Heavy analytics must run in workers or jobs, not in client-side logic.
- Public app reads should prefer views or RPC endpoints over direct raw-table access.


## Source of Truth Hierarchy

When implementation decisions conflict, the following precedence applies:

1. Raw chain events
2. Normalized transaction records
3. Derived feature snapshots
4. Score snapshots
5. Presentation-layer labels and receipts