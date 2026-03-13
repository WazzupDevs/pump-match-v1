# PumpMatch Signal Model v3

Canonical signal-family and axis-mapping model for `IntelligenceReportV3`.
This document is the authoritative reference for what each signal means,
where it comes from, and how it feeds the five behavioral axes.

---

## 1. Design philosophy

1. **Signals are observations, axes are interpretations.**
   A signal records what happened on-chain. An axis score interprets
   what a pattern of signals implies about behavior. The engine never
   skips the signal layer and jumps straight to an axis value.

2. **Every signal has a single canonical source.**
   No signal is derived from two unrelated APIs blended together.
   If two data points contribute to the same axis, they are separate
   signals that map independently.

3. **Core signals must be computable from Helius data alone.**
   Optional enrichment (DexScreener, balance APIs) may be absent.
   A valid report can always be produced from transaction history +
   DAS asset ownership. Enrichment improves quality; its absence
   does not invalidate the report.

4. **No moral language.**
   Signals describe frequency, duration, ratio, count. Never
   "trustworthiness," "honesty," or "reliability." Axes like
   `credibility` measure observable behavioral consistency,
   not character.

5. **Deterministic and auditable.**
   Given the same on-chain data and the same observation window,
   the engine must produce identical signals and identical axis scores.
   No randomness, no LLM interpretation, no sampling variance.

6. **Normalization is explicit.**
   Each signal documents its unit, range, and direction.
   Axis scores are always 0-100. Signal values use their natural
   unit (seconds, count, ratio) unless otherwise noted.

---

## 2. Signal families

### activity
**Why it exists:** Measures the volume and density of on-chain actions.
Without activity data, nothing else can be computed.
**Core or enrichment:** Core. Must always be populated.

### positions
**Why it exists:** Measures position lifecycle — how many positions were
opened, closed, and how long they were held. This is the primary input
for style classification and risk assessment.
**Core or enrichment:** Core. Must always be populated (values may be 0).

### rotation
**Why it exists:** Measures token diversity and concentration. A wallet
that touches 200 mints behaves differently from one that touches 3.
**Core or enrichment:** Core. Must always be populated.

### risk
**Why it exists:** Measures behavioral risk indicators — exit speed
(jeet behavior), exposure to rugged tokens, and dead bag accumulation.
**Core or enrichment:** Core. Must always be populated.

### marketPosture
**Why it exists:** Records the wallet's current balance state at analysis
time. This is a point-in-time snapshot, not a behavioral pattern.
**Core or enrichment:** Optional enrichment. `solBalance` is core
(available via RPC). `portfolioValueUsd`, `fungibleTokenCount`, and
`nftCount` are enrichment — their absence does not invalidate the report.

### protocol
**Why it exists:** Measures engagement depth with the pump.fun protocol
specifically. PumpMatch is a pump.fun behavioral intelligence system;
protocol-specific signals are first-class, not afterthought.
**Core or enrichment:** Core. Must always be populated (values may be 0
for wallets with no pump.fun activity).

---

## 3. Canonical signal list

### activity family

| Signal key | Type | Meaning | Unit/Range | Direction | Core? | Observation basis |
|---|---|---|---|---|---|---|
| `totalTransactions` | number | Total confirmed transactions observed in the window | integer >= 0 | higher = more active | Core | Helius Enhanced TX page count |
| `approxWalletAgeDays` | number \| null | Days since earliest observed transaction | integer >= 0, null if unknown | higher = older | Core | Timestamp of first tx in Helius history |
| `tradeFrequencyScore` | number | Normalized trade frequency: closedPositions / walletAgeDays * 20, clamped 0-100 | 0-100 | higher = more frequent | Core | Derived from positions.closedPositions + activity.approxWalletAgeDays |
| `txDensity` | number | Average transactions per active day | float >= 0 | higher = denser | Core | totalTransactions / activeDayCount (0 if insufficient data) |

### positions family

