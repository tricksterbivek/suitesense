# SuiteSense Schema Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the demo schema catalog from 5 to 17 NetSuite SuiteQL tables (dimensions, procure-to-pay, GL, inventory, currency, audit trail, custom record) with coherent deterministic seed data, per the approved spec at `docs/superpowers/specs/2026-07-10-schema-expansion-design.md`.

**Architecture:** `lib/schema.js` stays the single source of truth (prompt + sidebar). A new `lib/seed.js` owns DDL + inserts so browser (`lib/sqlite.js`) and node tests share one schema. `lib/demoData.js` generates all families from one seeded PRNG initialized *inside* `buildDemoData()` (required for the determinism test). GL rows are derived from transactions so debits always equal credits by construction.

**Tech Stack:** Next.js 15 (plain JS, ESM), sql.js (wasm SQLite), plain `node:assert` tests run by `npm run check`.

## Global Constraints

- Field/table names follow real SuiteQL analytics tables (spec §1).
- Customers ids 1–40, vendors ids 101–115 — never overlapping (spec §3).
- `SalesOrd`/`PurchOrd` are non-posting: zero `transactionaccountingline` rows (spec §3).
- GL amounts in AUD base; static FX rates (spec §3).
- All demo data from one PRNG seed `20260703`; two `buildDemoData()` calls must be identical.
- No new dependencies. No new dialect constructs in examples (only `TO_CHAR`, `NVL`, `FETCH FIRST`, `ADD_MONTHS`, `SYSDATE`).
- Git: commit as signed-in user, no Co-Authored-By lines (user CLAUDE.md).

---

### Task 1: Determinism refactor + shared seeding module

**Files:**
- Modify: `lib/demoData.js` (move PRNG init inside `buildDemoData`)
- Create: `lib/seed.js` (DDL + inserts, shared browser/node)
- Modify: `lib/sqlite.js` (delegate to `seedDb`)
- Create: `lib/demoData.test.mjs` (determinism + example-execution asserts)
- Modify: `package.json` (`check` runs both test files)

**Interfaces:**
- Produces: `seedDb(db) -> data` — runs DDL and inserts on an open sql.js `Database`, returns the built dataset. `buildDemoData()` — pure, deterministic, no module-level PRNG state.

- [ ] **Step 1: Write failing test** — `lib/demoData.test.mjs`:

```js
import assert from 'node:assert';
import initSqlJs from 'sql.js';
import { buildDemoData } from './demoData.js';
import { seedDb } from './seed.js';
import { EXAMPLES } from './examples.js';
import { suiteqlToSqlite } from './translate.js';

const data = buildDemoData();

// Determinism: a second build is byte-identical (PRNG must init per call)
assert.deepStrictEqual(buildDemoData(), data, 'buildDemoData must be deterministic');

// Every curated example executes against the seeded DB and returns rows
const SQL = await initSqlJs();
const db = new SQL.Database();
seedDb(db);
for (const ex of EXAMPLES) {
  const res = db.exec(suiteqlToSqlite(ex.sql));
  assert.ok(res.length > 0 && res[0].values.length > 0, `example returned no rows: ${ex.question}`);
}

console.log(`demoData: checks passed (${data.transactions.length} txns, ${EXAMPLES.length} examples executed)`);
```

- [ ] **Step 2: Run to verify failure** — `node lib/demoData.test.mjs`. Expected: FAIL (`seed.js` missing; then determinism assert fails against current module-level PRNG).

- [ ] **Step 3: Implement** — in `lib/demoData.js`, delete module-level `const rand/pick/between` and put them at the top of `buildDemoData()`:

```js
export function buildDemoData() {
  const rand = mulberry32(20260703);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  // ... existing body unchanged ...
}
```

Create `lib/seed.js` with the current 5-table DDL/inserts moved verbatim from `sqlite.js` (table list grows in Task 2):

```js
// Creates and seeds the demo schema on an open sql.js Database.
// Shared by the browser (lib/sqlite.js) and node tests.
import { buildDemoData } from './demoData.js';

const DDL = `
  CREATE TABLE customer (id INTEGER PRIMARY KEY, entityid TEXT, companyname TEXT, email TEXT, datecreated TEXT, salesrep INTEGER, territory TEXT);
  CREATE TABLE item (id INTEGER PRIMARY KEY, itemid TEXT, displayname TEXT, itemtype TEXT, baseprice REAL);
  CREATE TABLE employee (id INTEGER PRIMARY KEY, entityid TEXT, firstname TEXT, lastname TEXT, title TEXT);
  CREATE TABLE "transaction" (id INTEGER PRIMARY KEY, tranid TEXT, type TEXT, entity INTEGER, trandate TEXT, status TEXT, foreigntotal REAL, employee INTEGER, memo TEXT);
  CREATE TABLE transactionline (id INTEGER PRIMARY KEY, "transaction" INTEGER, item INTEGER, quantity REAL, rate REAL, netamount REAL);
