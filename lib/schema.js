// Condensed NetSuite schema catalog. Field names follow the real NetSuite
// analytics/SuiteQL tables so generated queries transfer to a live account.
export const TABLES = [
  {
    name: 'transaction',
    description: 'Transaction headers: invoices, sales orders, payments, credit memos',
    columns: [
      { name: 'id', type: 'number', note: 'internal id' },
      { name: 'tranid', type: 'string', note: 'document number, e.g. INV-1042' },
      { name: 'type', type: 'string', note: "'CustInvc' | 'SalesOrd' | 'CustPymt' | 'CustCred'" },
      { name: 'entity', type: 'number', note: 'joins customer.id' },
      { name: 'trandate', type: 'date' },
      { name: 'status', type: 'string', note: "'open' | 'paid' | 'pendingFulfillment' | 'closed'" },
      { name: 'foreigntotal', type: 'number', note: 'transaction total' },
      { name: 'employee', type: 'number', note: 'sales rep, joins employee.id' },
      { name: 'memo', type: 'string' },
    ],
  },
  {
    name: 'transactionline',
    description: 'Transaction line items',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'transaction', type: 'number', note: 'joins transaction.id' },
      { name: 'item', type: 'number', note: 'joins item.id' },
      { name: 'quantity', type: 'number' },
      { name: 'rate', type: 'number' },
      { name: 'netamount', type: 'number' },
    ],
  },
  {
    name: 'customer',
    description: 'Customer records',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'entityid', type: 'string', note: 'e.g. CUST-104' },
      { name: 'companyname', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'datecreated', type: 'date' },
      { name: 'salesrep', type: 'number', note: 'joins employee.id' },
      { name: 'territory', type: 'string', note: "'APAC' | 'EMEA' | 'AMER'" },
    ],
  },
  {
    name: 'item',
    description: 'Inventory and service items',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'itemid', type: 'string', note: 'SKU, e.g. HW-KB-01' },
      { name: 'displayname', type: 'string' },
      { name: 'itemtype', type: 'string', note: "'InvtPart' | 'Service' | 'NonInvtPart'" },
      { name: 'baseprice', type: 'number' },
    ],
  },
  {
    name: 'employee',
    description: 'Employees (sales reps)',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'entityid', type: 'string' },
      { name: 'firstname', type: 'string' },
      { name: 'lastname', type: 'string' },
      { name: 'title', type: 'string' },
    ],
  },
];

export function schemaPromptText() {
  return TABLES.map(
    (t) =>
      `TABLE ${t.name} — ${t.description}\n` +
      t.columns.map((c) => `  ${c.name} (${c.type})${c.note ? ` — ${c.note}` : ''}`).join('\n'),
  ).join('\n\n');
}
