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
