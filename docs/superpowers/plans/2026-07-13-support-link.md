# Support SuiteSense Funding Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "❤️ Support SuiteSense" topbar pill on both pages whose heart pulses like a heartbeat when a console query returns results, opening a modal with a short donation pitch and Buy Me a Coffee's embedded payment page — donors pay without leaving the site.

**Architecture:** One self-contained client component (`SupportLink`) owns the pill, the pulse throttle, and the modal; it iframes BMC's embeddable widget page directly (the same URL BMC's own floating-widget script embeds), so no third-party script ever loads and nothing loads from BMC until the pill is clicked. The console passes a `pulseKey` counter incremented only on successful query runs; the library page renders the component with no props (it never pulses).

**Tech Stack:** Next.js 15 App Router, plain JS + React hooks, plain CSS in `app/globals.css`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-13-fund-me-design.md` (approved 2026-07-13).

## Global Constraints

- **No new npm dependencies. No third-party scripts** (BMC's widget script is explicitly excluded). No analytics.
- **Exact URLs:** profile `https://buymeacoffee.com/tricksterbivek`, embed `https://buymeacoffee.com/widget/page/tricksterbivek`. Both verified live 2026-07-13; the embed URL serves BMC's payment app with no frame-blocking headers.
- **Exact user-facing copy** (owner-approved; site copy never uses em dashes):
  - Pill: `❤️ Support SuiteSense` — tooltip: `Fund a better AI model for SuiteSense`
  - Modal header: `Support SuiteSense` — fallback link: `Open in new tab ↗`
  - Pitch: `SuiteSense runs on free-tier AI models today. Every coffee goes straight to the model bill. A stronger model means faster, more accurate SuiteQL for everyone. If it saved you time, consider fueling it.`
- **Pulse rules:** success only (never on error paths), 0.9s heartbeat × 2 (~1.8s total), at most once per 30s, animation only under `@media (prefers-reduced-motion: no-preference)` (codebase pattern, see `app/globals.css:506`).
- **Verification style:** this repo has NO React test runner (`npm run check` runs node `.mjs` tests for `lib/` only). Do NOT add jest/RTL/jsdom. UI verification = `npm run check` + `npm run build` + the exact manual browser checks in each task.
- **Git:** commit as the configured git user (`tricksterbivek@gmail.com`). NEVER add a `Co-Authored-By: Claude` line to commits. Work stays on branch `feat/support-link` (already exists, holds the spec commits).
- Dev server: `npm run dev` (Turbopack) at http://localhost:3000. If it 500s with missing-manifest errors after a prod build, `rm -rf .next` and restart (known quirk in this repo).

---

### Task 1: SupportLink component + styles

**Files:**
- Create: `app/components/SupportLink.js`
- Modify: `app/globals.css` (append new section at end of file, currently 1020 lines)

**Interfaces:**
- Consumes: nothing (design tokens already in `:root` of `app/globals.css`: `--primary`, `--primary-deep`, `--primary-soft`, `--canvas`, `--surface-soft`, `--hairline-soft`, `--ink-deep`, `--charcoal`, `--steel`, `--r-xl`, `--r-full`, `--shadow-panel`, `--ease`).
- Produces: default export `SupportLink({ pulseKey })` — `pulseKey` optional number, default `0`; each increment past 0 requests a pulse. CSS classes: `.support-pill`, `.support-pill .heart`, `.support-pill.pulse`, `.support-overlay`, `.support-modal`, `.support-modal-head`, `.support-close`, `.support-pitch`. Tasks 2 and 3 import this component.

- [ ] **Step 1: Create the component**

Create `app/components/SupportLink.js` with exactly:

```jsx
'use client';

import { useEffect, useRef, useState } from 'react';

const FUND_URL = 'https://buymeacoffee.com/tricksterbivek'; // profile (new-tab fallback)
const WIDGET_URL = 'https://buymeacoffee.com/widget/page/tricksterbivek'; // embeddable payment page
const PULSE_COOLDOWN_MS = 30000;
const PULSE_DURATION_MS = 1800; // heartbeat 0.9s x2 in globals.css

// Topbar "Support SuiteSense" pill. The heart pulses when pulseKey increments
// (a query run succeeded), throttled so the param form's auto re-runs can't
// cause a pulse storm. The modal iframes Buy Me a Coffee's widget page — the
// same URL their floating-widget script embeds — so donors pay without
// leaving the site and we ship zero third-party scripts. Nothing loads from
// BMC until the pill is clicked.
export default function SupportLink({ pulseKey = 0 }) {
  const [open, setOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const lastPulse = useRef(0);

  useEffect(() => {
    if (!pulseKey) return; // mount / pages that never pulse
    const now = Date.now();
    if (now - lastPulse.current < PULSE_COOLDOWN_MS) return;
    lastPulse.current = now;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), PULSE_DURATION_MS);
    return () => clearTimeout(t);
  }, [pulseKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`support-pill${pulsing ? ' pulse' : ''}`}
        title="Fund a better AI model for SuiteSense"
        onClick={() => setOpen(true)}
      >
        <span className="heart" aria-hidden="true">❤️</span>
        <span className="support-pill-label">Support SuiteSense</span>
      </button>
      {open && (
        <div className="support-overlay" onClick={() => setOpen(false)}>
          <div
            className="support-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Support SuiteSense"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="support-modal-head">
              <strong>Support SuiteSense</strong>
              <a href={FUND_URL} target="_blank" rel="noreferrer">Open in new tab ↗</a>
              <button type="button" className="support-close" onClick={() => setOpen(false)} autoFocus aria-label="Close">✕</button>
            </div>
            <p className="support-pitch">
              SuiteSense runs on free-tier AI models today. Every coffee goes straight to
              the model bill. A stronger model means faster, more accurate SuiteQL for
              everyone. If it saved you time, consider fueling it.
            </p>
            <iframe src={WIDGET_URL} title="Support SuiteSense on Buy Me a Coffee" allow="payment" />
          </div>
        </div>
      )}
    </>
  );
}
```

Notes for the implementer: `pulseKey = 0` is the "never pulse" case — the effect's `if (!pulseKey) return;` guard makes the library page (no prop) inert. `allow="payment"` lets Google Pay/Apple Pay work inside BMC's cross-origin iframe. The backdrop `onClick` closes; `stopPropagation` on the card keeps clicks inside it from closing.

- [ ] **Step 2: Append the styles**

Append to the END of `app/globals.css` (after the current last line, 1020):

```css
/* ---------- support ---------- */

.support-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.14px;
  color: var(--primary-deep);
  background: var(--primary-soft);
  border: 2px solid transparent;
  border-radius: var(--r-full);
  padding: 8px 18px;
  cursor: pointer;
  transition: border-color 0.2s var(--ease);
}

.support-pill:hover {
  border-color: var(--primary);
}

.support-pill .heart {
  display: inline-block;
  line-height: 1;
}

@media (prefers-reduced-motion: no-preference) {
  .support-pill.pulse .heart {
    animation: heartbeat 0.9s ease-in-out 2;
  }
}

@keyframes heartbeat {
  0%, 56%, 100% { transform: scale(1); }
  14%, 42% { transform: scale(1.35); }
  28% { transform: scale(1); }
}

@media (max-width: 639px) {
  .support-pill {
    padding: 8px 12px;
  }
  .support-pill-label {
    display: none; /* icon-only pill keeps the topbar intact on phones */
  }
}

.support-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 19, 23, 0.55);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 50;
}

.support-modal {
  width: 420px;
  max-width: 100%;
  height: min(680px, 85vh);
  background: var(--canvas);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.support-modal-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hairline-soft);
}

.support-modal-head strong {
  flex: 1;
  color: var(--ink-deep);
  font-size: 0.95rem;
}

.support-modal-head a {
  color: var(--steel);
  font-size: 0.78rem;
  text-decoration: none;
  white-space: nowrap;
}

.support-modal-head a:hover {
  color: var(--primary);
  text-decoration: underline;
}

.support-close {
  font-family: var(--sans);
  font-size: 1.05rem;
  line-height: 1;
  color: var(--steel);
  background: none;
  border: 0;
  padding: 4px 6px;
  cursor: pointer;
}

.support-close:hover {
  color: var(--ink-deep);
}

.support-pitch {
  padding: 12px 16px;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--charcoal);
  background: var(--surface-soft);
  border-bottom: 1px solid var(--hairline-soft);
}

.support-modal iframe {
  flex: 1;
  width: 100%;
  border: 0;
}
```