`;

const INSERTS = [
  ['customer', 'customers', ['id', 'entityid', 'companyname', 'email', 'datecreated', 'salesrep', 'territory']],
  ['item', 'items', ['id', 'itemid', 'displayname', 'itemtype', 'baseprice']],
  ['employee', 'employees', ['id', 'entityid', 'firstname', 'lastname', 'title']],
  ['"transaction"', 'transactions', ['id', 'tranid', 'type', 'entity', 'trandate', 'status', 'foreigntotal', 'employee', 'memo']],
  ['transactionline', 'lines', ['id', 'transaction', 'item', 'quantity', 'rate', 'netamount']],
];

export function seedDb(db) {
  db.run(DDL);
  const data = buildDemoData();
  for (const [table, key, cols] of INSERTS) {
    const stmt = db.prepare(`INSERT INTO ${table} VALUES (${cols.map(() => '?').join(',')})`);
    for (const row of data[key]) stmt.run(cols.map((c) => row[c]));
    stmt.free();
  }
  return data;
}
```

Rewrite `lib/sqlite.js` `createDb` to use it:

```js
import initSqlJs from 'sql.js';
import { seedDb } from './seed.js';
import { suiteqlToSqlite, isReadOnly } from './translate.js';

let dbPromise = null;

async function createDb() {
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const db = new SQL.Database();
  seedDb(db);
  return db;
}
```

(`getDb`/`runSuiteQL` unchanged.) Update `package.json`:

```json
"check": "node lib/translate.test.mjs && node lib/demoData.test.mjs"
```

- [ ] **Step 4: Verify** — `npm run check`. Expected: both files pass, `10 examples executed`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "refactor: per-call PRNG + shared seed module for node tests"`

---

### Task 2: Full data model — catalog, seed data, coherence asserts

**Files:**
- Rewrite: `lib/schema.js` (17 tables, `family` field on every entry, grouped `schemaPromptText`)
- Rewrite: `lib/demoData.js` (all families)
- Modify: `lib/seed.js` (full DDL + inserts)
- Modify: `lib/demoData.test.mjs` (coherence asserts)

**Interfaces:**
- Consumes: Task 1's `seedDb`/deterministic `buildDemoData`.
- Produces: `buildDemoData()` returns `{ customers, vendors, items, employees, subsidiaries, locations, departments, classifications, currencies, accounts, accountingperiods, transactions, lines, accountinglines, inventorybalances, systemnotes, warrantyclaims }`. Every `TABLES` entry has `family: string`. Task 3 relies on these exact key names and on new transaction columns `currency, exchangerate, subsidiary, location, postingperiod` and line columns `department, class, location`.

- [ ] **Step 1: Write failing asserts** — append to `lib/demoData.test.mjs` (before the example-execution block):

```js
// --- GL: debits equal credits per posting transaction, to the cent ---
const glByTxn = new Map();
for (const g of data.accountinglines) {
  const e = glByTxn.get(g.transaction) ?? { debit: 0, credit: 0 };
  e.debit += g.debit;
  e.credit += g.credit;
  glByTxn.set(g.transaction, e);
}
for (const [txnId, { debit, credit }] of glByTxn) {
  assert.ok(Math.abs(debit - credit) < 0.005, `GL unbalanced for txn ${txnId}: DR ${debit} CR ${credit}`);
}

// --- Orders never post; everything else does ---
const orderIds = new Set(data.transactions.filter((t) => t.type === 'SalesOrd' || t.type === 'PurchOrd').map((t) => t.id));
assert.ok(data.accountinglines.every((g) => !orderIds.has(g.transaction)), 'orders must have no GL rows');
for (const t of data.transactions) {
  if (!orderIds.has(t.id)) assert.ok(glByTxn.has(t.id), `posting txn ${t.id} has no GL rows`);
}

// --- FK integrity (incl. polymorphic entity) ---
const ids = (arr) => new Set(arr.map((r) => r.id));
const customerIds = ids(data.customers), vendorIds = ids(data.vendors), itemIds = ids(data.items),
  employeeIds = ids(data.employees), locationIds = ids(data.locations), periodIds = ids(data.accountingperiods),
  accountIds = ids(data.accounts), subsidiaryIds = ids(data.subsidiaries), deptIds = ids(data.departments),
  classIds = ids(data.classifications), currencyIds = ids(data.currencies), txnIds = ids(data.transactions);
