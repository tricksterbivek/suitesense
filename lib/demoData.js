// Deterministic demo dataset shaped like a small NetSuite account.
// Seeded PRNG so every visitor sees the same numbers.
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
const STATUSES = { CustInvc: ['open', 'paid', 'paid', 'paid'], SalesOrd: ['pendingFulfillment', 'closed', 'closed'], CustPymt: ['paid'], CustCred: ['closed'] };
const TYPES = ['CustInvc', 'CustInvc', 'CustInvc', 'SalesOrd', 'SalesOrd', 'CustPymt', 'CustCred'];

function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function buildDemoData() {
  const rand = mulberry32(20260703);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

  const customers = COMPANIES.map((name, i) => ({
    id: i + 1,
    entityid: `CUST-${100 + i}`,
    companyname: name,
    email: `accounts@${name.toLowerCase().replace(/[^a-z]/g, '')}.example.com`,
    datecreated: isoDate(between(2023, 2025), between(1, 12), between(1, 28)),
    salesrep: between(1, EMPLOYEES.length),
    territory: pick(TERRITORIES),
  }));

  const items = ITEMS.map(([itemid, displayname, itemtype, baseprice], i) => ({
    id: i + 1,
    itemid,
    displayname,
    itemtype,
    baseprice,
  }));

  const transactions = [];
  const lines = [];
  let lineId = 1;
  // 2 years of history ending mid-2026
  for (let t = 1; t <= 420; t++) {
    const type = pick(TYPES);
    const monthsBack = between(0, 23);
    const y = monthsBack < 7 ? 2026 : monthsBack < 19 ? 2025 : 2024;
    const m = monthsBack < 7 ? 7 - monthsBack : monthsBack < 19 ? 19 - monthsBack : 31 - monthsBack;
    const customer = between(1, customers.length);
    const txn = {
      id: t,
      tranid: `${type === 'CustInvc' ? 'INV' : type === 'SalesOrd' ? 'SO' : type === 'CustPymt' ? 'PAY' : 'CM'}-${1000 + t}`,
      type,
      entity: customer,
      trandate: isoDate(y, m, between(1, 28)),
      status: pick(STATUSES[type]),
      employee: customers[customer - 1].salesrep,
      memo: '',
      foreigntotal: 0,
    };
    const lineCount = type === 'CustPymt' ? 1 : between(1, 5);
    let total = 0;
    for (let l = 0; l < lineCount; l++) {
      const item = items[between(0, items.length - 1)];
      const quantity = item.itemtype === 'Service' ? between(1, 3) : between(1, 12);
      const rate = item.baseprice;
      const netamount = Math.round(quantity * rate * (0.9 + rand() * 0.2));
      lines.push({ id: lineId++, transaction: t, item: item.id, quantity, rate, netamount });
      total += netamount;
    }
    txn.foreigntotal = type === 'CustCred' ? -total : total;
    transactions.push(txn);
  }

  return { customers, items, employees: EMPLOYEES.map(([id, entityid, firstname, lastname, title]) => ({ id, entityid, firstname, lastname, title })), transactions, lines };
}