Context: highest existing `z-index` in the file is 5 (`.lib-controls`), so 50 sits above everything. The `prefers-reduced-motion: no-preference` gate matches the existing pattern at `app/globals.css:506`.

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/Bivek.Shah/Documents/fable/netsuite/suitesense && npm run build`
Expected: build succeeds with no errors. (The component isn't imported anywhere yet — this checks syntax and the client-component boundary only.)

- [ ] **Step 4: Commit**

```bash
git add app/components/SupportLink.js app/globals.css
git commit -m "feat: SupportLink pill with heartbeat pulse and in-page Buy Me a Coffee modal"
```

---

### Task 2: Console wiring — pulse on successful runs

**Files:**
- Modify: `app/page.js` (imports block lines 3–9; state near line 186; `run()` success path near line 195; topbar near lines 219–233)

**Interfaces:**
- Consumes: `SupportLink` default export from Task 1 — `<SupportLink pulseKey={number} />`.
- Produces: nothing downstream; this completes the console.

- [ ] **Step 1: Import the component**

In `app/page.js`, the imports currently end:

```js
import ParamForm, { defaultParamValues } from './components/ParamForm.js';
import { QUERIES } from '../lib/library/index.js';
import { TABLES } from '../lib/schema.js';
```

Add after the ParamForm import:

```js
import SupportLink from './components/SupportLink.js';
```

- [ ] **Step 2: Add the pulse counter, incremented only on success**

Near line 186 the file reads:

```js
  const [demoGap, setDemoGap] = useState(null);

  async function run(query = resolvedSql) {
    setError(null);
    setDemoGap(null);
    try {
      const t0 = performance.now();
      const res = await runSuiteQL(query);
      setElapsed(Math.max(1, Math.round(performance.now() - t0)));
      setResults(res);
    } catch (err) {
      setResults(null);
      setElapsed(null);
      setDemoGap(String(err.message || err));
    }
  }
```

Change it to (two additions: the state line, and one line after `setResults(res);`):

```js
  const [demoGap, setDemoGap] = useState(null);
  // Counts successful runs; SupportLink pulses on increments (never on errors).
  const [resultPulse, setResultPulse] = useState(0);

  async function run(query = resolvedSql) {
    setError(null);
    setDemoGap(null);
    try {
      const t0 = performance.now();
      const res = await runSuiteQL(query);
      setElapsed(Math.max(1, Math.round(performance.now() - t0)));
      setResults(res);
      setResultPulse((p) => p + 1);
    } catch (err) {
      setResults(null);
      setElapsed(null);
      setDemoGap(String(err.message || err));
    }
  }
```

Do NOT touch `generate()` — it calls `run()`, which is the single success point. The `catch` block gets no increment: errors never pulse.

- [ ] **Step 3: Render the pill in the topbar**

The topbar currently ends (lines 219–233):

```jsx
        <div className="topbar-right">
          <span className="status">
            <span className="status-dot" />
            demo dataset · in-browser SQLite
          </span>
          <Link className="byline" href="/library">Query Library</Link>
          <a
            className="byline"
            href="https://www.linkedin.com/in/bivekshah/"
            target="_blank"
            rel="noreferrer"
          >
            Built with ❤️ By Trickster
          </a>
        </div>
```

Add the pill as the LAST child, immediately after the LinkedIn `</a>`:

```jsx
          <SupportLink pulseKey={resultPulse} />
        </div>
```

- [ ] **Step 4: Verify in the browser**

Run: `cd /Users/Bivek.Shah/Documents/fable/netsuite/suitesense && npm run dev`, open http://localhost:3000. Check, in order:

1. Pill renders last in the topbar, after "Built with ❤️ By Trickster"; hover shows tooltip "Fund a better AI model for SuiteSense".
2. Click a suggestion chip. When the results table appears, the ❤️ visibly thumps twice (~2s) then stops.
3. Immediately run another suggestion. Results appear but the heart does NOT pulse again (30s cooldown).
4. Type gibberish SQL in the editor (e.g. `SELEC nope`) and press Run so the friendly demo-gap note appears: no pulse.
5. Click the pill: modal opens centered with the pitch text and BMC's payment page inside the iframe (amount buttons visible). Escape closes it; reopen; click the dark backdrop, it closes; reopen; ✕ closes. Page behind doesn't scroll while open.
6. "Open in new tab ↗" opens https://buymeacoffee.com/tricksterbivek in a new tab.
7. Devtools network tab, fresh reload: NO request to any buymeacoffee.com host until the pill is clicked.

- [ ] **Step 5: Commit**

```bash
git add app/page.js
git commit -m "feat: console pulses SupportLink heart on successful query runs"
```

---

### Task 3: Library page wiring

**Files:**
- Modify: `app/library/page.js` (imports lines 1–3; topbar-right lines 23–25)

**Interfaces:**
- Consumes: `SupportLink` default export from Task 1, rendered with NO props (`pulseKey` defaults to 0, so it never pulses — this page doesn't execute queries).

- [ ] **Step 1: Import and render**

`app/library/page.js` currently starts:

```jsx
import Link from 'next/link';
import { QUERIES, CATEGORIES } from '../../lib/library/index.js';
import LibraryBrowser from './browser.js';
```

Add:

```jsx
import SupportLink from '../components/SupportLink.js';
```

And change the topbar-right block from:

```jsx
        <div className="topbar-right">
          <Link className="byline" href="/">← Console</Link>
        </div>