const AP_TYPES_SET = new Set(['VendBill', 'PurchOrd', 'VendPymt']);
for (const v of vendorIds) assert.ok(!customerIds.has(v), 'entity id spaces must not overlap');
for (const t of data.transactions) {
  assert.ok((AP_TYPES_SET.has(t.type) ? vendorIds : customerIds).has(t.entity), `txn ${t.id} entity`);
  assert.ok(subsidiaryIds.has(t.subsidiary) && locationIds.has(t.location) && currencyIds.has(t.currency) && periodIds.has(t.postingperiod), `txn ${t.id} dimension FKs`);
  if (t.employee != null) assert.ok(employeeIds.has(t.employee), `txn ${t.id} employee`);
}
for (const l of data.lines) assert.ok(txnIds.has(l.transaction) && itemIds.has(l.item) && deptIds.has(l.department) && classIds.has(l.class) && locationIds.has(l.location), `line ${l.id} FKs`);
for (const g of data.accountinglines) assert.ok(txnIds.has(g.transaction) && accountIds.has(g.account), 'GL FKs');
for (const b of data.inventorybalances) {
  assert.ok(itemIds.has(b.item) && locationIds.has(b.location), 'inventory FKs');
  assert.ok(b.quantityavailable <= b.quantityonhand && b.quantityavailable >= 0, 'available within [0, onhand]');
}
for (const n of data.systemnotes) assert.ok((n.recordtype === 'customer' ? customerIds : txnIds).has(n.recordid) && employeeIds.has(n.name), 'systemnote FKs');
for (const w of data.warrantyclaims) assert.ok(customerIds.has(w.custrecord_wc_customer) && itemIds.has(w.custrecord_wc_item), 'warranty FKs');

// --- Catalog families present ---
import('./schema.js').then(({ TABLES }) => {
  assert.equal(TABLES.length, 17, 'catalog must list 17 tables');
  assert.ok(TABLES.every((t) => typeof t.family === 'string' && t.family), 'every table needs a family');
});
```

- [ ] **Step 2: Run to verify failure** — `node lib/demoData.test.mjs`. Expected: FAIL (`data.accountinglines` undefined).

- [ ] **Step 3: Implement the data model.** Full target content of `lib/demoData.js` (COMPANIES/ITEMS/EMPLOYEES arrays unchanged from current file, elided here with `/* unchanged */`):

```js
// Deterministic demo dataset shaped like a small NetSuite account.
// Seeded PRNG (re-initialized per build) so every visitor sees the same numbers.
function mulberry32(seed) { /* unchanged */ }

const COMPANIES = [/* unchanged 40 names */];
const ITEMS = [/* unchanged 20 rows */];
const EMPLOYEES = [/* unchanged 5 rows */];
const TERRITORIES = ['APAC', 'EMEA', 'AMER'];

const VENDORS = [
  ['Shenzhen Circuit Works', 'Inventory'], ['Pacific Component Co', 'Inventory'],
  ['Quantum Chip Distributors', 'Inventory'], ['Ergo Furniture Supply', 'Inventory'],
  ['Fiber Optic Direct', 'Inventory'], ['Global Freight Partners', 'Logistics'],
  ['Titan Logistics', 'Logistics'], ['Harbourline Customs Brokers', 'Logistics'],
  ['Meridian Office Supplies', 'Office'], ['Apex Cleaning Group', 'Office'],
  ['Southbank Legal Services', 'Services'], ['Talent Bridge Recruiting', 'Services'],
  ['Crestline Insurance', 'Services'], ['NetServe ISP', 'Utilities'],
  ['PowerGrid Utilities', 'Utilities'],
];

const CURRENCIES = [
  { id: 1, name: 'AUD', symbol: 'A$' }, { id: 2, name: 'USD', symbol: '$' },
  { id: 3, name: 'GBP', symbol: '£' }, { id: 4, name: 'EUR', symbol: '€' },
];
const FX_TO_AUD = { 1: 1.0, 2: 1.52, 3: 1.92, 4: 1.65 };

const SUBSIDIARIES = [
  { id: 1, name: 'SuiteSense AU (HQ)', currency: 1, country: 'AU' },
  { id: 2, name: 'SuiteSense US', currency: 2, country: 'US' },
  { id: 3, name: 'SuiteSense UK', currency: 3, country: 'GB' },
];
const TERRITORY_SUBSIDIARY = { APAC: 1, AMER: 2, EMEA: 3 };

