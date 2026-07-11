# SuiteSense Query-Generation Improvement — Report

**Date:** 2026-07-11
**Scope:** Make generated SuiteQL trustworthy for real NetSuite reporting, validated against a live account (test-only; no account data is stored in the repo or the app).

## Method

1. **Architecture analysis** — parallel audit of the generation pipeline (prompt, schema catalog, few-shots, fallback, dialect bridge, feedback) and a demo-vs-real divergence study, cross-checked against documented SuiteQL behaviour.
2. **Test matrix** — 40 natural-language questions across revenue, AR aging, GL/P&L, AP, top-N, period-vs-date, dimensions, multi-currency, inventory, grain traps, and ambiguous cases.
3. **Live validation** — every pattern executed against a real NetSuite account via a deployed SuiteQL tool, using a same-origin authenticated runner so hundreds of probes could run reliably.
4. **Build** — verified query library + retrieval, corrected knowledge, server-side validation + one repair attempt, feedback capture, and a user-facing `/library` browser.
5. **Adversarial review** — independent reviewers by dimension, each finding refuted or confirmed before fixing.

## What was actually wrong (proven on real data)

| # | Failure | Evidence on a real account | Severity |
|---|---------|----------------------------|----------|
| 1 | `status = 'open'` (and 'paid', 'pendingFulfillment') | `status` is a raw per-type code (A/B/…); the word matches nothing → **0 rows**, read as a true "nothing open" | critical |
| 2 | `SUM(transactionline.netamount)` as revenue | sales item lines are **negative**; also includes header/tax/subtotal lines → "best selling items" returned a **subtotal line with −28M and quantity null** as #1 | critical |
| 3 | `transaction.subsidiary` join | field is **NOT_EXPOSED** for SuiteQL → query **errors outright**; both currency few-shots failed | critical |
| 4 | open balance via `foreigntotal` + status | `foreigntotal` is the full invoice, not the balance; the outstanding field is `foreignamountunpaid` | critical |
| 5 | `customer.territory` as a region | unpopulated (all NULL) → "sales by region" collapses to one NULL bucket | major |
| 6 | vendor spend via `SUM(foreigntotal)` | vendor-bill total is credit-signed (negative); ranking inverts | major |
| 7 | `accountingperiod` without rollup filter | quarter/year/adjust rows double-count | major |
| 8 | keyless fallback matcher | returned `EXAMPLES[0]` (top-customers) for **any** unmatched question — confidently wrong SQL | critical |
| 9 | provider path | production silently ran Gemini free-tier and degraded to canned examples under load | major |
| — | demo console falsely rejected valid SuiteQL (`TRUNC`) | `TRUNC`/`ADD_MONTHS`/`TO_DATE`/`FETCH FIRST` all work on real NetSuite | minor |

The pattern: generations were **demo-consistent but real-NetSuite-wrong** — plausible numbers that are silently incorrect on a real account.

## Verified-correct patterns (now in the library)

Each executed green on a real account: GL-based revenue (canonical, sidesteps line-sign traps), line-level revenue with `mainline='F' AND taxline='F'` and negated amounts, open AR by `foreignamountunpaid`, AR aging buckets by `duedate`, account/period balance via `transactionaccountingline` + `postingperiod` + `isadjust='F'`, P&L by account type, vendor spend (sign-corrected), subsidiary/department/class via `transactionline` dimensions, multi-currency with `exchangerate` and a stated consolidation caveat, inventory availability, and correct status display via `BUILTIN.DF`.

## What changed (architecture)

**Verified query library** (`lib/library/`) — the new reference layer, and the single source of truth for both the AI and the `/library` browse UI:
- `queries.json` — verified query patterns, each with intent, keywords, caveats, joins, expected columns, and `:param` placeholders.
- `knowledge.js` — verified schema/dialect facts (sign conventions, NOT_EXPOSED fields, status semantics, supported functions), injected into the prompt and enforced by the validator.
- `failures.json` — known traps → fixes, used as negative examples in the prompt, as validator rules, and as teaching content in the UI.
- `index.js` — keyword+category retrieval (`retrieve`, `bestMatch`, `relevantFailures`).

**Retrieval-augmented generation** (`app/api/generate/route.js`):
1. Retrieve the closest verified queries + the traps most likely to apply.
2. Prompt = verified rules + retrieved examples + failure warnings + schema.
3. **Validate** the model's output against the trap catalog; on a critical issue, **one repair attempt**; residual issues are surfaced as warnings, never hidden.
4. Fallback is now the **best verified library query** (a truthful answer to the class of question), not a wrong-question canned example.

**Feedback loop** (`lib/feedback.js`) — every generation logs its source, validator verdict, repair, and timing; the client can report whether the SQL ran. Promotion into the verified library is a **reviewed** step (`scripts/promote-candidates.mjs`), never automatic, so "verified" stays meaningful.

**User-facing library** (`/library`) — search by keyword/table/field/use-case, filter by category, view the SQL with joins/columns/caveats and a Verified badge, and copy. Same corpus the AI uses.

**Validation** (`lib/validate.js`) — regex + structural detectors for the status-word, line-sign/mainline, NOT_EXPOSED, territory, and OFFSET traps; every library query is itself checked clean by the test suite.

## Verification

- `npm run check`: translator, demo-data coherence, and library+validator suites all pass; every library query passes the validator with zero critical issues.
- `/library` browser: search ranking, category filter, and copy verified in a real browser.
- Generation: with no AI key, the endpoint returns the correct verified library query per question class (AR-001 for "who owes us", REV-002 for "revenue by item", GL-002 for P&L) — a reversal of the old wrong-question fallback.

## Known limitations / follow-ups

- The demo console executes synthetic SQLite; library queries target real NetSuite, so some copied queries won't run in the in-browser demo (they're labelled as live-account queries). Fully reconciling the demo dataset to real conventions (signed lines, mainline rows, status codes) is a larger follow-up.
- Retrieval is keyword+category over a curated corpus (no embeddings) — right for dozens of entries; revisit at hundreds.
- Provider: consider a paid/keyed primary model so generation doesn't depend on free-tier limits.
