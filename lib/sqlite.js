// Browser-side demo database: sql.js (SQLite compiled to wasm) seeded with
// the demo dataset. Queries run entirely in the visitor's browser — the demo
// never touches a real NetSuite account.
import initSqlJs from 'sql.js';
import { buildDemoData } from './demoData.js';
import { suiteqlToSqlite, isReadOnly } from './translate.js';

let dbPromise = null;

async function createDb() {
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const db = new SQL.Database();
  const { customers, items, employees, transactions, lines } = buildDemoData();

  db.run(`
    CREATE TABLE customer (id INTEGER PRIMARY KEY, entityid TEXT, companyname TEXT, email TEXT, datecreated TEXT, salesrep INTEGER, territory TEXT);
    CREATE TABLE item (id INTEGER PRIMARY KEY, itemid TEXT, displayname TEXT, itemtype TEXT, baseprice REAL);
    CREATE TABLE employee (id INTEGER PRIMARY KEY, entityid TEXT, firstname TEXT, lastname TEXT, title TEXT);
    CREATE TABLE "transaction" (id INTEGER PRIMARY KEY, tranid TEXT, type TEXT, entity INTEGER, trandate TEXT, status TEXT, foreigntotal REAL, employee INTEGER, memo TEXT);
    CREATE TABLE transactionline (id INTEGER PRIMARY KEY, "transaction" INTEGER, item INTEGER, quantity REAL, rate REAL, netamount REAL);
  `);

  const insert = (table, rows, cols) => {
    const stmt = db.prepare(`INSERT INTO ${table} VALUES (${cols.map(() => '?').join(',')})`);
    for (const row of rows) stmt.run(cols.map((c) => row[c]));
    stmt.free();
  };
  insert('customer', customers, ['id', 'entityid', 'companyname', 'email', 'datecreated', 'salesrep', 'territory']);
  insert('item', items, ['id', 'itemid', 'displayname', 'itemtype', 'baseprice']);
  insert('employee', employees, ['id', 'entityid', 'firstname', 'lastname', 'title']);
  insert('"transaction"', transactions, ['id', 'tranid', 'type', 'entity', 'trandate', 'status', 'foreigntotal', 'employee', 'memo']);
  insert('transactionline', lines, ['id', 'transaction', 'item', 'quantity', 'rate', 'netamount']);

  return db;
}

export function getDb() {
  if (!dbPromise) dbPromise = createDb();
  return dbPromise;
}

export async function runSuiteQL(suiteql) {
  if (!isReadOnly(suiteql)) {
    throw new Error('Only SELECT queries are allowed in the demo console.');
  }
  const db = await getDb();
  const sqlite = suiteqlToSqlite(suiteql);
  const result = db.exec(sqlite);
  if (result.length === 0) return { columns: [], rows: [], translated: sqlite };
  const { columns, values } = result[0];
  return { columns, rows: values, translated: sqlite };
}
