// Condensed NetSuite schema catalog. Field names follow the real NetSuite
// analytics/SuiteQL tables so generated queries transfer to a live account.
export const TABLES = [
  {
    name: 'transaction',
    family: 'Transactions',
    description: 'Transaction headers: invoices, sales orders, payments, credits, vendor bills, POs',
    columns: [
      { name: 'id', type: 'number', note: 'internal id' },
      { name: 'tranid', type: 'string', note: 'document number, e.g. INV-1042, BILL-1523' },
      { name: 'type', type: 'string', note: "'CustInvc' | 'SalesOrd' | 'CustPymt' | 'CustCred' | 'VendBill' | 'PurchOrd' | 'VendPymt'" },
      { name: 'entity', type: 'number', note: 'joins customer.id (AR types) or vendor.id (AP types)' },
      { name: 'trandate', type: 'date' },
      { name: 'status', type: 'string', note: "'open' | 'paid' | 'pendingFulfillment' | 'pendingReceipt' | 'closed'" },
      { name: 'foreigntotal', type: 'number', note: 'total in transaction currency' },
      { name: 'currency', type: 'number', note: 'joins currency.id' },
      { name: 'exchangerate', type: 'number', note: 'to AUD base; demo uses static rates' },
      { name: 'subsidiary', type: 'number', note: 'joins subsidiary.id' },
      { name: 'location', type: 'number', note: 'joins location.id' },
      { name: 'postingperiod', type: 'number', note: 'joins accountingperiod.id' },
      { name: 'employee', type: 'number', note: 'sales rep, joins employee.id; null on AP transactions' },
      { name: 'memo', type: 'string' },
    ],
  },
  {
    name: 'transactionline',
    family: 'Transactions',
    description: 'Transaction line items',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'transaction', type: 'number', note: 'joins transaction.id' },
      { name: 'item', type: 'number', note: 'joins item.id' },
      { name: 'quantity', type: 'number' },
      { name: 'rate', type: 'number' },
      { name: 'netamount', type: 'number', note: 'in transaction currency' },
      { name: 'department', type: 'number', note: 'joins department.id' },
      { name: 'class', type: 'number', note: 'joins classification.id' },
      { name: 'location', type: 'number', note: 'joins location.id' },
    ],
  },
  {
    name: 'transactionaccountingline',
    family: 'Finance & GL',
    description: 'GL impact rows per posting transaction, in AUD base currency',
    columns: [
      { name: 'transaction', type: 'number', note: 'joins transaction.id' },
      { name: 'account', type: 'number', note: 'joins account.id' },
      { name: 'debit', type: 'number', note: 'AUD base; 0 when credit side' },
      { name: 'credit', type: 'number', note: 'AUD base; 0 when debit side' },
      { name: 'posting', type: 'string', note: "'T' — SalesOrd/PurchOrd never post and have no rows here" },
    ],
  },
  {
    name: 'account',
    family: 'Finance & GL',
    description: 'Chart of accounts',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'acctnumber', type: 'string', note: "e.g. '4000'" },
      { name: 'fullname', type: 'string' },
      { name: 'accttype', type: 'string', note: "'Bank' | 'AcctRec' | 'AcctPay' | 'OthCurrAsset' | 'OthCurrLiab' | 'Income' | 'COGS' | 'Expense'" },
    ],
  },
  {
    name: 'accountingperiod',
    family: 'Finance & GL',
    description: 'Monthly accounting periods, Jul 2024 – Jul 2026',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'periodname', type: 'string', note: "e.g. 'Jul 2025'" },
      { name: 'startdate', type: 'date' },
      { name: 'enddate', type: 'date' },
      { name: 'closed', type: 'string', note: "'T' | 'F' — closed through Mar 2026" },
    ],
  },
  {
    name: 'customer',
    family: 'Entities',
    description: 'Customer records',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'entityid', type: 'string', note: 'e.g. CUST-104' },
      { name: 'companyname', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'datecreated', type: 'date' },
      { name: 'salesrep', type: 'number', note: 'joins employee.id' },
      { name: 'territory', type: 'string', note: "'APAC' | 'EMEA' | 'AMER'" },
      { name: 'subsidiary', type: 'number', note: 'joins subsidiary.id' },
    ],
  },
  {
    name: 'vendor',
    family: 'Entities',
    description: 'Vendor/supplier records',
    columns: [
      { name: 'id', type: 'number', note: 'shares the entity id space with customer, no overlap' },
      { name: 'entityid', type: 'string', note: 'e.g. VEND-204' },
      { name: 'companyname', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'category', type: 'string', note: "'Inventory' | 'Logistics' | 'Office' | 'Services' | 'Utilities'" },
      { name: 'subsidiary', type: 'number', note: 'joins subsidiary.id' },
    ],
  },
  {
    name: 'employee',
    family: 'Entities',
    description: 'Employees (sales reps)',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'entityid', type: 'string' },
      { name: 'firstname', type: 'string' },
      { name: 'lastname', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'department', type: 'number', note: 'joins department.id' },
    ],
  },
  {
    name: 'item',
    family: 'Items & Inventory',
    description: 'Inventory and service items',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'itemid', type: 'string', note: 'SKU, e.g. HW-KB-01' },
      { name: 'displayname', type: 'string' },
      { name: 'itemtype', type: 'string', note: "'InvtPart' | 'Service' | 'NonInvtPart'" },
      { name: 'baseprice', type: 'number' },
      { name: 'class', type: 'number', note: 'joins classification.id' },
    ],
  },
  {
    name: 'inventorybalance',
    family: 'Items & Inventory',
    description: 'Stock on hand per item and location (InvtPart only)',
    columns: [
      { name: 'item', type: 'number', note: 'joins item.id' },
      { name: 'location', type: 'number', note: 'joins location.id' },
      { name: 'quantityonhand', type: 'number' },
      { name: 'quantityavailable', type: 'number', note: 'onhand minus open sales-order commitments (approximate)' },
    ],
  },
  {
    name: 'subsidiary',
    family: 'Dimensions',
    description: 'Legal entities',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'currency', type: 'number', note: 'joins currency.id' },
      { name: 'country', type: 'string', note: "'AU' | 'US' | 'GB'" },
    ],
  },
  {
    name: 'location',
    family: 'Dimensions',
    description: 'Warehouses and offices',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string' },
      { name: 'subsidiary', type: 'number', note: 'joins subsidiary.id' },
    ],
  },
  {
    name: 'department',
    family: 'Dimensions',
    description: 'Departments',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string', note: "'Sales' | 'Professional Services' | 'Support' | 'General & Administrative'" },
    ],
  },
  {
    name: 'classification',
    family: 'Dimensions',
    description: 'Class dimension (product lines)',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string', note: "'Hardware' | 'Software' | 'Services'" },
    ],
  },
  {
    name: 'currency',
    family: 'Dimensions',
    description: 'Currencies',
    columns: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'string', note: "'AUD' | 'USD' | 'GBP' | 'EUR'" },
      { name: 'symbol', type: 'string' },
    ],
  },
];

export function schemaPromptText() {
  const families = [...new Set(TABLES.map((t) => t.family))];
  return families
    .map(
      (f) =>
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