| Signal key | Type | Meaning | Unit/Range | Direction | Core? | Observation basis |
|---|---|---|---|---|---|---|
| `closedPositions` | number | Positions that reached zero balance (full exit) | integer >= 0 | higher = more exits observed | Core | Pump position simulator: balance goes positive → zero |
| `openPositions` | number | Positions still held at analysis time | integer >= 0 | neutral (context-dependent) | Core | Pump position simulator: balance > 0 at window end |
| `medianHoldTimeSec` | number | Median hold duration of closed positions | seconds >= 0 | context-dependent | Core | Sorted closed position durations, take median |
| `avgHoldTimeSec` | number | Mean hold duration of closed positions | seconds >= 0 | context-dependent | Core | Sum of closed position durations / closedPositions |
| `winRate` | number \| null | Ratio of profitable exits to total exits | 0.0-1.0, null if no exits | higher = more profitable exits | Core | Requires exit price vs entry price comparison; null when price data unavailable |

### rotation family

| Signal key | Type | Meaning | Unit/Range | Direction | Core? | Observation basis |
|---|---|---|---|---|---|---|
| `uniqueTokens` | number | Distinct token mints interacted with | integer >= 0 | higher = wider activity | Core | Unique mint addresses from getAssetsByOwner |
| `diversityScore` | number | Normalized token diversity | 0-100 | higher = more diverse | Core | Derived from uniqueTokens with diminishing returns curve |
| `topTokenConcentration` | number | Volume share of top-3 tokens | 0.0-1.0 | higher = more concentrated | Core | Transaction volume by mint, top-3 share of total |

### risk family

| Signal key | Type | Meaning | Unit/Range | Direction | Core? | Observation basis |
|---|---|---|---|---|---|---|
| `jeetIndex` | number | Exit speed index. Higher = faster exits relative to entry. Based on median hold time buckets. | 0-100 | higher = faster exits | Core | Lookup table from medianHoldTimeSec: <=120s→100, <=300s→90, <=900s→75, <=3600s→50, <=14400s→30, <=86400s→10, >86400s→0 |
| `rugExposureIndex` | number | Percentage of touched mints still held as dead bags (open 3+ days with no liquidity activity) | 0-100 | higher = more rug exposure | Core | deadMintCount / pumpMintsTouched * 100 |
| `deadBagRatio` | number | Ratio of open positions that are likely dead (held > 3 days, no further activity) to total positions | 0.0-1.0 | higher = more dead bags | Core | deadPositions / (closedPositions + openPositions) |

### marketPosture family

| Signal key | Type | Meaning | Unit/Range | Direction | Core? | Observation basis |
|---|---|---|---|---|---|---|
| `solBalance` | number | SOL balance at analysis time | SOL (float >= 0) | neutral | Core | `getBalance` RPC call, lamports / 1e9 |
| `portfolioValueUsd` | number \| null | Total portfolio USD value at analysis time | USD float, null if unavailable | neutral | Enrichment | Helius `getWalletBalances` API (hourly pricing) |
| `fungibleTokenCount` | number | Number of distinct fungible tokens held | integer >= 0 | neutral | Enrichment | Helius `searchAssets` with tokenType=fungible |
| `nftCount` | number | Number of NFTs held | integer >= 0 | neutral | Enrichment | Helius `searchAssets` with tokenType=nonFungible |

### protocol family

| Signal key | Type | Meaning | Unit/Range | Direction | Core? | Observation basis |
|---|---|---|---|---|---|---|
| `pumpMintsTouched` | number | Distinct pump.fun mints the wallet interacted with | integer >= 0 | higher = wider pump engagement | Core | Count of mints confirmed as pump txs via program ID match |
| `pumpClosedPositions` | number | Pump.fun positions fully exited | integer >= 0 | higher = more observed behavior | Core | Subset of closedPositions where mint is in pump universe |
| `pumpConfidence` | CoverageTier | Data sufficiency for pump-specific scoring | HIGH/MEDIUM/LOW/INSUFFICIENT | higher = more reliable | Core | HIGH: >= 10 closed, MEDIUM: 3-9, LOW: 1-2, INSUFFICIENT: 0 |

---

## 4. Axis mapping table

Each cell shows the mapping weight:
- **P** = Primary driver (this signal is a major input to this axis)
- **S** = Secondary contributor (this signal provides supporting evidence)
- **—** = No effect (this signal does not feed this axis)

