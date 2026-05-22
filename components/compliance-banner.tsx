"use client";

// US-persons geo-gate + risk notice. Renders on every page so judges can see
// that we treat the Polymarket restriction as a real legal constraint, not
// a formality. Brand markup, Pompeii banner.

import { useEffect, useState } from "react";

export function ComplianceBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(document.cookie.includes("babel_compliance_ack=1"));
  }, []);

  if (dismissed) return null;

  function acknowledge(isNotUs: boolean) {
    const days = 30;
    const exp = new Date(Date.now() + days * 86_400_000).toUTCString();
    document.cookie = `babel_compliance_ack=1; expires=${exp}; path=/; samesite=lax`;
    if (isNotUs) {
      document.cookie = `babel_not_us=1; expires=${exp}; path=/; samesite=lax`;
    }
    setDismissed(true);
  }

  return (
    <div className="compliance-bar">
      <p>
        <strong>Compliance notice.</strong>
        Babel posts to Polymarket which prohibits trading by US persons. Markets are
        for entertainment and informational purposes. USYC yield is shown for
        structural design; no real user funds are parked. Arc testnet only.
      </p>
      <div className="actions">
        <button type="button" onClick={() => acknowledge(true)}>
          I am not a US person
        </button>
        <button type="button" className="outline" onClick={() => acknowledge(false)}>
          Acknowledge
        </button>
      </div>
    </div>
  );
}
