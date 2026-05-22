"use client";

// USYC float tile, testnet stub only. Calls /api/usyc/subscribe which writes a
// usyc_events row and returns the running float; no real Teller is touched.
// Brand markup; the API call shape is unchanged from Phase 5/6.

import { useState } from "react";
import { toast } from "sonner";

interface FloatState {
  totalUsdcSubscribed: number;
  totalUsycHeld: number;
  netFloatUsdc: number;
}

export function UsycPanel({ initial }: { initial: FloatState }) {
  const [floatState, setFloatState] = useState<FloatState>(initial);
  const [busy, setBusy] = useState<null | "subscribe" | "redeem">(null);
  const [amount, setAmount] = useState("10");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "subscribe" | "redeem") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/usyc/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsdc: amount, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const msg = json.error || `USYC ${action} failed`;
        setError(msg);
        toast.error(msg);
      } else {
        setFloatState(json.float as FloatState);
        toast.success(
          action === "subscribe"
            ? `Subscribed $${amount} into USYC (testnet stub)`
            : `Redeemed $${amount} from USYC (testnet stub)`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "USYC call failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="usyc-card">
      <div className="row">
        <span className="amt">${floatState.netFloatUsdc.toFixed(4)}</span>
        <span className="pill">4.8% APY</span>
        <span className="pill warn">testnet stub</span>
      </div>
      <div className="meta">
        {floatState.totalUsycHeld.toFixed(4)} USYC at $1.0020 / share
      </div>
      <div className="controls">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="brand-input"
          style={{ width: 80 }}
        />
        <button
          type="button"
          className="brand-pill"
          onClick={() => act("subscribe")}
          disabled={busy !== null}
        >
          {busy === "subscribe" ? "Subscribing..." : "Subscribe"}
        </button>
        {floatState.totalUsycHeld > 0 && (
          <button
            type="button"
            className="brand-pill outline"
            onClick={() => act("redeem")}
            disabled={busy !== null}
          >
            {busy === "redeem" ? "Redeeming..." : "Redeem"}
          </button>
        )}
      </div>
      {error && (
        <p
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 11,
            color: "var(--pompeii)",
            marginTop: 6,
          }}
        >
          {error}
        </p>
      )}
      <p className="compliance">
        USYC is non-US-only and KYC-allowlisted. Babel demonstrates the integration
        on testnet only; no real funds are parked.
      </p>
    </div>
  );
}