| Signal | style | quality | risk | adaptation | credibility |
|---|---|---|---|---|---|
| **activity.totalTransactions** | S | S | — | — | S |
| **activity.approxWalletAgeDays** | — | P (longevity) | — | — | P (tenure) |
| **activity.tradeFrequencyScore** | P | — | S | — | — |
| **activity.txDensity** | S | — | — | — | S |
| **positions.closedPositions** | P | P (consistency) | S | — | S |
| **positions.openPositions** | S | — | S | — | — |
| **positions.medianHoldTimeSec** | P | — | P (churn) | — | — |
| **positions.avgHoldTimeSec** | P | — | S | — | — |
| **positions.winRate** | — | P (pnlQuality) | — | — | — |
| **rotation.uniqueTokens** | S | S | — | P (sectorRotation) | — |
| **rotation.diversityScore** | S | S (pnlQuality) | — | P (sectorRotation) | — |
| **rotation.topTokenConcentration** | S | — | — | P (sectorRotation) | — |
| **risk.jeetIndex** | P | S | P (churn) | — | S |
| **risk.rugExposureIndex** | — | S | P (rugExposure) | — | S |
| **risk.deadBagRatio** | — | — | P (rugExposure) | — | S |
| **marketPosture.solBalance** | — | — | — | — | — |
| **marketPosture.portfolioValueUsd** | — | S (pnlQuality) | — | — | — |
| **marketPosture.fungibleTokenCount** | — | — | — | S | — |
| **marketPosture.nftCount** | — | — | — | — | — |
| **protocol.pumpMintsTouched** | S | — | S | S | — |
| **protocol.pumpClosedPositions** | S | S | S | — | — |
| **protocol.pumpConfidence** | — | — | — | — | — |

### Axis input detail

**style axis** — Which trading style does this wallet exhibit?
- **Primary drivers:** `medianHoldTimeSec`, `avgHoldTimeSec`, `tradeFrequencyScore`, `closedPositions`, `jeetIndex`
- **Secondary:** `uniqueTokens`, `diversityScore`, `topTokenConcentration`, `txDensity`, `openPositions`, `pumpMintsTouched`, `pumpClosedPositions`
- **Rule:** Style is inferred from temporal patterns (how long positions are held, how frequently they trade) combined with breadth (how many tokens they touch). `jeetIndex` strongly separates scalpers from conviction holders.

**quality axis** — How consistent and profitable is the observed behavior?
- **Primary drivers:** `closedPositions` → consistency, `winRate` → pnlQuality, `approxWalletAgeDays` → longevity
- **Secondary:** `totalTransactions`, `diversityScore`, `portfolioValueUsd`, `rugExposureIndex`, `jeetIndex`, `pumpClosedPositions`
- **Rule:** Quality requires sufficient closed positions to measure. Longevity requires wallet age. PnL quality requires win rate data (may be null). When primary inputs are missing, `status: "ESTIMATED"` or `"INSUFFICIENT"`.

**risk axis** — What behavioral risk patterns are observable?
- **Primary drivers:** `jeetIndex` → churn, `rugExposureIndex` → rugExposure, `deadBagRatio` → rugExposure
- **Secondary:** `medianHoldTimeSec`, `openPositions`, `closedPositions`, `pumpMintsTouched`, `pumpClosedPositions`, `tradeFrequencyScore`
- **Rule:** Churn is directly derived from jeet behavior (fast exits). Rug exposure is directly derived from dead bag accumulation. Suspiciousness is a blend of both.

**adaptation axis** — Does behavior vary across conditions?
- **Primary drivers:** `uniqueTokens` → sectorRotation, `diversityScore` → sectorRotation, `topTokenConcentration` → sectorRotation
- **Secondary:** `fungibleTokenCount`, `pumpMintsTouched`
- **Note on status:** `regimeFlexibility` and `sizingDiscipline` require time-series comparison across different market periods. With the current single-window observation, these will typically be `status: "ESTIMATED"` or `"INSUFFICIENT"`. `sectorRotation` is computable from current data.

