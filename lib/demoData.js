// Deterministic demo dataset mirroring REAL NetSuite SuiteQL semantics so that
// queries written for live accounts execute meaningfully here:
//   - transactionline includes the mainline='T' header row and taxline='T' rows;
//     sales item lines carry NEGATIVE netamount/quantity (ledger-signed), AP
//     lines positive with a negative header — every transaction's lines sum to 0.
//   - transaction.status holds per-type letter codes (CustInvc 'A' open / 'B'
//     paid), foreignamountunpaid holds the open balance, duedate = trandate+30.
//   - accountingperiod includes quarter/year rollup rows (isquarter/isyear='T')
//     that correct queries must filter out.
//   - Logistics flows exist: ItemShip (fulfillments, negative qty), ItemRcpt
//     (receipts, positive qty), TrnfrOrd (transfers, no entity).
// All data is SYNTHETIC (seeded PRNG, fictional companies) — never sourced from
// any real account.
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

// Item prefix -> line dimensions.
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
const ACCT = { bank: 1, ar: 2, ap: 4, gst: 5 };

// Real-style per-type letter status codes (subset). BUILTIN.DF in the demo
// dialect passes the raw code through; the meanings are documented here.
const STATUSES = {
  CustInvc: ['A', 'B', 'B', 'B'],            // A=Open, B=Paid In Full
  SalesOrd: ['B', 'D', 'F', 'G', 'H'],       // B=Pend. Fulfillment ... H=Closed
  CustPymt: ['C'],
  CustCred: ['A', 'B'],
  VendBill: ['A', 'B', 'B'],                 // A=Open, B=Paid In Full
  PurchOrd: ['B', 'F', 'G', 'H'],
  VendPymt: ['C'],
  ItemShip: ['C'],                            // C=Shipped
  ItemRcpt: ['C'],
  TrnfrOrd: ['B', 'G', 'H'],
};
const OPEN_SO = 'B';
const TRANID_PREFIX = {
  CustInvc: 'INV', SalesOrd: 'SO', CustPymt: 'PAY', CustCred: 'CM',
  VendBill: 'BILL', PurchOrd: 'PO', VendPymt: 'VPAY',
  ItemShip: 'SHIP', ItemRcpt: 'RCPT', TrnfrOrd: 'TO',
};
const AR_TYPES = ['CustInvc', 'CustInvc', 'CustInvc', 'SalesOrd', 'SalesOrd', 'CustPymt', 'CustCred'];
const AP_TYPES = ['VendBill', 'VendBill', 'VendBill', 'PurchOrd', 'PurchOrd', 'VendPymt'];
const TAX_RATE = 0.1;

function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function addDaysIso(iso, days) {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
const cents = (n) => Math.round(n * 100) / 100;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Month periods Jul 2024 (id 1) .. Jul 2026 (id 25), plus quarter and year
// rollup rows (isquarter/isyear='T') that correct queries must exclude.
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
      isadjust: 'F', isquarter: 'F', isyear: 'F',
      closed: y < 2026 || m <= 3 ? 'T' : 'F',
    });
  }
  // rollups (FY starting July, AU-style): quarters and years covering the range
  let id = 101;
  const quarters = [
    ['Q1 FY25', '2024-07-01', '2024-09-30'], ['Q2 FY25', '2024-10-01', '2024-12-31'],
    ['Q3 FY25', '2025-01-01', '2025-03-31'], ['Q4 FY25', '2025-04-01', '2025-06-30'],
    ['Q1 FY26', '2025-07-01', '2025-09-30'], ['Q2 FY26', '2025-10-01', '2025-12-31'],
    ['Q3 FY26', '2026-01-01', '2026-03-31'], ['Q4 FY26', '2026-04-01', '2026-06-30'],
  ];
  for (const [name, s, e] of quarters) {
    periods.push({ id: id++, periodname: name, startdate: s, enddate: e, isadjust: 'F', isquarter: 'T', isyear: 'F', closed: e < '2026-04-01' ? 'T' : 'F' });
  }
  periods.push({ id: id++, periodname: 'FY 2025', startdate: '2024-07-01', enddate: '2025-06-30', isadjust: 'F', isquarter: 'F', isyear: 'T', closed: 'T' });
  periods.push({ id: id++, periodname: 'FY 2026', startdate: '2025-07-01', enddate: '2026-06-30', isadjust: 'F', isquarter: 'F', isyear: 'T', closed: 'F' });
  return periods;
}

