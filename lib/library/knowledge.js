// Verified NetSuite SuiteQL knowledge, confirmed by executing probe queries
// against a real account (test-only; no account data is stored here — these are
// generic NetSuite platform facts). Consumed by the generation prompt and by
// the server-side validator. Keep every claim here backed by a live probe.

// Structured facts the validator enforces mechanically.
export const SCHEMA_FACTS = {
  // Fields that exist in the record catalog but error for the SuiteQL SEARCH
  // channel. Never SELECT/JOIN/WHERE these; the query fails outright.
  notExposed: [
    { table: 'transaction', field: 'subsidiary', use: 'transactionline.subsidiary' },
  ],
  // Columns that are ledger-signed (credit-negative). Summing them raw gives
  // wrong-signed results on sales/AP lines.
  signed: {
    'transactionline.netamount': 'sales item lines are NEGATIVE — negate for revenue',
    'transactionline.quantity': 'sales item lines are NEGATIVE — negate for units',
    'transaction.foreigntotal': 'positive on AR (invoices), NEGATIVE on AP (vendor bills)',
    'transactionaccountingline.amount': 'debit positive, credit negative',
  },
  // The real basis for "open"/"outstanding", not foreigntotal + a status word.
  openBalanceField: 'foreignamountunpaid',
  // transaction.status is a raw per-type code, shown only via BUILTIN.DF.
  statusIsCode: true,
  // transactionline rows that must usually be excluded from item-level sums.
  lineFilters: ["mainline = 'F'", "taxline = 'F'"],
  nonProductItemTypes: ['Subtotal', 'Markup', 'Discount', 'ShipItem', 'TaxItem'],
  // accountingperiod rollup rows to exclude.
  periodRollupFlags: ['isadjust', 'isquarter', 'isyear'],
  // Confirmed-supported dialect features (do not avoid these).
  supported: ['TO_DATE', 'TO_CHAR', 'TRUNC', 'ADD_MONTHS', 'SYSDATE', 'NVL', 'FETCH FIRST', 'BUILTIN.DF'],
  // Unreliable — avoid.
  avoid: ['OFFSET (silently ignored in some contexts)'],
  // entity is polymorphic: join customer for AR types, vendor for AP types.
  entityJoin: { ar: 'customer', ap: 'vendor' },
  arTypes: ['CustInvc', 'CustCred', 'CustPymt', 'SalesOrd'],
  apTypes: ['VendBill', 'VendCred', 'VendPymt', 'PurchOrd'],
};

// Compact, prompt-injected rules. Ordered by how often they bite.
export const KNOWLEDGE_RULES = [
  "transaction.status is a RAW per-type code (e.g. 'A','B'), never the word 'open'/'paid'. To FILTER open items use foreignamountunpaid > 0; to DISPLAY status use BUILTIN.DF(t.status).",
  "Outstanding/open balance is foreignamountunpaid, NOT foreigntotal (which is the full original amount).",
  "transaction.subsidiary is NOT queryable (NOT_EXPOSED). Use transactionline.subsidiary and BUILTIN.DF() for the name.",
  "Sales transactionline.netamount and .quantity are NEGATIVE (credit-signed). Negate them (-tl.netamount) for revenue/units.",
  "When summing transactionline, add mainline='F' AND taxline='F', and constrain itemtype to real products (exclude Subtotal/Markup/Discount) — the table also holds header, tax and pseudo-lines.",
  "Department, class and location are LINE fields (transactionline), not header fields.",
  "GL truth is transactionaccountingline with posting='T'. amount is signed (debit+, credit-); income = credit-debit, expense = debit-credit.",
  "Vendor-bill foreigntotal is credit-signed (negative) — negate for a positive spend.",
  "accountingperiod has quarter/year/adjustment rollup rows: filter isadjust='F' (and isquarter='F' AND isyear='F' for month lists). Join on t.postingperiod.",
  "entity is polymorphic: join customer for AR types (CustInvc/CustCred/CustPymt/SalesOrd), vendor for AP types (VendBill/VendCred/VendPymt/PurchOrd).",
  "Dialect: TO_DATE/TO_CHAR/TRUNC/ADD_MONTHS/SYSDATE/NVL/FETCH FIRST/BUILTIN.DF are supported. Avoid OFFSET (unreliable). Use FETCH FIRST n ROWS ONLY for top-N.",
  "Use BUILTIN.DF(field) to turn an internal id (subsidiary, department, class, location, status) into its display name without an extra join.",
];

export function knowledgeText() {
  return 'Verified NetSuite SuiteQL rules (these override any assumption):\n' +
    KNOWLEDGE_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n');
}
