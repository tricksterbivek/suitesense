// Verified query library: load + retrieval. Single source of truth for both
// the AI generation layer (few-shot + adapt) and the /library browse UI.
// ponytail: keyword+category scoring over a curated corpus of dozens of
// entries — no embeddings/vector DB needed at this size. Revisit if it grows
// past a few hundred entries or recall gets poor.
import queriesDoc from './queries.json' with { type: 'json' };
import failuresDoc from './failures.json' with { type: 'json' };

export const QUERIES = queriesDoc.queries;
export const FAILURES = failuresDoc.failures;
export const CATEGORIES = [...new Set(QUERIES.map((q) => q.category))];

const WORD = /[a-z0-9]+/g;
const tokens = (s) => (s.toLowerCase().match(WORD) || []);

// Score a library entry against a free-text question. Keyword hits dominate;
// category/intent words add a little. Returns 0 when nothing matches.
function score(entry, qWords) {
  const kw = new Set(entry.keywords.flatMap((k) => tokens(k)));
  const intent = new Set(tokens(entry.intent + ' ' + entry.category));
  let s = 0;
  for (const w of qWords) {
    if (kw.has(w)) s += 3;
    else if (intent.has(w)) s += 1;
    else if ([...kw].some((k) => k.length > 4 && (k.startsWith(w) || w.startsWith(k)))) s += 2;
  }
  return s;
}

// Retrieve the top-k library matches for a question, best first.
export function retrieve(question, k = 4) {
  const qWords = [...new Set(tokens(question))];
  if (!qWords.length) return [];
  return QUERIES.map((q) => ({ q, s: score(q, qWords) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => ({ ...x.q, _score: x.s }));
}

// The single best match, only if it clears a confidence floor — the caller can
// choose to adapt it directly rather than generate from scratch.
export function bestMatch(question, floor = 6) {
  const [top] = retrieve(question, 1);
  return top && top._score >= floor ? top : null;
}

// Failures relevant to a question (by keyword overlap with the trap text),
// so the prompt can warn against the traps most likely to apply.
export function relevantFailures(question, k = 4) {
  const qWords = new Set(tokens(question));
  return FAILURES.map((f) => {
    const fWords = new Set(tokens(f.trap + ' ' + f.category || ''));
    let s = 0;
    for (const w of qWords) if (fWords.has(w)) s += 1;
    return { f, s };
  })
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.f);
}
