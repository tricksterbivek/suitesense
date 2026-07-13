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
  const pulseTimer = useRef(null);

  // Timer lives in a ref: cooldown-rejected pulseKey increments must not
  // clear a pending reset (keyed cleanup would strand pulsing=true).
  useEffect(() => {
    if (!pulseKey) return; // mount / pages that never pulse
    const now = Date.now();
    if (now - lastPulse.current < PULSE_COOLDOWN_MS) return;
    lastPulse.current = now;
    setPulsing(true);
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulsing(false), PULSE_DURATION_MS);
  }, [pulseKey]);

  useEffect(() => () => clearTimeout(pulseTimer.current), []);

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
            {/* Deliberately un-sandboxed: any sandbox loose enough for BMC's
                payment flows (3DS popups, wallets) adds nothing, and stricter
                silently breaks them. allow="payment" enables wallet buttons. */}
            <iframe src={WIDGET_URL} title="Support SuiteSense on Buy Me a Coffee" allow="payment" />
          </div>
        </div>
      )}
    </>
  );
}