**credibility axis** — Is this wallet's behavioral data reliable and sustained?
- **Primary drivers:** `approxWalletAgeDays` → tenure, `jeetIndex` + `rugExposureIndex` + `deadBagRatio` → patternStability (inverse: erratic patterns reduce stability)
- **Secondary:** `totalTransactions`, `txDensity`, `closedPositions`
- **Note on organicScore:** Wash trading detection requires transaction graph analysis (self-dealing patterns, circular transfers). With current data, `organicScore` will be `status: "ESTIMATED"` using heuristics (e.g., abnormally uniform hold times or suspiciously regular transaction intervals as weak indicators).

---

## 5. Primary style inference relevance

The `primaryStyle` classification assigns one of: Sniper, Scalper, Swing, Conviction, Passive, Unclassified.

Each style has a characteristic signal fingerprint. The following table shows
which signals are most relevant for distinguishing each style.

### Signal relevance for style inference

| Signal | Relevance | Rationale |
|---|---|---|
| `positions.medianHoldTimeSec` | **HIGH** | The single strongest style discriminator. Short hold → Sniper/Scalper. Medium → Swing. Long → Conviction. |
| `risk.jeetIndex` | **HIGH** | Directly derived from hold time but bucketed. Separates fast-exit styles from patient styles. |
| `activity.tradeFrequencyScore` | **HIGH** | High frequency + short holds = Scalper. High frequency + targeted holds = Sniper. Low frequency = Passive/Conviction. |
| `positions.closedPositions` | **HIGH** | Zero closed positions → Passive or Unclassified. Many closed positions → active trading style. Required for statistical confidence. |
| `positions.avgHoldTimeSec` | **MEDIUM** | Complements median. When avg >> median, there are outlier long holds mixed with short ones (mixed style signal). |
| `rotation.uniqueTokens` | **MEDIUM** | Wide rotation + short holds = Scalper. Narrow + long holds = Conviction. |
| `rotation.topTokenConcentration` | **MEDIUM** | High concentration + long holds = Conviction. Low concentration + high frequency = Scalper. |
| `protocol.pumpClosedPositions` | **MEDIUM** | High pump-specific closed positions indicate active pump.fun trading style (Sniper or Scalper territory). |
| `rotation.diversityScore` | **LOW** | Correlated with uniqueTokens but less discriminative for style. |
| `activity.totalTransactions` | **LOW** | Volume alone does not distinguish style — a Conviction holder with many DeFi txs and a Scalper may have similar counts. |
| `positions.openPositions` | **LOW** | Many open positions may indicate Conviction (holding) or dead bags (risk). Ambiguous for style alone. |
| `risk.rugExposureIndex` | **LOW** | Not a style discriminator. A Conviction holder and a Scalper can both have high rug exposure. |
| `marketPosture.*` | **LOW** | Balance is not a style signal. A whale can be any style. |

### Style fingerprints (deterministic rules, not ML)

| Style | medianHoldTimeSec | jeetIndex | tradeFrequencyScore | closedPositions | topTokenConcentration |
|---|---|---|---|---|---|
| **Sniper** | < 900s | >= 75 | >= 40 | >= 5 | any |
| **Scalper** | < 3600s | >= 50 | >= 30 | >= 3 | low (< 0.5) |
| **Swing** | 3600s - 86400s | 10-50 | any | >= 3 | any |
| **Conviction** | > 86400s | <= 10 | any | >= 1 | high (>= 0.5) |
| **Passive** | any | any | < 5 | < 1 | any |
| **Unclassified** | — | — | — | — | — |

Note: These are indicative thresholds for the signal model document.
The actual inference engine may use weighted scoring rather than hard
boundaries. The key point is which signals matter most.

---

## 6. Badge trigger suitability

For each signal, whether it can directly trigger a badge, or only serve
as supporting evidence.