```

to:

```jsx
        <div className="topbar-right">
          <Link className="byline" href="/">← Console</Link>
          <SupportLink />
        </div>
```

This file is a server component; importing the `'use client'` component makes it a standard client island — no other change needed.

- [ ] **Step 2: Verify in the browser**

With the dev server still running, open http://localhost:3000/library:

1. Pill renders after "← Console"; modal opens/closes exactly as on the console (Escape, backdrop, ✕).
2. Browse/select library entries: the heart never pulses on this page.
3. Narrow the window to ~375px: the pill collapses to icon-only (❤️), the topbar stays on one line and nothing overflows, on BOTH pages.

- [ ] **Step 3: Commit**

```bash
git add app/library/page.js
git commit -m "feat: SupportLink pill on the library page"
```

---

### Task 4: Full verification, PR, deploy

**Files:** none created/modified (verification and rollout only).

**Interfaces:**
- Consumes: the complete `feat/support-link` branch from Tasks 1–3.

- [ ] **Step 1: Run the full check suite and prod build**

```bash
cd /Users/Bivek.Shah/Documents/fable/netsuite/suitesense
npm run check && npm run build
```

Expected: all 5 test suites pass (translate, demoData, retrieval, providers); build succeeds. If the dev server was running against `.next` during the build and later 500s, `rm -rf .next` and restart it.

- [ ] **Step 2: Push and open the PR**

The `gh` CLI's active account (`bivekshah-vidacorp`) cannot push to this repo — switch, push, and switch back at the end:

```bash
gh auth switch --user tricksterbivek
git push -u origin feat/support-link
gh pr create --title "feat: Support SuiteSense funding (heartbeat pill + in-page Buy Me a Coffee modal)" --body "$(cat <<'EOF'
## What

- New topbar pill on console and /library: "❤️ Support SuiteSense"
- Heart pulses (0.9s heartbeat x2) when a console query run succeeds; success-only, 30s cooldown, disabled under reduced-motion
- Clicking opens a modal: short pitch + Buy Me a Coffee's embeddable widget page in an iframe (allow="payment"), so donors pay without leaving the site
- Zero third-party scripts; nothing loads from BMC until the pill is clicked
- New-tab fallback link to the profile in the modal header

## Spec

docs/superpowers/specs/2026-07-13-fund-me-design.md

## Verification

- npm run check (5 suites) and npm run build green
- Manual: pulse on success only, cooldown works, no pulse on errors or on /library; modal open/close via X, backdrop, Escape; payment UI renders in-frame; no BMC network traffic before click; icon-only pill at 375px

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Merge and deploy**

```bash
gh pr merge --merge
git checkout main && git pull origin main
gh auth switch --user bivekshah-vidacorp
vercel deploy --prod --yes
```

Expected: merge succeeds; deploy prints a production URL for suitesense.vercel.app.

- [ ] **Step 4: Live smoke test**

```bash
curl -s https://suitesense.vercel.app | grep -o "Support SuiteSense" | head -2
curl -s https://suitesense.vercel.app/library | grep -o "Support SuiteSense" | head -2
```

Expected: both print `Support SuiteSense` (pill is server-rendered into the HTML on both pages). Then open https://suitesense.vercel.app in a real browser: run a suggestion, watch the heart thump, open the modal, confirm BMC's payment UI loads in production (its embed behavior is identical, but confirm once live).

- [ ] **Step 5: Report**

Summarize to the owner: live URL, what shipped, the pulse guardrails, and that the BMC account is receiving test-free (real) payments from here on.
