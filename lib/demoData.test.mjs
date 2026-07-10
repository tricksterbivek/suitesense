import assert from 'node:assert';
import initSqlJs from 'sql.js';
import { buildDemoData } from './demoData.js';
import { seedDb } from './seed.js';
import { EXAMPLES } from './examples.js';
import { suiteqlToSqlite } from './translate.js';
import { TABLES } from './schema.js';

const data = buildDemoData();

// Determinism: a second build is byte-identical (PRNG must init per call)
assert.deepStrictEqual(buildDemoData(), data, 'buildDemoData must be deterministic');

// --- Catalog: 17 tables, every entry carries a family ---
assert.equal(TABLES.length, 15, 'catalog must list 15 tables');
assert.ok(TABLES.every((t) => typeof t.family === 'string' && t.family), 'every table needs a family');

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
  assert.ok((AP_TYPES_SET.has(t.type) ? vendorIds : customerIds).has(t.entity), `txn ${t.id} entity FK`);
  assert.ok(subsidiaryIds.has(t.subsidiary) && locationIds.has(t.location) && currencyIds.has(t.currency) && periodIds.has(t.postingperiod), `txn ${t.id} dimension FKs`);
  if (t.employee != null) assert.ok(employeeIds.has(t.employee), `txn ${t.id} employee FK`);
}
for (const l of data.lines) assert.ok(txnIds.has(l.transaction) && itemIds.has(l.item) && deptIds.has(l.department) && classIds.has(l.class) && locationIds.has(l.location), `line ${l.id} FKs`);
for (const g of data.accountinglines) assert.ok(txnIds.has(g.transaction) && accountIds.has(g.account), 'GL FKs');
for (const b of data.inventorybalances) {
  assert.ok(itemIds.has(b.item) && locationIds.has(b.location), 'inventory FKs');
  assert.ok(b.quantityavailable <= b.quantityonhand && b.quantityavailable >= 0, 'available within [0, onhand]');
}
// Every curated example executes against the seeded DB and returns rows
const SQL = await initSqlJs();
const db = new SQL.Database();
seedDb(db);
for (const ex of EXAMPLES) {
  const res = db.exec(suiteqlToSqlite(ex.sql));
  assert.ok(res.length > 0 && res[0].values.length > 0, `example returned no rows: ${ex.question}`);
}

console.log(`demoData: checks passed (${data.transactions.length} txns, ${EXAMPLES.length} examples executed)`);