| Signal | Badge suitability | Example badge use |
|---|---|---|
| `positions.medianHoldTimeSec` | **Direct trigger** | `diamond_hands` (> 86400s + closedPositions >= 3) |
| `risk.jeetIndex` | **Direct trigger** | `mega_jeet` (>= 90 + closedPositions >= 3) |
| `risk.rugExposureIndex` | **Direct trigger** | `rug_magnet` (>= 60 + pumpMintsTouched >= 10) |
| `risk.deadBagRatio` | **Supporting evidence** | Strengthens `rug_magnet` confidence |
| `positions.closedPositions` | **Direct trigger (threshold gate)** | Required minimum for most behavioral badges |
| `activity.approxWalletAgeDays` | **Direct trigger** | `og_wallet` (>= 365 days) |
| `activity.totalTransactions` | **Direct trigger** | `og_wallet` (>= 1000 txs, combined with age) |
| `activity.tradeFrequencyScore` | **Supporting evidence** | Strengthens style-derived badges |
| `activity.txDensity` | **Supporting evidence** | Context for activity badges |
| `positions.openPositions` | **Supporting evidence** | Context for dead bag / conviction assessment |
| `positions.avgHoldTimeSec` | **Supporting evidence** | Supplements medianHoldTimeSec |
| `positions.winRate` | **Direct trigger** | `sharp_shooter` (winRate >= 0.7 + closedPositions >= 10) |
| `rotation.uniqueTokens` | **Supporting evidence** | Context for rotation-based badges |
| `rotation.diversityScore` | **Direct trigger** | `token_explorer` (diversityScore >= 70) |
| `rotation.topTokenConcentration` | **Supporting evidence** | Context for conviction/concentration badges |
| `marketPosture.solBalance` | **Not suitable** | Balance is volatile and externally controllable. Not behavioral. |
| `marketPosture.portfolioValueUsd` | **Not suitable** | Same as solBalance — not behavioral. |
| `marketPosture.fungibleTokenCount` | **Not suitable** | Snapshot quantity, not behavior pattern. |
| `marketPosture.nftCount` | **Not suitable** | Snapshot quantity, not behavior pattern. |
| `protocol.pumpMintsTouched` | **Direct trigger (threshold gate)** | Required minimum for pump-specific badges |
| `protocol.pumpClosedPositions` | **Direct trigger (threshold gate)** | Required minimum for pump-specific behavioral badges |
| `protocol.pumpConfidence` | **Not suitable** | Coverage indicator, not behavior |

### Badge design rules

1. Every badge must cite at least one **direct trigger** signal in its `evidence` array.
2. Every badge must have a **minimum closedPositions gate** to prevent low-data badges.
3. Balance-derived signals (`solBalance`, `portfolioValueUsd`) must NEVER trigger badges.
   The legacy `whale` badge based on SOL balance is deprecated in v3.
4. Badge categories map to signal families:
   - `BEHAVIORAL` badges: triggered by positions, risk, activity signals
   - `STRUCTURAL` badges: triggered by activity age/volume thresholds
   - `PROTOCOL` badges: triggered by protocol-specific signals

---

## 7. Core vs optional enrichment boundary

### Core signals (must exist for a valid report)

These signals can always be computed from Helius Enhanced Transactions API +
basic RPC calls. Their absence means the engine has a bug, not missing data.

| Family | Signal | Source |
|---|---|---|
| activity | `totalTransactions` | Helius Enhanced TX page count |
| activity | `approxWalletAgeDays` | First tx timestamp (null only if wallet has zero txs) |
| activity | `tradeFrequencyScore` | Derived from closedPositions + walletAge |
| activity | `txDensity` | Derived from totalTransactions + active day count |
| positions | `closedPositions` | Pump position simulator |
| positions | `openPositions` | Pump position simulator |
| positions | `medianHoldTimeSec` | Closed position durations |
| positions | `avgHoldTimeSec` | Closed position durations |
| rotation | `uniqueTokens` | getAssetsByOwner mint count |
| rotation | `diversityScore` | Derived from uniqueTokens |
| rotation | `topTokenConcentration` | Transaction volume by mint |
| risk | `jeetIndex` | Lookup table from medianHoldTimeSec |
| risk | `rugExposureIndex` | Dead mint ratio from position simulator |
| risk | `deadBagRatio` | Dead positions / total positions |
| marketPosture | `solBalance` | getBalance RPC |
| protocol | `pumpMintsTouched` | Pump program ID matching |
| protocol | `pumpClosedPositions` | Pump position simulator |
| protocol | `pumpConfidence` | Derived from pumpClosedPositions count |

### Optional enrichment signals (may be absent)

These signals depend on APIs that may be rate-limited, unavailable,
or return no data. The report is valid without them, but axis scores
may have lower confidence.

