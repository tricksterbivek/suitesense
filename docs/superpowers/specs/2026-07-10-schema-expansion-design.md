# SuiteSense Schema Expansion — Design

**Date:** 2026-07-10
**Status:** Approved (all four families, one-shot release)

## Goal

Grow the demo schema catalog from 5 tables (`transaction`, `transactionline`,
`customer`, `item`, `employee`) to 17, so the console can answer dimension,
procure-to-pay, GL/finance, inventory, multi-currency, audit-trail, and
custom-record questions — the spread of what NetSuite devs and admins actually
ask in SuiteQL.

Non-goal: live NetSuite mode, FX rate history, bin-level inventory, saved
queries. Roadmap unchanged.

## Where schemas live (unchanged mechanics)

`lib/schema.js` `TABLES` is the single source of truth: it renders the UI
sidebar (`app/page.js`) and builds the AI prompt (`schemaPromptText()` in
`app/api/generate/route.js`). Every table is mirrored by deterministic seed
rows in `lib/demoData.js`, created as real SQLite tables in `lib/sqlite.js`.
Adding a schema touches: catalog entry → DDL + seeder → (usually) one few-shot
in `lib/examples.js`.

## 1. New tables (12)

Field names follow real SuiteQL analytics tables so queries transfer to live
accounts.

| Table | Key columns | Seed size |
|---|---|---|
| `subsidiary` | id, name, currency→currency.id, country | 3 (AU parent, US, UK) |
| `location` | id, name, subsidiary→subsidiary.id | 5 |
| `department` | id, name | 4 (Sales, Professional Services, Support, G&A) |
| `classification` | id, name | 3 (Hardware, Software, Services) |
| `currency` | id, name, symbol | 4 (AUD, USD, GBP, EUR) |
| `vendor` | id, entityid `VEND-2xx`, companyname, email, category, subsidiary | 15, ids 101–115 |
| `account` | id, acctnumber, fullname, accttype | ~12 (Bank, AcctRec, AcctPay, Income, COGS, Expense, …) |
| `accountingperiod` | id, periodname `Jul 2024`, startdate, enddate, closed | 24 (Jul 2024–Jun 2026; closed ≤ Mar 2026) |
| `transactionaccountingline` | transaction→transaction.id, account→account.id, debit, credit, posting `T/F` | ~1,600 |
| `inventorybalance` | item→item.id, location→location.id, quantityonhand, quantityavailable | InvtPart × location (~50) |
| `systemnote` | recordtype, recordid, field, oldvalue, newvalue, name→employee.id, date | ~80 |
| `customrecord_warranty_claim` | id, name `WC-xxx`, custrecord_wc_customer→customer.id, custrecord_wc_item→item.id, custrecord_wc_status, custrecord_wc_amount, created | ~30 |

## 2. Extended existing tables

- `transaction` += `subsidiary`, `currency`, `exchangerate`, `postingperiod`
  →accountingperiod.id, `location`. `type` gains `VendBill`, `PurchOrd`,
  `VendPymt` (tranid prefixes `BILL-`, `PO-`, `VPAY-`). `entity` column note
  becomes: "joins customer.id or vendor.id depending on type" (polymorphic,
  as in real NetSuite).
- `transactionline` += `department`, `class`→classification.id, `location`
  (line grain is where these dimensions live in real NetSuite).
- `employee` += `department`.
- Each `TABLES` entry gains a `family` label; the sidebar groups by it
  (~10 lines in `page.js`) so 17 tables stay scannable.

## 3. Demo data coherence rules

- **Entity id space is shared and non-overlapping**: customers 1–40, vendors
  101–115. The polymorphic `entity` join can never return a wrong-type row.
- **Volume**: 420 AR transactions plus ~160 AP transactions in the same
  2-year window ending mid-2026. Same PRNG seed; the dataset stays
  deterministic for every visitor, but specific values may shift from today's
  build because new columns add draws to the stream — acceptable, nothing
  depends on current numbers.
- **GL generation per type** (amounts in AUD base, noted in schema):
  - `CustInvc`: DR Accounts Receivable / CR Income (income account per line class)
  - `CustPymt`: DR Bank / CR Accounts Receivable
  - `CustCred`: reverse of invoice
  - `VendBill`: DR COGS or Expense / CR Accounts Payable
  - `VendPymt`: DR Accounts Payable / CR Bank
  - `SalesOrd`, `PurchOrd`: **posting='F', zero GL rows** — deliberate, the
    classic "why isn't my order in the P&L" teaching moment.
- **Currency, demo-simple**: transaction.currency = its subsidiary's
  currency; static rates (AUD 1.0, USD/GBP/EUR fixed constants). Schema note
  says rates are static so the AI states it.
- **AP feeds inventory**: vendor bills mostly restock InvtPart items;
  `quantityavailable` ≈ quantityonhand − open sales-order commitments.
  Approximate, flagged as such in the column note.
- **postingperiod** derived from trandate.
- **systemnote** rows are plausible edits (status/salesrep/territory changes)
  attributed to employees, dated after the record exists.

## 4. Prompt & examples

Eight new few-shots in `lib/examples.js`, one per unlocked family — also the
keyless fallback library, so `matchExample` keywords expand to match:

1. P&L by month (`transactionaccountingline` + `account.accttype`, `posting='T'`)
2. Top vendors by spend
3. Open vendor bills (AP)
4. Revenue by department (line-level join)
5. Stock on hand by location
6. Audit trail for a customer (`systemnote`)
7. Open warranty claims (`customrecord_warranty_claim`)
8. Revenue in base currency via `exchangerate`

Schema prompt grows ~40 → ~130 lines (still ~1.5k tokens). Join hints stay in
column notes — the pattern that already steers the model today.

## 5. Translator & guards

No new dialect constructs: new examples reuse `TO_CHAR`, `NVL`, `FETCH
FIRST`, `ADD_MONTHS`. Verified: the reserved-word regex
`\btransaction\b(?!line)` cannot mangle `transactionaccountingline` — there
is no word boundary inside a longer identifier. `isReadOnly` guard unchanged.

## 6. Verification (extends `npm run check`)

New `lib/demoData.test.mjs` (plain node asserts, same style as
`translate.test.mjs`):

- Debits = credits per posting transaction, to the cent.
- `SalesOrd`/`PurchOrd` have zero `transactionaccountingline` rows.
- FK integrity across every table (including polymorphic entity-by-type).
- Determinism: two `buildDemoData()` calls produce identical JSON.
- Every example in `lib/examples.js` executes against the seeded DB without
  error and returns ≥ 1 row.

## 7. Risks

- 17 tables → occasional wrong join path from the model. Mitigation:
  per-family few-shots + join hints in notes (existing pattern).
- Keyword-overlap fallback matcher collisions as EXAMPLES grows. Mitigation:
  distinct keyword sets, checked by the example-execution test.

## 8. Build order (single release)

dimensions → vendor/AP → GL → inventory/currency → dev extras — each step
interlocks with the next (GL needs vendors, inventory needs locations,
currency needs subsidiaries).
