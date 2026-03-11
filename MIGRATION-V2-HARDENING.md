# Intelligence Core v2 — Migration Hardening (Phase 2A.5)

**Status:** Internal reference  
**Scope:** Allowed transitional inventory and regression checklist after Phase 2A.5  
**Canonical spec:** `intelligence-core-v2.md`

---

## 1. Allowed transitional inventory

The following fields remain **intentionally** for backward compatibility and staged migration. They are **not** canonical Intelligence Core v2 truth.

| Item | Where | Why it remains | Layer |
|------|--------|----------------|-------|
| `trustScore` | WalletAnalysis, PublicProfileDTO, MatchProfile, UserProfile, API responses | Legacy scalar used by join/match/UI; v2 prefers `intelligenceReport.legacyTrustScore` and multi-axis scores. | Compatibility |
| Top-level `scoreLabel` | WalletAnalysis, PublicProfileDTO | Mirror of `intelligenceSummary.scoreLabel` for existing consumers; canonical is `intelligenceSummary.scoreLabel`. | Compatibility |
| `behavioral.confidenceLabel` | BehavioralMetrics, public DTOs | Deprecated alias for `evidenceSources`; some callers still read it. | Compatibility |
| `WalletAnalysis.intent` | WalletAnalysis (optional) | Coordination mirror for joinNetwork/preview; canonical intent is `UserProfile.intent`. | Coordination |
| `AnalyzeWalletResponse.matches` | Response when `includePreviewMatches` is true | Optional preview matches; not part of intelligence output. Attached only at response edge. | Coordination |

**Rules:**

- Do not remove these without a dedicated migration step and consumer audit.
- New code should prefer canonical fields: `intelligenceReport`, `intelligenceSummary`, `intelligenceConfidence`, style/quality/risk axes.
- Public/profile surfaces are intelligence-first; compatibility/coordination fields are secondary.

---

## 2. Regression checklist

Use this checklist when touching migration-touched code or before releases.

### Profile / receipt redirect

- [ ] `/profile/[address]` redirects to `/receipt/[shareId]` when a valid public receipt exists for that address.
- [ ] When no receipt exists, `/profile/[address]` shows staged fallback (visibility-gated) and does not redirect.
- [ ] OG/Twitter images for profile route: receipt-first when receipt exists; otherwise staged profile card.

### API error mapping

- [ ] `GET /api/profile/[address]`: 400 invalid_address, 403 not_public, 404 not_found / snapshot_unavailable; 500 on failure.
- [ ] Response shape unchanged; no new required fields.

### Arena bridge fallback

- [ ] Arena project/squad flows still receive `scoreLabel`, `primaryStyle`, `confidenceTier`, etc. from bridge when available.
- [ ] Fallback when bridge or snapshot missing does not break Arena UI.

### analyzeWallet optional coordination

- [ ] Without `includePreviewMatches`, response has no `matches` field (or it is undefined).
- [ ] With `includePreviewMatches`, `matches` is attached at response edge; cache does not store matches.
- [ ] Canonical + compatibility assembly unchanged; coordination is additive only.

### Command-center / squad action result normalization

- [ ] Squad join/leave/invite/apply actions return expected success/error shapes.
- [ ] No reliance on removed or renamed fields in result handling.

---

## 3. Build and scope

- Build: `npm run build` must pass.
- Scope: Type and comment changes only in migration-touched files; no DB schema or route contract changes in this pass.
- Casts / `Record<string, unknown>` in Supabase row mapping and `globalThis` are acceptable; do not broaden into a lint crusade.

---

## 4. References

- **Canonical spec:** `intelligence-core-v2.md`
- **Repo status:** `README.md` — "Repository Status"
- **Receipt-first route semantics:** `lib/receipts.ts` (getLatestPublicReceipt), `app/profile/[address]/page.tsx` (redirect)
- **Intelligence assembly:** `app/actions/analyzeWallet.ts` (canonical → compatibility → optional coordination)
