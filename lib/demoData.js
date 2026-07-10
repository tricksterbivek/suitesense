// Deterministic demo dataset shaped like a small NetSuite account.
// Seeded PRNG (re-initialized per build) so every visitor sees the same numbers.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMPANIES = [
  'Harbor Logistics', 'Bluegum Retail', 'Southern Cross Media', 'Ironbark Mining Co',
  'Wattle Health', 'Coastline Foods', 'Redgum Construction', 'Silver Fern Traders',
  'Pacific Rim Imports', 'Banksia Financial', 'Kookaburra Software', 'Boab Energy',
  'Coral Bay Resorts', 'Jacaranda Legal', 'Waratah Manufacturing', 'Spinifex Transport',
  'Moreton Analytics', 'Karri Timber Works', 'Lorikeet Travel', 'Quokka Robotics',
  'Huon Aquaculture', 'Daintree Organics', 'Basalt Civil', 'Opal Insurance Group',
  'Marlin Marine', 'Acacia Dental', 'Telopea Pharma', 'Currawong Security',
  'Bilby Educational', 'Galah Creative', 'Numbat Systems', 'Platypus Payments',
  'Echidna Defence', 'Cassowary Freight', 'Dingo Outdoor', 'Ibis Facilities',
  'Pelican Print Co', 'Magpie Sports', 'Wombat Warehousing', 'Brolga Events',
];

const ITEMS = [
  ['HW-KB-01', 'Mechanical Keyboard', 'InvtPart', 149],
  ['HW-MS-02', 'Wireless Mouse', 'InvtPart', 79],
  ['HW-MN-27', '27in 4K Monitor', 'InvtPart', 649],
  ['HW-DK-01', 'USB-C Dock', 'InvtPart', 289],
  ['HW-HS-05', 'Noise-Cancelling Headset', 'InvtPart', 329],
  ['HW-CAM-4K', '4K Webcam', 'InvtPart', 199],
  ['HW-SSD-2T', '2TB External SSD', 'InvtPart', 259],
  ['HW-RTR-AX', 'WiFi 6 Router', 'InvtPart', 379],
  ['HW-CHR-EL', 'Ergonomic Chair', 'InvtPart', 890],
  ['HW-DSK-ST', 'Standing Desk', 'InvtPart', 1190],
  ['SW-CRM-EN', 'CRM License (Enterprise)', 'Service', 4800],
  ['SW-CRM-SM', 'CRM License (Team)', 'Service', 1450],
  ['SW-BI-01', 'Analytics Add-on', 'Service', 2200],
  ['SV-IMPL-D', 'Implementation Day', 'Service', 1600],
  ['SV-TRN-D', 'Training Day', 'Service', 1200],
  ['SV-SUP-GLD', 'Gold Support (Annual)', 'Service', 5500],
  ['SV-SUP-SLV', 'Silver Support (Annual)', 'Service', 2750],
  ['NI-SHIP', 'Shipping & Handling', 'NonInvtPart', 45],
  ['NI-INS', 'Freight Insurance', 'NonInvtPart', 120],
  ['SV-AUD-01', 'Systems Audit', 'Service', 3400],
];

const EMPLOYEES = [
  [1, 'EMP-01', 'Mia', 'Chen', 'Account Executive'],
  [2, 'EMP-02', 'Jack', 'Nguyen', 'Account Executive'],
  [3, 'EMP-03', 'Ruby', 'Patel', 'Senior Account Executive'],
  [4, 'EMP-04', 'Oscar', 'Reyes', 'Sales Manager'],
  [5, 'EMP-05', 'Isla', 'Thompson', 'Account Executive'],
];

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
  { id: 1, name: 'AUD', symbol: 'A$' },
  { id: 2, name: 'USD', symbol: '$' },
  { id: 3, name: 'GBP', symbol: '£' },
  { id: 4, name: 'EUR', symbol: '€' },
];
// ponytail: static demo rates, no FX history — noted in the schema catalog.
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
  { id: 1, name: 'Sales' },
  { id: 2, name: 'Professional Services' },
  { id: 3, name: 'Support' },
  { id: 4, name: 'General & Administrative' },
];

const CLASSES = [
  { id: 1, name: 'Hardware' },
  { id: 2, name: 'Software' },
  { id: 3, name: 'Services' },
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

function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function addDaysCapped(iso, days) {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  const out = dt.toISOString().slice(0, 10);
  return out > '2026-06-28' ? '2026-06-28' : out;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Jul 2024 (id 1) .. Jul 2026 (id 25); closed through Mar 2026.
function buildPeriods() {
  const periods = [];
  for (let i = 0; i < 25; i++) {
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
// rounded per row; the AR/AP header row is the sum of the rounded rows, so
// debits and credits balance by construction. Orders never post.
function glFor(txn, txnLines, vendorCategory) {
  const rows = [];
  if (txn.type === 'SalesOrd' || txn.type === 'PurchOrd') return rows;
  const base = (amt) => Math.round(Math.abs(amt) * txn.exchangerate * 100) / 100;
  const cents = (n) => Math.round(n * 100) / 100;
  const add = (account, debit, credit) => rows.push({ transaction: txn.id, account, debit, credit, posting: 'T' });
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
