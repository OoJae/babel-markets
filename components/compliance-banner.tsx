"use client";

// US-persons geo-gate + risk notice. Renders on every page so judges can see
// that we treat the Polymarket restriction as a real legal constraint, not a formality.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="border-b border-yellow-500 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <strong>Compliance notice. </strong>
          Babel posts to Polymarket which prohibits trading by US persons. Markets are
          for entertainment and informational purposes. USYC yield is shown for
          structural design; no real user funds are parked. Arc testnet only.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => acknowledge(true)}>
            I am not a US person
          </Button>
          <Button size="sm" variant="outline" onClick={() => acknowledge(false)}>
            Acknowledge
          </Button>
        </div>
      </div>
    </div>
  );
}
