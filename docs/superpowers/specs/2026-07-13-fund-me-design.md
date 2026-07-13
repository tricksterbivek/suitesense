# Support SuiteSense Funding Link — Design

**Date:** 2026-07-13
**Status:** Approved in session (owner picked wording, placement, in-page donation flow, and results-triggered heartbeat pulse; URLs verified)

## Goal

Let visitors fund SuiteSense's LLM costs (a stronger model) **without leaving the site**, with the ask surfacing at the moment of delivered value: the support heart pulses like a heartbeat when a query returns results, and clicking it opens a modal that explains why donations matter plus Buy Me a Coffee's embedded payment flow. No payment processing code enters the app.

## Decision record

- **Platform: Buy Me a Coffee** — profile `https://buymeacoffee.com/tricksterbivek` (created by the owner; verified HTTP 200 on 2026-07-13). Chosen because donors arrive mostly from LinkedIn — NetSuite consultants and finance people who may not have GitHub accounts. Buy Me a Coffee accepts any card/PayPal with no donor account. GitHub Sponsors (0% fee) can be added later; both URLs live in one component, so a swap is a one-file change.
- **In-page donation via the widget page, not the widget script.** BMC's floating-widget script is just a wrapper that iframes `https://buymeacoffee.com/widget/page/tricksterbivek`. Verified 2026-07-13: that URL returns 200 with **no** `X-Frame-Options` / `frame-ancestors` (deliberately embeddable — the main profile page blocks framing with `SAMEORIGIN`), and its body is BMC's payment app. Embedding it in our own modal gives the in-page flow with zero third-party scripts, no floating button, and our own trigger.
- **UI: compact topbar pill, wording "❤️ Support SuiteSense"** — placed right after the "Built with ❤️ By Trickster" byline on the console, last in the topbar on both pages. Clicking opens the modal.
- **Heartbeat pulse on results (owner request):** whenever a query run returns results successfully on the console, the ❤️ inside the pill does a short heartbeat animation. Taste guardrails: fires only on **success** (never after an error), a short double-thump (~1.8s, two beats) rather than continuous pulsing, at most once per 30 seconds (so the param form's auto re-runs can't cause a pulse storm), and disabled entirely under `prefers-reduced-motion`. The library page doesn't execute queries, so it never pulses there.
- **Modal = pitch + payment.** A short honest paragraph on why donations matter (free-tier models today; donations go to the model bill) above the embedded BMC payment page. No overclaiming, consistent with existing site copy standards.
- **Nothing loads from BMC until the pill is clicked** — the iframe mounts only when the modal opens. Consistent with the site's privacy posture ("queries never leave your browser").
- **Explicitly excluded (YAGNI):** BMC's floating-widget script, landing-page support card, hero subline, click analytics, full focus-trap library (basic dialog semantics only), automated tests for the modal.

## Components

### `app/components/SupportLink.js` (new, `'use client'`)

- The single home of both URLs:
  ```js
  const FUND_URL = 'https://buymeacoffee.com/tricksterbivek';          // profile (new-tab fallback)
  const WIDGET_URL = 'https://buymeacoffee.com/widget/page/tricksterbivek'; // embeddable payment page
  ```
- Props: `pulseKey` (optional number). Each increment requests a pulse; the component pulses only if ≥30s have passed since the last pulse (`useRef` timestamp), setting a `pulsing` state that a ~1.8s timeout clears.
- Trigger: `<button className="support-pill" title="Fund a better AI model for SuiteSense">` containing `<span className="heart">❤️</span> Support SuiteSense`; the `pulsing` state adds a `pulse` class to the button.
- Modal (only rendered while open): fixed dimmed backdrop (click closes) + centered card (`role="dialog"` `aria-modal="true"`, close button focused on open, Escape closes, body scroll locked while open) containing:
  - header row: "Support SuiteSense", an "Open in new tab ↗" link to `FUND_URL` (`target="_blank" rel="noreferrer"`), and a ✕ close button;
  - the pitch: 2–3 honest sentences — SuiteSense currently runs on free-tier AI models; donations go straight to the model bill for stronger, more accurate SuiteQL; if it saved you time today, consider fueling it;
  - `<iframe src={WIDGET_URL} title="Support SuiteSense on Buy Me a Coffee" />` filling the remaining height.
- No other state, no dependencies. Used as a client island by both pages.

### `app/globals.css` (modify)

- `.support-pill`: compact rounded pill using the existing accent design tokens — thin accent border, subtle background tint, gentle hover brighten, same font size as `.byline`; button reset (no default browser chrome). Compact enough that topbar wrapping at ~375px is unchanged.
- `@keyframes heartbeat`: classic double-thump (scale 1 → 1.3 → 1 → 1.3 → 1 within the cycle); `.support-pill.pulse .heart { animation: heartbeat 0.9s ease-in-out 2; }`. Under `@media (prefers-reduced-motion: reduce)` the animation is disabled.
- `.support-overlay` / `.support-modal` / `.support-modal-head` / `.support-pitch`: fixed full-viewport dimmed backdrop; centered card (~420px wide, max-height ~85vh, effectively full-screen on small viewports); header row; short pitch block; iframe at `width:100%` filling remaining height, no border.

### `app/page.js` (modify)

- Import `SupportLink`; render it as the **last** child of `.topbar-right`, immediately after the "Built with ❤️ By Trickster" anchor (currently ends near line 232), passing `pulseKey`.
- Add a `resultPulse` counter state, incremented exactly where a query run completes **successfully with results** (the success path of `run()`); pass it as `pulseKey`. Error paths never increment it.

### `app/library/page.js` (modify)

- Import `SupportLink`; render it as the **last** child of `.topbar-right`, after the "← Console" link, with no `pulseKey` (no query execution on this page). (Server component importing a client component — standard client island.)

## Data flow

Successful `run()` on the console → `resultPulse` increments → SupportLink pulses the heart (subject to 30s cooldown). Pill click → local `open` state → modal mounts, iframe loads BMC's widget page → donor completes payment inside BMC's embedded app. No SuiteSense API involvement, no script injection.

## Error handling

- **BMC later blocks framing** (accepted risk; this endpoint is what their own widget script embeds, so it is as stable as the widget itself): the iframe would render blank — the always-visible "Open in new tab ↗" link in the modal header is the escape hatch, and swapping the modal back to a plain link is a one-file change.
- Modal close paths: ✕ button, backdrop click, Escape key.
- Pulse never fires on failed runs, and reduced-motion users never see it.

## Testing / verification

- `npm run check` still passes (unaffected, cheap to run).
- `npm run build` passes.
- Manual: on `/` — pill renders after the byline; running a query that returns rows pulses the heart twice then stops; a second immediate run does not re-pulse (cooldown); a failing query never pulses; clicking the pill opens the modal with pitch text and BMC's payment UI visible; ✕ / backdrop / Escape all close it; "Open in new tab ↗" reaches the profile page. On `/library` — pill renders after "← Console", modal works, no pulsing. Both usable at ~375px width.

## Rollout

Branch `feat/support-link` → PR → merge to `main` → `vercel deploy --prod --yes`. No environment variables, no migrations.
