// Feedback-loop curation tool. Reads generation logs (the `suitesense.generation`
// lines the route emits, exported from your host's logs as JSONL on stdin),
// surfaces clean AI generations whose question class is NOT already well-covered
// by the verified library, and prints them for a human to review before adding
// to lib/library/queries.json. Promotion stays manual on purpose — the library's
// "verified" guarantee means a person confirmed each entry runs on a real account.
//
// Usage:
//   vercel logs <deployment> | grep suitesense.generation | node scripts/promote-candidates.mjs
//   cat generations.jsonl | node scripts/promote-candidates.mjs
import { retrieve } from '../lib/library/index.js';

const raw = await new Promise((resolve) => {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => (buf += d));
  process.stdin.on('end', () => resolve(buf));
});

const rows = raw
  .split('\n')
  .map((l) => {
    const i = l.indexOf('{');
    if (i < 0) return null;
    try { return JSON.parse(l.slice(i)); } catch { return null; }
  })
  .filter(Boolean);

// Clean AI generations only (no validator issues, not already a repair).
const clean = rows.filter((r) => r.source === 'ai' && r.ok && (!r.issues || r.issues.length === 0));

// Group by question; a class the library already answers confidently is covered.
const seen = new Set();
const candidates = [];
for (const r of clean) {
  const q = (r.q || '').trim();
  if (!q || seen.has(q)) continue;
  seen.add(q);
  const [top] = retrieve(q, 1);
  if (!top || top._score < 6) candidates.push({ q, coveredBy: top ? `${top.id} (weak, ${top._score})` : 'none' });
}

if (!candidates.length) {
  console.log('No promotion candidates — the library already covers the logged questions.');
} else {
  console.log(`${candidates.length} question class(es) the library does not confidently cover:\n`);
  for (const c of candidates) console.log(`  • "${c.q}"  [nearest: ${c.coveredBy}]`);
  console.log('\nReview each against a real account, then add a verified entry to lib/library/queries.json.');
}