| Family | Signal | Source | Impact when absent |
|---|---|---|---|
| positions | `winRate` | Requires entry/exit price comparison (DexScreener or Helius pricing) | quality.pnlQuality uses heuristic fallback; axis status → ESTIMATED |
| marketPosture | `portfolioValueUsd` | Helius getWalletBalances API (hourly pricing, rate-limited) | quality.pnlQuality loses one input; no axis invalidation |
| marketPosture | `fungibleTokenCount` | Helius searchAssets (may 429) | adaptation.sectorRotation loses one secondary input |
| marketPosture | `nftCount` | Helius searchAssets (may 429) | No axis impact |

### Axis status rules based on signal availability

| Axis | MEASURED when | ESTIMATED when | INSUFFICIENT when |
|---|---|---|---|
| style | closedPositions >= 5 AND medianHoldTimeSec > 0 | closedPositions 1-4 | closedPositions == 0 |
| quality | closedPositions >= 8 AND winRate != null AND walletAge != null | closedPositions >= 3 OR winRate == null | closedPositions < 3 |
| risk | closedPositions >= 5 AND pumpMintsTouched >= 3 | closedPositions 1-4 OR pumpMintsTouched 1-2 | closedPositions == 0 AND pumpMintsTouched == 0 |
| adaptation | uniqueTokens >= 10 AND closedPositions >= 10 | uniqueTokens >= 3 | uniqueTokens < 3 OR closedPositions < 3 |
| credibility | walletAge >= 30 AND totalTransactions >= 50 | walletAge >= 7 OR totalTransactions >= 10 | walletAge < 7 AND totalTransactions < 10 |

---

## 8. Red flags avoided

1. **No balance-as-identity.**
   `solBalance` and `portfolioValueUsd` are observation-only. They do not
   feed style classification, do not trigger badges, and do not determine
   credibility. A wallet with 0.01 SOL and 500 closed positions is more
   informative than one with 10,000 SOL and 2 transactions.

2. **No single trust scalar at signal level.**
   There is no `trustSignal` or `reliabilityScore` in the signal model.
   Trust was always a UI convenience, not a measurement. The transitional
   `_transitional.trustScore` is derived from `axes.quality.overall` at
   the report assembly step, never at the signal level.

3. **No LLM-derived signals.**
   Every signal in this model is computable by deterministic code from
   on-chain data. The summary is template-derived. No signal requires
   AI interpretation.

4. **No circular dependencies.**
   Signals feed axes. Axes do not feed signals. Badges read signals
   and axes but do not modify them. The data flow is strictly
   one-directional: raw data → signals → axes → badges/summary.

5. **No "suspiciousness" signal.**
   `suspiciousness` exists only as an axis output (risk axis), not as a
   signal input. It is derived from the blend of `jeetIndex` and
   `rugExposureIndex`. There is no raw "suspiciousness" observation
   on-chain.

6. **No time-series dependency for v3.0 launch.**
   Adaptation axis fields (`regimeFlexibility`, `sizingDiscipline`) that
   require multi-window comparison are explicitly marked as ESTIMATED or
   INSUFFICIENT in v3.0. The signal model does not pretend to have data
   it cannot yet compute. `sectorRotation` is the only adaptation sub-axis
   that can be MEASURED from single-window data.

7. **No badge from snapshot quantities.**
   `fungibleTokenCount`, `nftCount`, `solBalance` are point-in-time
   snapshots that can change in the next block. They are unsuitable
   for behavioral badges. The legacy `whale` and `dev` badges based
   on these values are replaced with behavioral equivalents in v3.

8. **No implicit zeroing.**
   When data is insufficient, the axis `status` is set to `INSUFFICIENT`
   rather than silently returning 0. A consumer that reads
   `axes.adaptation.regimeFlexibility === 0` with `status: "INSUFFICIENT"`
   knows the zero is a default, not a measurement.

9. **No market-condition signals.**
   The signal model does not attempt to capture external market state
   (bull/bear, volume regimes). The report describes wallet behavior,
   not market conditions. If market context is needed, it belongs in
   a response envelope, not in the intelligence report.

---

## 9. Adoption notes

### Current engine mapping (v2 → v3 signals)

The existing `lib/intelligence-engine.ts` already computes most v3 signals
under different names. The migration is primarily renaming and restructuring.

