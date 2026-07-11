// Feedback capture for the generation loop. Every generation records its
// outcome (source, validator verdict, timing); the client can later report
// whether the SQL actually ran. Captured signal is how failures become future
// fixes — but promotion INTO the verified library stays a reviewed step
// (see scripts/promote-candidates.mjs), never automatic, so the library's
// "verified" guarantee holds.
// ponytail: structured console logs (Vercel captures them) + an in-memory ring
// buffer for the live session. Swap for a KV/table when durable history is
// needed — the record() shape is already storage-agnostic.

const RING = [];
const MAX = 200;

export function record(event) {
  const entry = { at: new Date().toISOString(), ...event };
  RING.push(entry);
  if (RING.length > MAX) RING.shift();
  // one structured line per generation — greppable in server logs
  console.log('suitesense.generation ' + JSON.stringify({
    source: entry.source,
    ok: entry.ok,
    issues: (entry.issues || []).map((i) => i.id),
    repaired: entry.repaired || false,
    ms: entry.ms,
    q: (entry.question || '').slice(0, 120),
  }));
  return entry;
}

export function reportExecution({ id, executed, error }) {
  console.log('suitesense.execution ' + JSON.stringify({ id, executed, error: error ? String(error).slice(0, 200) : null }));
}

// Candidates a human could review for promotion into the library: generations
// that passed validation clean and (optionally) the user confirmed ran.
export function candidates() {
  return RING.filter((e) => e.ok && e.source === 'ai');
}

export function recent(n = 50) {
  return RING.slice(-n);
}