// GL rows for one transaction (AUD base, balanced by construction).
// Orders and logistics documents do not post in the demo.
function glFor(txn, itemLines, taxLine, vendorCategory) {
  const rows = [];
  if (!['CustInvc', 'CustCred', 'CustPymt', 'VendBill', 'VendPymt'].includes(txn.type)) return rows;
  const base = (amt) => cents(Math.abs(amt) * txn.exchangerate);
  const add = (account, debit, credit) =>
    rows.push({ transaction: txn.id, transactionline: 0, account, debit, credit, amount: cents(debit - credit), posting: 'T' });

  if (txn.type === 'CustInvc' || txn.type === 'CustCred') {
    const byAccount = new Map();
    for (const l of itemLines) {
      const acct = INCOME_BY_CLASS[l.class];
      byAccount.set(acct, cents((byAccount.get(acct) ?? 0) + base(l.netamount)));
    }
    let total = 0;
    for (const [acct, amt] of byAccount) {
      total = cents(total + amt);
      if (txn.type === 'CustInvc') add(acct, 0, amt);
      else add(acct, amt, 0);
    }
    if (taxLine) {
      const tax = base(taxLine.netamount);
      total = cents(total + tax);
      if (txn.type === 'CustInvc') add(ACCT.gst, 0, tax);
      else add(ACCT.gst, tax, 0);
    }
    if (txn.type === 'CustInvc') add(ACCT.ar, total, 0);
    else add(ACCT.ar, 0, total);
  } else if (txn.type === 'CustPymt') {
    const total = base(txn.foreigntotal);
    add(ACCT.bank, total, 0);
    add(ACCT.ar, 0, total);
  } else if (txn.type === 'VendBill') {
    const goods = itemLines.reduce((s, l) => cents(s + base(l.netamount)), 0);
    add(EXPENSE_BY_VENDOR_CATEGORY[vendorCategory] ?? 11, goods, 0);
    let total = goods;
    if (taxLine) {
      const tax = base(taxLine.netamount);
      total = cents(total + tax);
      add(ACCT.gst, tax, 0);
    }
    add(ACCT.ap, 0, total);
  } else if (txn.type === 'VendPymt') {
    const total = base(txn.foreigntotal);
    add(ACCT.ap, total, 0);
    add(ACCT.bank, 0, total);
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

  // kind: 'ar' | 'ap' | 'ship' | 'rcpt' | 'xfer'
  const pushTransaction = (t, type, entityRecord, kind, opts = {}) => {
    const monthsBack = between(0, 23);
    const y = monthsBack < 7 ? 2026 : monthsBack < 19 ? 2025 : 2024;
    const m = monthsBack < 7 ? 7 - monthsBack : monthsBack < 19 ? 19 - monthsBack : 31 - monthsBack;
    const subsidiary = entityRecord ? entityRecord.subsidiary : between(1, SUBSIDIARIES.length);
    const currency = SUBSIDIARIES[subsidiary - 1].currency;
    const location = opts.location ?? pick(locationsOf(subsidiary)).id;
    const trandate = isoDate(y, m, between(1, 28));
    const status = pick(STATUSES[type]);
    const monetary = kind === 'ar' || kind === 'ap';
    const salesSigned = ['CustInvc', 'SalesOrd', 'CustPymt', 'ItemShip'].includes(type);

    const txn = {
      id: t,
      tranid: `${TRANID_PREFIX[type]}-${1000 + t}`,
      type,
      entity: entityRecord ? entityRecord.id : null,
      trandate,
      duedate: monetary && type !== 'CustPymt' && type !== 'VendPymt' ? addDaysIso(trandate, 30) : null,
      status,
      foreigntotal: 0,
      foreignamountunpaid: 0,
      currency,
      exchangerate: FX_TO_AUD[currency],
      subsidiary,
      location,
      postingperiod: (y - 2024) * 12 + m - 6,
      employee: kind === 'ar' || kind === 'ship' ? entityRecord?.salesrep ?? null : null,
      memo: '',
    };

    const itemLines = [];
    let goods = 0;
    const isPayment = type === 'CustPymt' || type === 'VendPymt';
    const lineCount = isPayment ? 0 : between(1, 4);
    for (let l = 0; l < lineCount; l++) {
      const item = kind === 'ap' && (entityRecord.category === 'Inventory' || between(1, 10) <= 7)
        ? invParts[between(0, invParts.length - 1)]
        : kind === 'ar'
          ? items[between(0, items.length - 1)]
          : invParts[between(0, invParts.length - 1)];
      const qty = item.itemtype === 'Service' ? between(1, 3) : between(1, 12);
      const rate = kind === 'ap' ? Math.round(item.baseprice * 0.6) : item.baseprice;
      const amt = kind === 'ship' || kind === 'rcpt' || kind === 'xfer' ? 0 : Math.round(qty * rate * (0.9 + rand() * 0.2));
      const dims = itemDims(item.itemid);
      // ledger signs: sales-side item lines negative, AP/receipt/transfer positive
      const sign = salesSigned ? -1 : 1;
      itemLines.push({
        id: lineId++, transaction: t, item: item.id,
        mainline: 'F', taxline: 'F', itemtype: item.itemtype,
        quantity: sign * qty, rate,
        netamount: sign * amt, foreignamount: sign * amt,
        department: dims.department, class: dims.class,
        location: opts.lineLocation ?? location, subsidiary,
      });
      goods += amt;
    }

    let taxLine = null;
    let total = goods;
    if (monetary && !isPayment && goods > 0) {
      const tax = Math.round(goods * TAX_RATE);
      total = goods + tax;
      const sign = salesSigned ? -1 : 1;
      taxLine = {
        id: lineId++, transaction: t, item: null,
        mainline: 'F', taxline: 'T', itemtype: 'TaxItem',
        quantity: sign * 1, rate: null,
        netamount: sign * tax, foreignamount: sign * tax,
        department: null, class: null,
        location: opts.lineLocation ?? location, subsidiary,
      };
    }
    if (isPayment) total = between(500, 40000);

    // header sign: AR positive, AP/credit-memo negative (credit convention),
    // logistics zero-value. mainline netamount always equals foreigntotal so
    // each transaction's lines sum to zero, as on a real account.
    const headerSign = kind === 'ap' || type === 'CustCred' ? -1 : 1;
    const foreigntotal = (kind === 'ship' || kind === 'rcpt' || kind === 'xfer') ? 0 : headerSign * total;
    txn.foreigntotal = foreigntotal;

    lines.push({
      id: lineId++, transaction: t, item: null,
      mainline: 'T', taxline: 'F', itemtype: null,
      quantity: null, rate: null,
      netamount: foreigntotal, foreignamount: foreigntotal,
      department: null, class: null,
      location, subsidiary,
    });
    lines.push(...itemLines);
    if (taxLine) lines.push(taxLine);

    // open balances: invoices/bills with 'A' carry unpaid amounts (some partial)
    if (type === 'CustInvc') txn.foreignamountunpaid = status === 'A' ? (between(1, 4) === 1 ? cents(foreigntotal * 0.4) : foreigntotal) : 0;
    if (type === 'VendBill') txn.foreignamountunpaid = status === 'A' ? foreigntotal : 0; // negative, like real accounts
    if (type === 'CustPymt') txn.foreignamountunpaid = between(1, 10) === 1 ? cents(foreigntotal * 0.2) : 0; // unapplied

    transactions.push(txn);
    accountinglines.push(...glFor(txn, itemLines, taxLine, kind === 'ap' ? entityRecord.category : null));
    return txn;
  };

  let id = 1;
  for (; id <= 420; id++) pushTransaction(id, pick(AR_TYPES), customers[between(1, customers.length) - 1], 'ar');
  for (; id <= 580; id++) pushTransaction(id, pick(AP_TYPES), vendors[between(0, vendors.length - 1)], 'ap');
  // logistics: fulfillments (ship out), receipts (goods in), transfers (between warehouses)
  for (; id <= 650; id++) pushTransaction(id, 'ItemShip', customers[between(1, customers.length) - 1], 'ship');
  for (; id <= 695; id++) pushTransaction(id, 'ItemRcpt', vendors[between(0, vendors.length - 1)], 'rcpt');
  for (; id <= 720; id++) {
    const from = between(1, LOCATIONS.length);
    let to = between(1, LOCATIONS.length);
    if (to === from) to = (to % LOCATIONS.length) + 1;
    pushTransaction(id, 'TrnfrOrd', null, 'xfer', { location: from, lineLocation: to });
  }

  // Stock on hand; available = onhand minus open sales-order commitments
  // (open SO item lines are negative quantities, so commit -= quantity).
  const linesByTxn = new Map();
  for (const l of lines) {
    if (!linesByTxn.has(l.transaction)) linesByTxn.set(l.transaction, []);
    linesByTxn.get(l.transaction).push(l);
  }
  const committed = new Map();
  for (const txn of transactions) {
    if (txn.type !== 'SalesOrd' || txn.status !== OPEN_SO) continue;
    for (const l of linesByTxn.get(txn.id) ?? []) {
      if (l.mainline !== 'F' || l.taxline !== 'F' || !l.item) continue;
      const key = `${l.item}|${l.location}`;
      committed.set(key, (committed.get(key) ?? 0) + -l.quantity);
    }
  }
  const inventorybalances = [];
  for (const item of invParts) {
    for (const loc of LOCATIONS) {
      const quantityonhand = between(0, 400);
      const c = committed.get(`${item.id}|${loc.id}`) ?? 0;
      inventorybalances.push({
        item: item.id, location: loc.id, quantityonhand,
        quantityavailable: Math.max(0, quantityonhand - c),
      });
    }
  }

  return {
    customers, vendors, items, employees,
    subsidiaries: SUBSIDIARIES, locations: LOCATIONS, departments: DEPARTMENTS,
    classifications: CLASSES, currencies: CURRENCIES, accounts: ACCOUNTS,
    accountingperiods, transactions, lines, accountinglines,
    inventorybalances,
  };
}
