// Curated NL -> SuiteQL pairs. Used as few-shot examples for the AI and as
// the fallback library when no ANTHROPIC_API_KEY is configured.
export const EXAMPLES = [
  {
    keywords: ['top', 'customers', 'revenue'],
    question: 'Top 10 customers by revenue',
    fewshot: true,
    sql: `SELECT c.companyname, SUM(t.foreigntotal) AS revenue
FROM transaction t
JOIN customer c ON c.id = t.entity
WHERE t.type = 'CustInvc'
GROUP BY c.companyname
ORDER BY revenue DESC
FETCH FIRST 10 ROWS ONLY`,
  },
  {
    keywords: ['profit', 'loss', 'expenses', 'net', 'income'],
    question: 'Profit and loss by month',
    fewshot: true,
    sql: `SELECT TO_CHAR(t.trandate, 'YYYY-MM') AS month,
       SUM(CASE WHEN a.accttype = 'Income' THEN tal.credit - tal.debit ELSE 0 END) AS income,
       SUM(CASE WHEN a.accttype IN ('COGS', 'Expense') THEN tal.debit - tal.credit ELSE 0 END) AS expenses,
       SUM(CASE WHEN a.accttype = 'Income' THEN tal.credit - tal.debit ELSE 0 END)
         - SUM(CASE WHEN a.accttype IN ('COGS', 'Expense') THEN tal.debit - tal.credit ELSE 0 END) AS net
FROM transactionaccountingline tal
JOIN transaction t ON t.id = tal.transaction
JOIN account a ON a.id = tal.account
WHERE tal.posting = 'T'
GROUP BY TO_CHAR(t.trandate, 'YYYY-MM')
ORDER BY month`,
  },
  {
    keywords: ['monthly', 'revenue', 'month', 'trend'],
    question: 'Monthly invoice revenue trend',
    fewshot: true,
    sql: `SELECT TO_CHAR(t.trandate, 'YYYY-MM') AS month, SUM(t.foreigntotal) AS revenue
FROM transaction t
WHERE t.type = 'CustInvc'
GROUP BY TO_CHAR(t.trandate, 'YYYY-MM')
ORDER BY month`,
  },
  {
    keywords: ['open', 'invoices', 'unpaid', 'outstanding'],
    question: 'Open invoices with customer names',
    sql: `SELECT t.tranid, c.companyname, t.trandate, t.foreigntotal
FROM transaction t
JOIN customer c ON c.id = t.entity
WHERE t.type = 'CustInvc' AND t.status = 'open'
ORDER BY t.trandate`,
  },
  {
    keywords: ['sales', 'rep', 'performance', 'employee'],
    question: 'Invoice revenue by sales rep',
    sql: `SELECT e.firstname || ' ' || e.lastname AS rep, SUM(t.foreigntotal) AS revenue
FROM transaction t
JOIN employee e ON e.id = t.employee
WHERE t.type = 'CustInvc'
GROUP BY e.firstname, e.lastname
ORDER BY revenue DESC`,
  },
  {
    keywords: ['best', 'selling', 'items', 'products', 'quantity'],
    question: 'Best-selling items by units sold',
    fewshot: true,
    sql: `SELECT i.displayname, SUM(l.quantity) AS units, SUM(l.netamount) AS revenue
FROM transactionline l
JOIN item i ON i.id = l.item
JOIN transaction t ON t.id = l.transaction
WHERE t.type = 'CustInvc'
GROUP BY i.displayname
ORDER BY units DESC
FETCH FIRST 10 ROWS ONLY`,
  },
  {
    keywords: ['territory', 'region'],
    question: 'Revenue by territory',
    sql: `SELECT c.territory, SUM(t.foreigntotal) AS revenue
FROM transaction t
JOIN customer c ON c.id = t.entity
WHERE t.type = 'CustInvc'
GROUP BY c.territory
ORDER BY revenue DESC`,
  },
  {
    keywords: ['new', 'customers', 'recent', 'created'],
    question: 'Customers created in the last 12 months',
    sql: `SELECT c.entityid, c.companyname, c.datecreated, c.territory
FROM customer c
WHERE c.datecreated > ADD_MONTHS(SYSDATE, -12)
ORDER BY c.datecreated DESC`,
  },
  {
    keywords: ['average', 'invoice', 'value', 'size'],
    question: 'Average invoice value by month',
    sql: `SELECT TO_CHAR(t.trandate, 'YYYY-MM') AS month, ROUND(AVG(t.foreigntotal), 2) AS avg_invoice
FROM transaction t
WHERE t.type = 'CustInvc'
GROUP BY TO_CHAR(t.trandate, 'YYYY-MM')
ORDER BY month`,
  },
  {
    keywords: ['credit', 'memos', 'refunds'],
    question: 'Credit memos issued with customers',
    sql: `SELECT t.tranid, c.companyname, t.trandate, t.foreigntotal
FROM transaction t
JOIN customer c ON c.id = t.entity
WHERE t.type = 'CustCred'
ORDER BY t.trandate DESC`,
  },
  {
    keywords: ['pending', 'fulfillment', 'orders', 'sales orders'],
    question: 'Sales orders pending fulfillment',
    sql: `SELECT t.tranid, c.companyname, t.trandate, t.foreigntotal
FROM transaction t
JOIN customer c ON c.id = t.entity
WHERE t.type = 'SalesOrd' AND t.status = 'pendingFulfillment'
ORDER BY t.trandate`,
  },
  {
    keywords: ['vendors', 'spend', 'suppliers'],
    question: 'Top vendors by spend',
    fewshot: true,
    sql: `SELECT v.companyname, v.category, SUM(t.foreigntotal) AS spend
FROM transaction t
JOIN vendor v ON v.id = t.entity
WHERE t.type = 'VendBill'
GROUP BY v.companyname, v.category
ORDER BY spend DESC
FETCH FIRST 10 ROWS ONLY`,
  },
  {
    keywords: ['bills', 'payable', 'owe', 'unpaid vendor'],
    question: 'Open vendor bills',
    sql: `SELECT t.tranid, v.companyname, t.trandate, t.foreigntotal
FROM transaction t
JOIN vendor v ON v.id = t.entity
WHERE t.type = 'VendBill' AND t.status = 'open'
ORDER BY t.trandate`,
  },
  {
    keywords: ['department', 'division'],
    question: 'Invoice revenue by department',
    sql: `SELECT d.name AS department, SUM(l.netamount) AS revenue
FROM transactionline l
JOIN transaction t ON t.id = l.transaction
JOIN department d ON d.id = l.department
WHERE t.type = 'CustInvc'
GROUP BY d.name
ORDER BY revenue DESC`,
  },
  {
    keywords: ['stock', 'inventory', 'hand', 'warehouse', 'available'],
    question: 'Stock on hand by location',
    fewshot: true,
    sql: `SELECT loc.name AS location, i.itemid, i.displayname, ib.quantityonhand, ib.quantityavailable
FROM inventorybalance ib
JOIN item i ON i.id = ib.item
JOIN location loc ON loc.id = ib.location
ORDER BY loc.name, ib.quantityonhand DESC`,
  },
  {
    keywords: ['subsidiary', 'currency', 'consolidated', 'aud'],
    question: 'Invoice revenue by subsidiary in AUD',
    fewshot: true,
    sql: `SELECT s.name AS subsidiary, cur.name AS currency,
       SUM(t.foreigntotal) AS revenue_local,
       ROUND(SUM(t.foreigntotal * t.exchangerate), 2) AS revenue_aud
FROM transaction t
JOIN subsidiary s ON s.id = t.subsidiary
JOIN currency cur ON cur.id = t.currency
WHERE t.type = 'CustInvc'
GROUP BY s.name, cur.name
ORDER BY revenue_aud DESC`,
  },
];

// Cheap keyword-overlap match for keyless fallback mode.
export function matchExample(question) {
  const words = question.toLowerCase().split(/\W+/).filter(Boolean);
  let best = null;
  let bestScore = 0;
  for (const ex of EXAMPLES) {
    const score = ex.keywords.filter((k) => words.some((w) => w.startsWith(k.slice(0, 5)))).length;
    if (score > bestScore) {
      best = ex;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : EXAMPLES[0];
}