const LOCATIONS = [
  { id: 1, name: 'Sydney Warehouse', subsidiary: 1 },
  { id: 2, name: 'Melbourne Office', subsidiary: 1 },
  { id: 3, name: 'Austin Warehouse', subsidiary: 2 },
  { id: 4, name: 'San Jose Office', subsidiary: 2 },
  { id: 5, name: 'London Warehouse', subsidiary: 3 },
];
const DEPARTMENTS = [
  { id: 1, name: 'Sales' }, { id: 2, name: 'Professional Services' },
  { id: 3, name: 'Support' }, { id: 4, name: 'General & Administrative' },
];
const CLASSES = [
  { id: 1, name: 'Hardware' }, { id: 2, name: 'Software' }, { id: 3, name: 'Services' },
];

// Item prefix -> line dimensions. HW/SW sell through Sales; SV-SUP is Support,
// other SV-* is Professional Services; NI-* (shipping etc.) books to Sales.
function itemDims(itemid) {
  if (itemid.startsWith('HW-')) return { class: 1, department: 1 };
  if (itemid.startsWith('SW-')) return { class: 2, department: 1 };
  if (itemid.startsWith('SV-SUP')) return { class: 3, department: 3 };
  if (itemid.startsWith('SV-')) return { class: 3, department: 2 };
  return { class: 3, department: 1 };
}

const ACCOUNTS = [
  { id: 1, acctnumber: '1000', fullname: 'Operating Bank Account', accttype: 'Bank' },
  { id: 2, acctnumber: '1100', fullname: 'Accounts Receivable', accttype: 'AcctRec' },
  { id: 3, acctnumber: '1200', fullname: 'Inventory Asset', accttype: 'OthCurrAsset' },
  { id: 4, acctnumber: '2000', fullname: 'Accounts Payable', accttype: 'AcctPay' },
  { id: 5, acctnumber: '2100', fullname: 'GST Payable', accttype: 'OthCurrLiab' },
  { id: 6, acctnumber: '4000', fullname: 'Hardware Sales', accttype: 'Income' },
  { id: 7, acctnumber: '4100', fullname: 'Software & Licensing Income', accttype: 'Income' },
  { id: 8, acctnumber: '4200', fullname: 'Services Income', accttype: 'Income' },
  { id: 9, acctnumber: '5000', fullname: 'Cost of Goods Sold', accttype: 'COGS' },
  { id: 10, acctnumber: '6000', fullname: 'Freight & Logistics Expense', accttype: 'Expense' },
  { id: 11, acctnumber: '6100', fullname: 'Office & Utilities Expense', accttype: 'Expense' },
  { id: 12, acctnumber: '6200', fullname: 'Professional Fees Expense', accttype: 'Expense' },
];
const INCOME_BY_CLASS = { 1: 6, 2: 7, 3: 8 };
const EXPENSE_BY_VENDOR_CATEGORY = { Inventory: 9, Logistics: 10, Office: 11, Utilities: 11, Services: 12 };

const AR_TYPES = ['CustInvc', 'CustInvc', 'CustInvc', 'SalesOrd', 'SalesOrd', 'CustPymt', 'CustCred'];
const AP_TYPES = ['VendBill', 'VendBill', 'VendBill', 'PurchOrd', 'PurchOrd', 'VendPymt'];
const STATUSES = {
  CustInvc: ['open', 'paid', 'paid', 'paid'],
  SalesOrd: ['pendingFulfillment', 'closed', 'closed'],
  CustPymt: ['paid'],
  CustCred: ['closed'],
  VendBill: ['open', 'paid', 'paid'],
  PurchOrd: ['pendingReceipt', 'closed', 'closed'],
  VendPymt: ['paid'],
};
const TRANID_PREFIX = { CustInvc: 'INV', SalesOrd: 'SO', CustPymt: 'PAY', CustCred: 'CM', VendBill: 'BILL', PurchOrd: 'PO', VendPymt: 'VPAY' };

function isoDate(y, m, d) { /* unchanged */ }

