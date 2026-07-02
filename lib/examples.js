// Curated NL -> SuiteQL pairs. Used as few-shot examples for the AI and as
// the fallback library when no ANTHROPIC_API_KEY is configured.
export const EXAMPLES = [
  {
    keywords: ['top', 'customers', 'revenue'],
    question: 'Top 10 customers by revenue',
    sql: `SELECT c.companyname, SUM(t.foreigntotal) AS revenue
FROM transaction t
JOIN customer c ON c.id = t.entity
WHERE t.type = 'CustInvc'
GROUP BY c.companyname
ORDER BY revenue DESC
FETCH FIRST 10 ROWS ONLY`,
  },
  {
    keywords: ['monthly', 'revenue', 'month', 'trend'],
    question: 'Monthly invoice revenue trend',
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
