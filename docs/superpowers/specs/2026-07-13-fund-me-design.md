# Support SuiteSense Funding Link — Design

**Date:** 2026-07-13
**Status:** Approved in session (owner picked wording, placement, and in-page donation flow; URLs verified)

## Goal

Let visitors fund SuiteSense's LLM costs (a stronger model) **without leaving the site**. No payment processing code enters the app — the payment flow is Buy Me a Coffee's own embeddable widget page, shown in an in-page panel.

## Decision record

- **Platform: Buy Me a Coffee** — profile `https://buymeacoffee.com/tricksterbivek` (created by the owner; verified HTTP 200 on 2026-07-13). Chosen because donors arrive mostly from LinkedIn — NetSuite consultants and finance people who may not have GitHub accounts. Buy Me a Coffee accepts any card/PayPal with no donor account. GitHub Sponsors (0% fee) can be added later; both URLs live in one component, so a swap is a one-file change.
- **In-page donation via the widget page, not the widget script.** BMC's floating-widget script is just a wrapper that iframes `https://buymeacoffee.com/widget/page/tricksterbivek`. Verified 2026-07-13: that URL returns 200 with **no** `X-Frame-Options` / `frame-ancestors` (deliberately embeddable — the main profile page blocks framing with `SAMEORIGIN`), and its body is BMC's payment app. Embedding it in our own panel gives the in-page flow with zero third-party scripts, no floating button, and our own trigger.
- **UI: compact topbar pill, wording "❤️ Support SuiteSense"** — the owner liked the "Support SuiteSense" wording from the support-card option but wants it as an icon + label in the topbar, placed right after the "Built with ❤️ By Trickster" byline. Clicking it opens the in-page panel.
- **Nothing loads from BMC until the pill is clicked** — the iframe mounts only when the panel opens. Consistent with the site's privacy posture ("queries never leave your browser").
- **Explicitly excluded (YAGNI):** BMC's floating-widget script, landing-page support card, hero subline, click analytics, automated tests for the panel.

## Components

### `app/components/SupportLink.js` (new, `'use client'`)

- The single home of both URLs:
  ```js
  const FUND_URL = 'https://buymeacoffee.com/tricksterbivek';          // profile (new-tab fallback)
  const WIDGET_URL = 'https://buymeacoffee.com/widget/page/tricksterbivek'; // embeddable payment page
  ```
- Default export renders the pill trigger and, when open, the panel:
  - Trigger: `<button className="support-pill" title="Fund a better AI model for SuiteSense">❤️ Support SuiteSense</button>` toggling `useState` open.
  - Panel (only rendered while open): a fixed overlay — backdrop (click closes) plus a slide-over card containing:
    - a small header: "Support SuiteSense", an "Open in new tab ↗" link to `FUND_URL` (`target="_blank" rel="noreferrer"`), and a ✕ close button;
    - `<iframe src={WIDGET_URL} title="Support SuiteSense on Buy Me a Coffee" />` filling the rest of the card.
  - Escape key closes the panel (keydown listener active only while open).
- No other state, no props, no dependencies. Used as a client island by both pages.

### `app/globals.css` (modify)

- `.support-pill`: compact rounded pill using the existing accent design tokens — thin accent border, subtle background tint, gentle hover brighten, same font size as `.byline`; button reset (no default browser button chrome). Compact enough that topbar wrapping at ~375px is unchanged.
- `.support-overlay` / `.support-panel` / `.support-panel-head`: fixed full-viewport dimmed backdrop; right-side slide-over card (~380px wide, full height) on desktop, effectively full-screen on small viewports; header row with the fallback link and close button; iframe at `width:100%` filling remaining height, no border.

### `app/page.js` (modify)

- Import `SupportLink`; render it as the **last** child of `.topbar-right`, immediately after the "Built with ❤️ By Trickster" anchor (currently ends near line 232).

### `app/library/page.js` (modify)

- Import `SupportLink`; render it as the **last** child of `.topbar-right`, after the "← Console" link, so both pages carry the pill consistently. (Server component importing a client component — standard client island.)

## Data flow

Pill click → local `open` state → iframe mounts pointing at BMC's widget page → donor completes payment inside BMC's embedded app. Nothing else. No SuiteSense API involvement, no script injection.

## Error handling

- **BMC later blocks framing** (accepted risk; this endpoint is what their own widget script embeds, so it is as stable as the widget itself): the iframe would render blank — the always-visible "Open in new tab ↗" link in the panel header is the escape hatch, and swapping the pill back to a plain link is a one-file change.
- Panel close paths: ✕ button, backdrop click, Escape key.

## Testing / verification

- `npm run check` still passes (unaffected, cheap to run).
- `npm run build` passes.
- Manual: on `/` and `/library` — pill renders after the existing topbar links; clicking opens the panel with BMC's payment UI visible; ✕ / backdrop / Escape all close it; "Open in new tab ↗" reaches the profile page; topbar and panel usable at ~375px width.

## Rollout

Branch `feat/support-link` → PR → merge to `main` → `vercel deploy --prod --yes`. No environment variables, no migrations.
