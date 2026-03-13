# CLAUDE.md

# PumpMatch — Claude Code Working Rules

PumpMatch is a Solana behavioral intelligence system.

Claude must preserve these product truths and architecture boundaries when reading, modifying, or extending this repository.

---

## 1. Product identity

PumpMatch = Behavioral Intelligence for Solana

Core principles:

- Intelligence comes first
- Reputation comes second
- Coordination comes later
- AI is interpreter, not scorer
- Public sharing is receipt-first

Claude must optimize for behavioral intelligence accuracy, architectural boundary discipline, and production-safe implementation.

---

## 2. Canonical truths

These are non-negotiable:

- `IntelligenceReport` is the canonical deterministic output
- v3 is canonical
- legacy compatibility fields are transitional only
- `trustScore` is transitional compatibility only
- `/receipt/[shareId]` is the canonical public share route
- `/profile/[address]` is staged public fallback only
- `/analyze/[address]` is the private/default analysis route
- public sharing is receipt-first
- AI must never become the source of truth for classification

Claude must never reintroduce legacy score-first behavior as the product’s primary identity.

---

## 3. Route semantics

### `/analyze/[address]`
Purpose:
- canonical private/default analysis route

Rules:
- must remain independent of public visibility
- must not depend on receipts
- must not depend on public profile resolution
- must not redirect to `/profile/[address]` for normal analysis behavior
- must remain safe for GHOST / non-public wallets
- must remain Server Component friendly
- must not require wallet-provider access for rendering

### `/profile/[address]`
Purpose:
- staged public fallback only

Rules:
- visibility-gated
- must not become canonical again
- must not be used for Analyze Wallet intent
- may redirect receipt-first when a receipt exists

### `/receipt/[shareId]`
Purpose:
- canonical public share route

Rules:
- consent/public-share surface
- must remain separate from private analysis semantics
- receipt/public logic must not leak into analysis generation

---

## 4. Migration discipline

PumpMatch is in a controlled transitional state.

Claude must respect:

- v3 canonical, v2 transitional
- dual-emit is acceptable during migration
- adapters/projections are compatibility bridges only
- legacy surfaces may remain temporarily, but must not redefine canonical meaning
- do not remove working transitional layers without explicit migration intent
- do not broaden scope into rewrite/refactor unless requested

When changing code:
- preserve backward compatibility where possible
- prefer staged rollout over big-bang replacement
- prefer additive fields over breaking response changes
- prefer feature flags for surface-level migrations

---

## 5. Helius-first data policy

PumpMatch uses Helius as the preferred Solana data infrastructure.

### Core rule
When implementing Solana data access, prefer Helius-optimized APIs over manually composing raw Solana RPC chains.

### Why
PumpMatch needs:
- wallet analysis
- token/asset inventory
- transaction history
- low-latency reads
- indexed data for behavioral intelligence
- stable retry/rate-limit handling
- server-safe enrichments

Helius is preferred because it provides richer indexed data and reduces fragile multi-call RPC composition.

---

## 6. Helius endpoint decision table

Claude should follow this mapping by default.

### Wallet asset inventory
Prefer:
- `getAssetsByOwner`

Instead of:
- `getTokenAccountsByOwner`
- manual token account parsing

Use for:
- wallet holdings
- fungible/NFT inventory
- asset counts
- token diversity basis
- asset metadata enrichment

### Wallet transaction history / behavioral basis
Prefer:
- `getTransactionsForAddress`

Instead of chaining:
- `getSignaturesForAddress`
- `getTransaction`

Use for:
- wallet behavioral history
- event timing
- tx history enrichment
- activity pattern extraction

### Asset/NFT discovery / grouping
Prefer:
- `searchAssets`
- `getAssetsByGroup`

Instead of:
- `getProgramAccounts`

Use for:
- indexed discovery
- NFT/group scans
- collection/group lookups

### Priority / submission
Prefer:
- Helius Priority Fee API
- Sender
- Gatekeeper
when building latency-sensitive transaction flows

### Real-time infrastructure
Prefer:
- Enhanced WebSockets
- LaserStream
when building real-time features

Do not use these for normal SSR analyze route rendering unless explicitly justified.

---

## 7. PumpMatch-specific Helius usage rules

### Analyze route
Helius usage in `/analyze/[address]` must follow these rules:

- analysis must remain visibility-independent
- Helius failures must degrade safely
- optional enrichments must not crash analysis
- public/receipt/profile logic must not be involved
- Helius data should feed canonical intelligence, not redefine route semantics

### Core vs optional enrichment
Claude must distinguish between:

#### Core behavioral inputs
These may be required for analysis quality:
- transaction history basis
- wallet activity basis
- asset inventory basis
- behavioral signal extraction inputs

#### Optional enrichments
These must never hard-fail analysis:
- balances
- portfolio USD value
- fungible/NFT counts
- convenience metadata
- non-essential indexed extras

If optional Helius enrichments fail:
- analysis continues
- missing fields degrade gracefully
- user sees stable output
- raw internal Helius error never reaches UI

---

## 8. Failure handling policy

Claude must apply this matrix consistently.

### 404 / missing indexed data
Behavior:
- treat as missing data, not fatal application failure
- safe degrade for optional enrichments
- do not route-fallback into public/profile semantics
- do not leak internal error text to users