function addDaysCapped(iso, days) {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  const out = dt.toISOString().slice(0, 10);
  return out > '2026-06-28' ? '2026-06-28' : out;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Jul 2024 (id 1) .. Jun 2026 (id 24); closed through Mar 2026.
function buildPeriods() {
  const periods = [];
  for (let i = 0; i < 24; i++) {
    const y = 2024 + Math.floor((i + 6) / 12);
    const m = ((i + 6) % 12) + 1;
    periods.push({
      id: i + 1,
      periodname: `${MONTH_NAMES[m - 1]} ${y}`,
      startdate: isoDate(y, m, 1),
      enddate: isoDate(y, m, MONTH_DAYS[m - 1]),
      closed: y < 2026 || m <= 3 ? 'T' : 'F',
    });
  }
  return periods;
}

// GL rows for one transaction. Amounts in AUD base (foreign * exchangerate),
// rounded per row; header row equals the sum of rounded rows, so debits and
// credits balance by construction. Orders (SalesOrd/PurchOrd) never post.
function glFor(txn, txnLines, vendorCategory) {
  const rows = [];
  if (txn.type === 'SalesOrd' || txn.type === 'PurchOrd') return rows;
  const base = (amt) => Math.round(Math.abs(amt) * txn.exchangerate * 100) / 100;
  const add = (account, debit, credit) => rows.push({ transaction: txn.id, account, debit, credit, posting: 'T' });
  const cents = (n) => Math.round(n * 100) / 100;
  if (txn.type === 'CustInvc' || txn.type === 'CustCred') {
    const byAccount = new Map();
    for (const l of txnLines) {
      const acct = INCOME_BY_CLASS[l.class];
      byAccount.set(acct, cents((byAccount.get(acct) ?? 0) + base(l.netamount)));
    }
    let total = 0;
    for (const [acct, amt] of byAccount) {
      total = cents(total + amt);
      if (txn.type === 'CustInvc') add(acct, 0, amt);
      else add(acct, amt, 0);
    }
    if (txn.type === 'CustInvc') add(2, total, 0);
    else add(2, 0, total);
  } else if (txn.type === 'CustPymt') {
    const total = base(txn.foreigntotal);
    add(1, total, 0);
    add(2, 0, total);
  } else if (txn.type === 'VendBill') {
    const total = base(txn.foreigntotal);
    add(EXPENSE_BY_VENDOR_CATEGORY[vendorCategory], total, 0);
    add(4, 0, total);
  } else if (txn.type === 'VendPymt') {
    const total = base(txn.foreigntotal);
    add(4, total, 0);
    add(1, 0, total);
  }
  return rows;
}

export function buildDemoData() {
  const rand = mulberry32(20260703);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

  const customers = COMPANIES.map((name, i) => {
    const territory = pick(TERRITORIES);
    return {
      id: i + 1,
      entityid: `CUST-${100 + i}`,
      companyname: name,
      email: `accounts@${name.toLowerCase().replace(/[^a-z]/g, '')}.example.com`,
      datecreated: isoDate(between(2023, 2025), between(1, 12), between(1, 28)),
      salesrep: between(1, EMPLOYEES.length),
      territory,
      subsidiary: TERRITORY_SUBSIDIARY[territory],
    };
  });

  const vendors = VENDORS.map(([companyname, category], i) => ({
    id: 101 + i,
    entityid: `VEND-${201 + i}`,
    companyname,
    email: `billing@${companyname.toLowerCase().replace(/[^a-z]/g, '')}.example.com`,
    category,
    subsidiary: (i % 3) + 1,
  }));

  const items = ITEMS.map(([itemid, displayname, itemtype, baseprice], i) => ({
    id: i + 1, itemid, displayname, itemtype, baseprice, class: itemDims(itemid).class,
  }));

  const employees = EMPLOYEES.map(([id, entityid, firstname, lastname, title]) => ({
    id, entityid, firstname, lastname, title, department: 1,
  }));

  const accountingperiods = buildPeriods();
  const invParts = items.filter((it) => it.itemtype === 'InvtPart');
  const locationsOf = (sub) => LOCATIONS.filter((l) => l.subsidiary === sub);

  const transactions = [];
  const lines = [];
  const accountinglines = [];
  let lineId = 1;

  const pushTransaction = (t, type, entityRecord, isAP) => {
    const monthsBack = between(0, 23);
    const y = monthsBack < 7 ? 2026 : monthsBack < 19 ? 2025 : 2024;
    const m = monthsBack < 7 ? 7 - monthsBack : monthsBack < 19 ? 19 - monthsBack : 31 - monthsBack;
    const subsidiary = entityRecord.subsidiary;
    const currency = SUBSIDIARIES[subsidiary - 1].currency;
    const location = pick(locationsOf(subsidiary)).id;
    const txn = {
      id: t,
      tranid: `${TRANID_PREFIX[type]}-${1000 + t}`,
      type,
      entity: entityRecord.id,
      trandate: isoDate(y, m, between(1, 28)),
      status: pick(STATUSES[type]),
      foreigntotal: 0,
      currency,
      exchangerate: FX_TO_AUD[currency],
      subsidiary,
      location,
      postingperiod: (y - 2024) * 12 + m - 6,
      employee: isAP ? null : entityRecord.salesrep,
      memo: '',
    };
    const txnLines = [];
    const lineCount = type === 'CustPymt' || type === 'VendPymt' ? 1 : between(1, 5);
    let total = 0;
    for (let l = 0; l < lineCount; l++) {
      const item = isAP && (entityRecord.category === 'Inventory' || between(1, 10) <= 7)
        ? invParts[between(0, invParts.length - 1)]
        : items[between(0, items.length - 1)];
      const quantity = item.itemtype === 'Service' ? between(1, 3) : between(1, 12);
      const rate = isAP ? Math.round(item.baseprice * 0.6) : item.baseprice;
      const netamount = Math.round(quantity * rate * (0.9 + rand() * 0.2));
      const dims = itemDims(item.itemid);
      const line = { id: lineId++, transaction: t, item: item.id, quantity, rate, netamount, department: dims.department, class: dims.class, location };
      lines.push(line);
      txnLines.push(line);
      total += netamount;
    }
    txn.foreigntotal = type === 'CustCred' ? -total : total;
    transactions.push(txn);
    accountinglines.push(...glFor(txn, txnLines, isAP ? entityRecord.category : null));
  };

  for (let t = 1; t <= 420; t++) pushTransaction(t, pick(AR_TYPES), customers[between(1, customers.length) - 1], false);
  for (let t = 421; t <= 580; t++) pushTransaction(t, pick(AP_TYPES), vendors[between(0, vendors.length - 1)], true);

  // Stock on hand; available = onhand minus open sales-order commitments.
  const linesByTxn = new Map();
  for (const l of lines) {
    if (!linesByTxn.has(l.transaction)) linesByTxn.set(l.transaction, []);
    linesByTxn.get(l.transaction).push(l);
  }
  const committed = new Map();
  for (const txn of transactions) {
    if (txn.type !== 'SalesOrd' || txn.status !== 'pendingFulfillment') continue;
    for (const l of linesByTxn.get(txn.id) ?? []) {
      const key = `${l.item}|${l.location}`;
      committed.set(key, (committed.get(key) ?? 0) + l.quantity);
    }
  }
  const inventorybalances = [];
  for (const item of invParts) {
    for (const loc of LOCATIONS) {
      const quantityonhand = between(20, 400);
      const c = committed.get(`${item.id}|${loc.id}`) ?? 0;
      inventorybalances.push({ item: item.id, location: loc.id, quantityonhand, quantityavailable: Math.max(0, quantityonhand - c) });
    }
  }

  const systemnotes = [];
  for (let i = 0; i < 40; i++) {
    const c = customers[between(1, customers.length) - 1];
    const field = pick(['salesrep', 'territory']);
    systemnotes.push({
      recordtype: 'customer',
      recordid: c.id,
      field,
      oldvalue: field === 'salesrep' ? String(c.salesrep) : c.territory,
      newvalue: field === 'salesrep' ? String(between(1, EMPLOYEES.length)) : pick(TERRITORIES),
      name: between(1, EMPLOYEES.length),
      date: addDaysCapped(c.datecreated, between(30, 400)),
    });
  }
  for (let i = 0; i < 40; i++) {
    const txn = transactions[between(1, transactions.length) - 1];
    systemnotes.push({
      recordtype: 'transaction',
      recordid: txn.id,
      field: 'status',
      oldvalue: STATUSES[txn.type][0],
      newvalue: txn.status,
      name: between(1, EMPLOYEES.length),
      date: addDaysCapped(txn.trandate, between(1, 60)),
    });
  }

  const warrantyclaims = [];
  for (let i = 1; i <= 30; i++) {
    const y = between(2025, 2026);
    warrantyclaims.push({
      id: i,
      name: `WC-${1000 + i}`,
      custrecord_wc_customer: between(1, customers.length),
      custrecord_wc_item: invParts[between(0, invParts.length - 1)].id,
      custrecord_wc_status: pick(['open', 'open', 'approved', 'rejected', 'closed']),
      custrecord_wc_amount: between(50, 900),
      created: isoDate(y, y === 2026 ? between(1, 6) : between(1, 12), between(1, 28)),
    });
  }

  return {
    customers, vendors, items, employees,
    subsidiaries: SUBSIDIARIES, locations: LOCATIONS, departments: DEPARTMENTS,
    classifications: CLASSES, currencies: CURRENCIES, accounts: ACCOUNTS,
    accountingperiods, transactions, lines, accountinglines,
    inventorybalances, systemnotes, warrantyclaims,
  };
}
```

Rewrite `lib/schema.js`: every entry gains `family`; add the 12 new tables with join-hint notes; extend `transaction` (+`currency`, `exchangerate`, `subsidiary`, `location`, `postingperiod`; `type`/`entity`/`status` notes updated for AP), `transactionline` (+`department`, `class`, `location`), `customer` (+`subsidiary`), `item` (+`class`), `employee` (+`department`). Families: Transactions (transaction, transactionline), Finance & GL (transactionaccountingline, account, accountingperiod), Entities (customer, vendor, employee), Items & Inventory (item, inventorybalance), Dimensions (subsidiary, location, department, classification, currency), Admin & Custom (systemnote, customrecord_warranty_claim). Key notes verbatim:
  - transaction.entity: `'joins customer.id (AR types) or vendor.id (AP types)'`
  - transaction.exchangerate: `'to AUD base; demo uses static rates'`
  - transactionaccountingline.posting: `"'T' — SalesOrd/PurchOrd never post and have no rows here"`
  - inventorybalance.quantityavailable: `'onhand minus open sales-order commitments (approximate)'`

`schemaPromptText()` groups by family:

```js
export function schemaPromptText() {
  const families = [...new Set(TABLES.map((t) => t.family))];
  return families
    .map((f) =>
      `-- ${f} --\n\n` +
      TABLES.filter((t) => t.family === f)
        .map(
          (t) =>
            `TABLE ${t.name} — ${t.description}\n` +
            t.columns.map((c) => `  ${c.name} (${c.type})${c.note ? ` — ${c.note}` : ''}`).join('\n'),
        )
        .join('\n\n'),
    )
    .join('\n\n');
}
```

Extend `lib/seed.js` DDL + INSERTS to all 17 tables (new DDL lines):

```sql
CREATE TABLE vendor (id INTEGER PRIMARY KEY, entityid TEXT, companyname TEXT, email TEXT, category TEXT, subsidiary INTEGER);
CREATE TABLE subsidiary (id INTEGER PRIMARY KEY, name TEXT, currency INTEGER, country TEXT);
CREATE TABLE location (id INTEGER PRIMARY KEY, name TEXT, subsidiary INTEGER);
CREATE TABLE department (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE classification (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE currency (id INTEGER PRIMARY KEY, name TEXT, symbol TEXT);
CREATE TABLE account (id INTEGER PRIMARY KEY, acctnumber TEXT, fullname TEXT, accttype TEXT);
CREATE TABLE accountingperiod (id INTEGER PRIMARY KEY, periodname TEXT, startdate TEXT, enddate TEXT, closed TEXT);
CREATE TABLE transactionaccountingline ("transaction" INTEGER, account INTEGER, debit REAL, credit REAL, posting TEXT);
CREATE TABLE inventorybalance (item INTEGER, location INTEGER, quantityonhand REAL, quantityavailable REAL);
CREATE TABLE systemnote (recordtype TEXT, recordid INTEGER, field TEXT, oldvalue TEXT, newvalue TEXT, name INTEGER, date TEXT);
CREATE TABLE customrecord_warranty_claim (id INTEGER PRIMARY KEY, name TEXT, custrecord_wc_customer INTEGER, custrecord_wc_item INTEGER, custrecord_wc_status TEXT, custrecord_wc_amount REAL, created TEXT);
```

plus widened `customer` (`subsidiary INTEGER`), `item` (`class INTEGER`), `employee` (`department INTEGER`), `transaction` (`currency INTEGER, exchangerate REAL, subsidiary INTEGER, location INTEGER, postingperiod INTEGER`), `transactionline` (`department INTEGER, class INTEGER, location INTEGER`), with matching INSERTS column lists.

- [ ] **Step 4: Verify** — `npm run check`. Expected: PASS incl. new asserts.
- [ ] **Step 5: Commit** — `git commit -m "feat: expand demo schema to 17 tables with coherent GL, AP, inventory seed data"`

---

### Task 3: Surface — examples, prompt, sidebar, README

**Files:**
- Modify: `lib/examples.js` (8 new entries; `fewshot: true` flags)
- Modify: `app/api/generate/route.js` (few-shot selection + one prompt rule)
- Modify: `app/page.js` (family-grouped sidebar) and `app/globals.css` (`.family-label`)
- Modify: `README.md` (table list line)

**Interfaces:**
- Consumes: Task 2's table/column names exactly as seeded.
- Produces: `EXAMPLES` entries `{ keywords, question, sql, fewshot? }`; route uses `EXAMPLES.filter((e) => e.fewshot)`.

- [ ] **Step 1: Add the 8 examples** (all constructs already bridged by `translate.js`; the `\btransaction\b` quoting also rewrites `tal.transaction` → `tal."transaction"`, valid SQLite):

1. P&L by month — keywords `['profit', 'loss', 'p&l', 'expenses', 'net']`, `fewshot: true`:
```sql
SELECT TO_CHAR(t.trandate, 'YYYY-MM') AS month,
       SUM(CASE WHEN a.accttype = 'Income' THEN tal.credit - tal.debit ELSE 0 END) AS income,
       SUM(CASE WHEN a.accttype IN ('COGS', 'Expense') THEN tal.debit - tal.credit ELSE 0 END) AS expenses,
       SUM(CASE WHEN a.accttype = 'Income' THEN tal.credit - tal.debit ELSE 0 END)
         - SUM(CASE WHEN a.accttype IN ('COGS', 'Expense') THEN tal.debit - tal.credit ELSE 0 END) AS net
FROM transactionaccountingline tal
JOIN transaction t ON t.id = tal.transaction
JOIN account a ON a.id = tal.account
WHERE tal.posting = 'T'
GROUP BY TO_CHAR(t.trandate, 'YYYY-MM')
ORDER BY month
```
2. Top vendors by spend — `['vendors', 'spend', 'suppliers']`, `fewshot: true` — SUM(foreigntotal) on `VendBill` joined to `vendor`, `FETCH FIRST 10 ROWS ONLY`.
3. Open vendor bills — `['bills', 'payable', 'owe']` — tranid/companyname/trandate/foreigntotal, `type = 'VendBill' AND status = 'open'`.
4. Revenue by department — `['department', 'division']` — `transactionline.department` join on CustInvc.
5. Stock on hand by location — `['stock', 'inventory', 'hand', 'warehouse']`, `fewshot: true` — inventorybalance × item × location.
6. Customer audit trail — `['audit', 'changed', 'history', 'who']` — systemnote × employee, `recordtype = 'customer'`, `FETCH FIRST 20 ROWS ONLY`.
7. Open warranty claims — `['warranty', 'claims']` — customrecord_warranty_claim × customer × item, `custrecord_wc_status = 'open'`.
8. Revenue by subsidiary in AUD — `['subsidiary', 'currency', 'aud', 'consolidated']`, `fewshot: true` — `ROUND(SUM(t.foreigntotal * t.exchangerate), 2)` grouped by subsidiary × currency on CustInvc.

Also add `fewshot: true` to existing "Top 10 customers by revenue", "Monthly invoice revenue trend", "Best-selling items by units sold" (7 few-shots total).

- [ ] **Step 2: Route** — replace `EXAMPLES.slice(0, 4)` with `EXAMPLES.filter((e) => e.fewshot)` and add one rule line: `- Orders (SalesOrd, PurchOrd) never post to the GL: transactionaccountingline only has rows with posting = 'T'.`

- [ ] **Step 3: Sidebar** — group by family in `app/page.js`:

```jsx
{[...new Set(TABLES.map((t) => t.family))].map((family) => (
  <div key={family}>
    <p className="family-label">{family}</p>
    {TABLES.filter((t) => t.family === family).map((t) => (
      <details key={t.name}>{/* existing summary/ul body unchanged */}</details>
    ))}
  </div>
))}
```

`app/globals.css`: `.family-label { margin: 10px 0 2px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.55; }` (match existing sidebar styling idiom when editing).

- [ ] **Step 4: README** — update the "tables mirror the real NetSuite analytics schema" sentence to name the 17-table families.
- [ ] **Step 5: Verify** — `npm run check` (example-execution loop now covers all 18 examples). Expected: PASS, `18 examples executed`.
- [ ] **Step 6: Commit** — `git commit -m "feat: family examples, curated few-shots, grouped schema sidebar"`

---

### Task 4: Full verification + ship

- [ ] **Step 1:** `npm run check` — expected: both test files pass.
- [ ] **Step 2:** `npm run build` — expected: Next.js production build succeeds.
- [ ] **Step 3:** Manual smoke via dev server: `npm run dev`, ask a GL and an inventory question in keyless mode (fallback examples must render tables).
- [ ] **Step 4:** Push branch, open PR to `main` (`gh pr create`), merge when checks pass — Vercel deploys `main` to the live demo.

## Self-Review Notes

- Spec coverage: §1 tables → Task 2; §2 coherence rules → Task 2 (glFor/committed/id spaces); §4 examples & sidebar → Task 3; §5 translator (no-op, verified) → Global Constraints; §6 tests → Tasks 1–2; §8 order folded into Task 2's single data-model pass (approach A).
- Type consistency: `data.*` key names in seed.js INSERTS match `buildDemoData` return keys; `fewshot` flag name consistent between examples.js and route.js.
- No placeholders: `/* unchanged */` markers refer to code that exists verbatim in the current files, not future work.
