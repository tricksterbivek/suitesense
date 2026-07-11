import assert from 'node:assert';
import initSqlJs from 'sql.js';
import { buildDemoData } from './demoData.js';
import { seedDb } from './seed.js';
import { QUERIES } from './library/index.js';
import { suiteqlToSqlite, substituteParams } from './translate.js';
import { TABLES } from './schema.js';

const data = buildDemoData();

// Determinism: a second build is byte-identical (PRNG must init per call)
assert.deepStrictEqual(buildDemoData(), data, 'buildDemoData must be deterministic');

// --- Catalog: 15 tables, every entry carries a family ---
assert.equal(TABLES.length, 15, 'catalog must list 15 tables');
assert.ok(TABLES.every((t) => typeof t.family === 'string' && t.family), 'every table needs a family');

// --- REAL-SEMANTICS INVARIANTS -------------------------------------------

const byTxn = new Map();
for (const l of data.lines) {
  if (!byTxn.has(l.transaction)) byTxn.set(l.transaction, []);
  byTxn.get(l.transaction).push(l);
}

for (const t of data.transactions) {
  const ls = byTxn.get(t.id) ?? [];
  const mains = ls.filter((l) => l.mainline === 'T');
  assert.equal(mains.length, 1, `txn ${t.id} has exactly one mainline row`);
  // mainline netamount mirrors the header total; documents with item lines
  // self-balance to zero (payments are mainline-only, like real accounts)
  assert.ok(Math.abs(mains[0].netamount - t.foreigntotal) < 0.01, `txn ${t.id} mainline = foreigntotal`);
  if (!['CustPymt', 'VendPymt'].includes(t.type)) {
    const sum = ls.reduce((s, l) => s + l.netamount, 0);
    assert.ok(Math.abs(sum) < 0.01, `txn ${t.id} lines sum to zero (got ${sum})`);
  }
  // status codes are single letters
  assert.ok(/^[A-H]$/.test(t.status), `txn ${t.id} status is a letter code`);
}

// sales item lines negative; AP item lines positive; logistics zero-amount
for (const l of data.lines) {
  if (l.mainline === 'T' || !l.item) continue;
  const t = data.transactions[l.transaction - 1];
  if (t.type === 'CustInvc' || t.type === 'SalesOrd') {
    assert.ok(l.netamount < 0 && l.quantity < 0, `sales line negative on ${t.type} ${t.id}`);
  }
  if (t.type === 'VendBill' || t.type === 'PurchOrd') {
    assert.ok(l.netamount > 0 && l.quantity > 0, `AP line positive on ${t.id}`);
  }
  if (['ItemShip', 'ItemRcpt', 'TrnfrOrd'].includes(t.type)) {
    assert.equal(l.netamount, 0, `logistics line zero-value on ${t.id}`);
  }
  if (t.type === 'ItemShip') assert.ok(l.quantity < 0, 'fulfillment ships out (negative qty)');
  if (t.type === 'ItemRcpt') assert.ok(l.quantity > 0, 'receipt brings in (positive qty)');
}

// open balances: invoice A carries unpaid > 0, B = 0; bills negative-signed
for (const t of data.transactions) {
  if (t.type === 'CustInvc') {
    if (t.status === 'A') assert.ok(t.foreignamountunpaid > 0, `open invoice ${t.id} has unpaid > 0`);
    else assert.equal(t.foreignamountunpaid, 0, `paid invoice ${t.id} has unpaid = 0`);
    assert.ok(t.foreigntotal > 0, 'invoice totals positive');
    assert.ok(t.duedate > t.trandate, 'invoice duedate after trandate');
  }
  if (t.type === 'VendBill') {
    assert.ok(t.foreigntotal < 0, `bill ${t.id} total credit-signed (negative)`);
    if (t.status === 'A') assert.ok(t.foreignamountunpaid < 0, `open bill ${t.id} unpaid negative`);
  }
  if (t.type === 'CustCred') assert.ok(t.foreigntotal < 0, 'credit memo credit-signed');
  if (t.type === 'TrnfrOrd') assert.equal(t.entity, null, 'transfer orders have no entity');
  else if (['ItemShip', 'CustInvc', 'SalesOrd', 'CustPymt', 'CustCred'].includes(t.type)) {
    assert.ok(t.entity >= 1 && t.entity <= 40, `AR/logistics entity is a customer on ${t.id}`);
  } else if (['VendBill', 'PurchOrd', 'VendPymt', 'ItemRcpt'].includes(t.type)) {
    assert.ok(t.entity >= 101, `AP entity is a vendor on ${t.id}`);
  }
}

// --- GL: balanced, signed amount column, posting docs only ---
const glByTxn = new Map();
for (const g of data.accountinglines) {
  assert.ok(Math.abs(g.amount - (g.debit - g.credit)) < 0.005, 'TAL amount = debit - credit');
  const e = glByTxn.get(g.transaction) ?? { debit: 0, credit: 0 };
  e.debit += g.debit;
  e.credit += g.credit;
  glByTxn.set(g.transaction, e);
}
for (const [txnId, { debit, credit }] of glByTxn) {
  assert.ok(Math.abs(debit - credit) < 0.005, `GL unbalanced for txn ${txnId}`);
}
const NON_POSTING = new Set(['SalesOrd', 'PurchOrd', 'ItemShip', 'ItemRcpt', 'TrnfrOrd']);
for (const t of data.transactions) {
  if (NON_POSTING.has(t.type)) assert.ok(!glByTxn.has(t.id), `${t.type} ${t.id} must not post`);
  else assert.ok(glByTxn.has(t.id), `posting txn ${t.id} has GL rows`);
}

// --- periods: month rows + quarter/year rollups ---
const months = data.accountingperiods.filter((p) => p.isquarter === 'F' && p.isyear === 'F');
const rollups = data.accountingperiods.filter((p) => p.isquarter === 'T' || p.isyear === 'T');
assert.equal(months.length, 25, '25 month periods');
assert.ok(rollups.length >= 8, 'quarter/year rollup rows exist');
for (const t of data.transactions) {
  const p = data.accountingperiods.find((x) => x.id === t.postingperiod);
  assert.ok(p && p.isquarter === 'F' && p.isyear === 'F', `txn ${t.id} posts to a month period`);
}

// --- inventory coherence ---
for (const b of data.inventorybalances) {
  assert.ok(b.quantityavailable <= b.quantityonhand && b.quantityavailable >= 0, 'available within [0, onhand]');
}

// --- EVERY library entry executes against the demo DB -------------------
const SQL = await initSqlJs();
const db = new SQL.Database();
seedDb(db);
const failures = [];
let executed = 0;
for (const q of QUERIES) {
  const { sql } = substituteParams(q.sql);
  try {
    db.exec(suiteqlToSqlite(sql));
    executed++;
  } catch (err) {
    failures.push(`${q.id}: ${String(err.message).slice(0, 90)}`);
  }
}
if (failures.length) {
  console.error('library entries failing on demo:\n  ' + failures.join('\n  '));
}
assert.equal(failures.length, 0, `all ${QUERIES.length} library entries must execute on the demo dataset`);

console.log(`demoData: checks passed (${data.transactions.length} txns, ${data.lines.length} lines, ${executed}/${QUERIES.length} library queries executed on demo)`);
