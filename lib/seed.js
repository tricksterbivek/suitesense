// Creates and seeds the demo schema on an open sql.js Database.
// Shared by the browser (lib/sqlite.js), the generate route's execution gate,
// and node tests. Column set mirrors real SuiteQL analytics tables.
import { buildDemoData } from './demoData.js';

const DDL = `
  CREATE TABLE customer (id INTEGER PRIMARY KEY, entityid TEXT, companyname TEXT, email TEXT, datecreated TEXT, salesrep INTEGER, territory TEXT, subsidiary INTEGER);
  CREATE TABLE vendor (id INTEGER PRIMARY KEY, entityid TEXT, companyname TEXT, email TEXT, category TEXT, subsidiary INTEGER);
  CREATE TABLE item (id INTEGER PRIMARY KEY, itemid TEXT, displayname TEXT, itemtype TEXT, baseprice REAL, class INTEGER);
  CREATE TABLE employee (id INTEGER PRIMARY KEY, entityid TEXT, firstname TEXT, lastname TEXT, title TEXT, department INTEGER);
  CREATE TABLE subsidiary (id INTEGER PRIMARY KEY, name TEXT, currency INTEGER, country TEXT);
  CREATE TABLE location (id INTEGER PRIMARY KEY, name TEXT, subsidiary INTEGER);
  CREATE TABLE department (id INTEGER PRIMARY KEY, name TEXT);
  CREATE TABLE classification (id INTEGER PRIMARY KEY, name TEXT);
  CREATE TABLE currency (id INTEGER PRIMARY KEY, name TEXT, symbol TEXT);
  CREATE TABLE account (id INTEGER PRIMARY KEY, acctnumber TEXT, fullname TEXT, accttype TEXT);
  CREATE TABLE accountingperiod (id INTEGER PRIMARY KEY, periodname TEXT, startdate TEXT, enddate TEXT, isadjust TEXT, isquarter TEXT, isyear TEXT, closed TEXT);
  CREATE TABLE "transaction" (id INTEGER PRIMARY KEY, tranid TEXT, type TEXT, entity INTEGER, trandate TEXT, duedate TEXT, status TEXT, posting TEXT, foreigntotal REAL, foreignamountunpaid REAL, currency INTEGER, exchangerate REAL, subsidiary INTEGER, location INTEGER, transferlocation INTEGER, postingperiod INTEGER, employee INTEGER, memo TEXT);
  CREATE TABLE transactionline (id INTEGER PRIMARY KEY, "transaction" INTEGER, item INTEGER, mainline TEXT, taxline TEXT, itemtype TEXT, quantity REAL, rate REAL, netamount REAL, foreignamount REAL, isclosed TEXT, quantityshiprecv REAL, createdfrom INTEGER, department INTEGER, class INTEGER, location INTEGER, subsidiary INTEGER);
  CREATE TABLE transactionaccountingline ("transaction" INTEGER, transactionline INTEGER, account INTEGER, debit REAL, credit REAL, amount REAL, posting TEXT);
  CREATE TABLE inventorybalance (item INTEGER, location INTEGER, quantityonhand REAL, quantityavailable REAL);
`;

const INSERTS = [
  ['customer', 'customers', ['id', 'entityid', 'companyname', 'email', 'datecreated', 'salesrep', 'territory', 'subsidiary']],
  ['vendor', 'vendors', ['id', 'entityid', 'companyname', 'email', 'category', 'subsidiary']],
  ['item', 'items', ['id', 'itemid', 'displayname', 'itemtype', 'baseprice', 'class']],
  ['employee', 'employees', ['id', 'entityid', 'firstname', 'lastname', 'title', 'department']],
  ['subsidiary', 'subsidiaries', ['id', 'name', 'currency', 'country']],
  ['location', 'locations', ['id', 'name', 'subsidiary']],
  ['department', 'departments', ['id', 'name']],
  ['classification', 'classifications', ['id', 'name']],
  ['currency', 'currencies', ['id', 'name', 'symbol']],
  ['account', 'accounts', ['id', 'acctnumber', 'fullname', 'accttype']],
  ['accountingperiod', 'accountingperiods', ['id', 'periodname', 'startdate', 'enddate', 'isadjust', 'isquarter', 'isyear', 'closed']],
  ['"transaction"', 'transactions', ['id', 'tranid', 'type', 'entity', 'trandate', 'duedate', 'status', 'posting', 'foreigntotal', 'foreignamountunpaid', 'currency', 'exchangerate', 'subsidiary', 'location', 'transferlocation', 'postingperiod', 'employee', 'memo']],
  ['transactionline', 'lines', ['id', 'transaction', 'item', 'mainline', 'taxline', 'itemtype', 'quantity', 'rate', 'netamount', 'foreignamount', 'isclosed', 'quantityshiprecv', 'createdfrom', 'department', 'class', 'location', 'subsidiary']],
  ['transactionaccountingline', 'accountinglines', ['transaction', 'transactionline', 'account', 'debit', 'credit', 'amount', 'posting']],
  ['inventorybalance', 'inventorybalances', ['item', 'location', 'quantityonhand', 'quantityavailable']],
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