### 429 / rate limited
Behavior:
- retry with backoff
- respect `Retry-After` when available
- if retries fail, return typed rate-limited path where appropriate
- UI should show safe retry-later behavior, not raw infra error

### 5xx / upstream failure
Behavior:
- retry with exponential backoff
- after final failure, surface as upstream failure
- do not mislabel as not_found or rate_limited
- keep logs server-side and structured

### network timeout / abort
Behavior:
- retry if appropriate
- degrade optional enrichment when possible
- do not crash analysis unless the failed dependency is truly required

### user-facing rule
Never render raw internal Helius/Supabase/infrastructure error strings into the UI.

---

## 9. Security rules

Claude must preserve these rules strictly:

- Helius API key must remain server-only
- never expose Helius keys via `NEXT_PUBLIC_*`
- never call privileged Helius endpoints directly from client components
- Helius fetch wrappers should live in server-only modules
- no secret-bearing code in client bundles
- no accidental env leakage through logs or error messages

When touching env vars:
- prefer server-only modules
- preserve existing server/client boundaries
- do not move privileged fetches into the browser

---

## 10. Performance rules

Claude must optimize for correctness first, then low-fragility data paths.

### Prefer:
- one richer indexed call over many raw chained RPC calls
- deterministic server-side fetching
- minimal fan-out
- graceful degradation for optional enrichments
- no duplicate fetch paths in a single request when avoidable

### Avoid:
- `getProgramAccounts` when indexed Helius API is better
- redundant calls for the same wallet in one render path
- client-side privileged fetches
- optional enrichment bottlenecking the whole page
- broad refactors just to “clean up” code if a minimal patch is safer

### Cost/rate-limit awareness
Claude must keep in mind:
- Helius indexed APIs have credit cost
- fan-out affects both latency and cost
- analyze route should avoid unnecessary expensive calls
- indexed calls should replace multiple raw calls when it reduces both fragility and cost

---

## 11. V3 intelligence rules

Claude must preserve the current intelligence model direction:

- v3 is canonical
- deterministic signals feed axes
- axes feed primary style
- summary is deterministic/template-derived
- AI may explain results, but must not become the scoring/classification source

### Do not:
- reintroduce top-level score-first semantics
- make `trustScore` primary again
- treat compatibility as canonical
- use AI text as canonical report truth
- let public route state change analysis truth

### During migration:
- projection/adapters are transitional only
- v2 may remain as compatibility surface
- new code should prefer v3-first thinking

---

## 12. Legacy / transitional rules

Claude must treat these as transitional only:

- legacy compatibility fields
- trustScore
- v2 presentation surfaces
- v3 -> legacy projection bridges

When modifying them:
- keep them stable if still used
- do not expand their semantic role
- do not add new product meaning to them
- document clearly when a field is bridge-only

---

## 13. Wallet/provider rules

PumpMatch analyze surfaces must not depend on browser wallet providers unless explicitly required by the feature.

Claude must not:
- add `window.solana` dependencies to analyze route rendering
- require Phantom/Privy/provider access for private/default wallet analysis
- introduce wallet race conditions into analysis pages

If a feature truly needs provider access:
- isolate it clearly
- do not let it contaminate analysis rendering

---

## 14. Code change policy

When modifying this repo, Claude should:

1. Prefer minimal, safe diffs
2. Preserve working route boundaries
3. Preserve server/client boundaries
4. Prefer additive migration steps over rewrites
5. Avoid speculative abstraction
6. Keep existing behavior stable by default
7. Use feature flags for risky surface-level changes
8. Explain why a Helius path is better when replacing a raw RPC path

Claude should not:
- casually rewrite the intelligence stack
- merge public/share logic into analyze flow
- introduce new primary semantics without explicit product intent
- expand scope beyond the requested task

---

## 15. Required verification after changes

After any meaningful code change touching data flow, Claude should verify:

### Build / type safety
- `tsc --noEmit` passes
- build remains green

### Route safety
- no analyze -> profile fallback was introduced
- `/receipt/[shareId]` behavior unchanged unless explicitly requested
- `/profile/[address]` behavior unchanged unless explicitly requested

### Security
- no Helius key leakage
- no new client-side privileged Helius usage
- no raw internal error leakage to users

### Analysis resilience
- optional enrichment failure does not crash analysis
- 404 degrades safely
- 429 retries/backoff path still sane
- 5xx classification is honest

### Product semantics
- v3 remains canonical
- transitional fields remain transitional
- AI remains interpreter, not scorer

---

## 16. Claude Code / Helius plugin behavior

If Claude Code has Helius tooling/plugin/MCP available:

- prefer Helius tooling for docs lookup and structured Solana access
- prefer Helius-aware implementation patterns over ad hoc raw RPC composition
- use skills/instructions conservatively and in service of PumpMatch’s architecture
- do not let tool availability justify architecture drift

Tooling should help implementation quality.
Tooling must not override PumpMatch’s canonical product rules.

---

## 17. If unsure

If a change touches:
- analyze/profile/receipt boundaries
- canonical intelligence meaning
- Helius server/client security boundaries
- optional-vs-core enrichment behavior

Claude should choose the safer, more conservative implementation.

When in doubt:
- preserve route semantics
- preserve server-only secrets
- preserve v3 canonical truth
- degrade safely instead of failing loudly