| v3 Signal | Current source | Migration effort |
|---|---|---|
| `activity.totalTransactions` | `core.transactionCount` | Rename |
| `activity.approxWalletAgeDays` | `core.approxWalletAgeDays` | Rename |
| `activity.tradeFrequencyScore` | `behavioral.tradeFreqScore` | Rename |
| `activity.txDensity` | Not yet computed | New: totalTx / activeDays |
| `positions.closedPositions` | `pumpStats.closedPositions` | Rename |
| `positions.openPositions` | Not yet surfaced (computed in simulator but not returned) | Surface existing value |
| `positions.medianHoldTimeSec` | `pumpStats.medianHoldTimeSeconds` | Rename |
| `positions.avgHoldTimeSec` | `behavioral.avgHoldingTimeSec` | Rename |
| `positions.winRate` | Not yet computed | New (requires price data) — nullable |
| `rotation.uniqueTokens` | `core.tokenDiversity` | Rename |
| `rotation.diversityScore` | Derived in `computeTokenDiversity` | Normalize to 0-100 |
| `rotation.topTokenConcentration` | Not yet computed | New: top-3 volume share |
| `risk.jeetIndex` | `pumpStats.jeetScore` / `behavioral.jeetIndex` | Rename |
| `risk.rugExposureIndex` | `pumpStats.rugMagnetScore` / `behavioral.rugExposureIndex` | Rename |
| `risk.deadBagRatio` | Computable from openPositions/total | New: simple ratio |
| `marketPosture.solBalance` | `core.solBalance` | Rename |
| `marketPosture.portfolioValueUsd` | `core.portfolioValueUsd` | Rename, null-safe |
| `marketPosture.fungibleTokenCount` | `core.fungibleTokens` | Rename |
| `marketPosture.nftCount` | `core.totalNfts` | Rename |
| `protocol.pumpMintsTouched` | `pumpStats.pumpMintsTouched` | Rename |
| `protocol.pumpClosedPositions` | `pumpStats.closedPositions` | Rename (same value) |
| `protocol.pumpConfidence` | `pumpStats.confidence` | Map to CoverageTier |

### New signals requiring implementation

Only 4 signals are genuinely new and require code:

1. **`activity.txDensity`** — `totalTransactions / activeDayCount`.
   Requires counting unique days with at least one tx from the transaction
   history. Straightforward addition to `getWalletTransactionData`.

2. **`positions.winRate`** — Requires entry/exit price comparison.
   Can use DexScreener price at open/close timestamps.
   Nullable; not blocking for v3.0 launch.

3. **`rotation.topTokenConcentration`** — Requires counting transaction
   volume per mint and computing top-3 share. Doable from the existing
   Enhanced TX data already fetched.

4. **`risk.deadBagRatio`** — `deadPositions / (closedPositions + openPositions)`.
   The pump simulator already tracks open positions internally; surface the
   dead bag count (open > 3 days).

### Incremental rollout strategy

**Phase 1: Signal restructuring (no behavioral change)**
- Restructure `computeIntelligenceReport` to populate `NormalizedSignals`
  from existing data, using the rename mappings above.
- Set `winRate: null`, `txDensity: 0`, `topTokenConcentration: 0`,
  `deadBagRatio: 0` as placeholders.
- All axis outputs remain identical to current v2 values.
- Dual-emit: produce both v2 snapshot shape and v3 signal shape.
- Zero UI changes. Zero DB schema changes.

**Phase 2: New signal implementation**
- Implement `txDensity`, `topTokenConcentration`, `deadBagRatio` from
  existing transaction data (no new API calls).
- Implement `winRate` with DexScreener price lookup (nullable fallback).
- Surface `openPositions` from pump simulator internals.
- Update axis computations to use new signals.
- Add `AxisStatus` determination logic per the status rules table.

**Phase 3: Badge migration**
- Replace legacy badge triggers (solBalance > 10 → `whale`) with
  behavioral signal triggers.
- Add `evidence` arrays to all badge assignments.
- Deprecate `BADGE_DEFINITIONS` in `analyzeWallet.ts`.

**Phase 4: v2 sunset**
- Remove v2 snapshot dual-emit.
- Remove `_transitional` population (or keep as optional null).
- Remove legacy `ScoreBreakdown` computation.
