"use client";

// USYC float tile. Calls /api/usyc/subscribe which branches between Circle's
// sandbox REST API (when USYC_API_KEY is set on the server) and the local
// deterministic stub. The NEXT_PUBLIC_USYC_LIVE flag mirrors the server-side
// USYC_API_KEY so the badge can flip without a code change once Circle
// delivers the hackathon sandbox key.

import { useState } from "react";
import { toast } from "sonner";

const USYC_LIVE = process.env.NEXT_PUBLIC_USYC_LIVE === "1";

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
        const tag = USYC_LIVE ? "(sandbox live)" : "(sandbox pending)";
        toast.success(
          action === "subscribe"
            ? `Subscribed $${amount} into USYC ${tag}`
            : `Redeemed $${amount} from USYC ${tag}`,
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
        {USYC_LIVE ? (
          <span
            className="pill"
            style={{
              background: "#2f6f3c",
              color: "var(--parchment)",
              borderColor: "#2f6f3c",
            }}
            title="Subscribe + redeem call Circle's USYC sandbox API."
          >
            sandbox live
          </span>
        ) : (
          <a
            href="https://forms.gle/usyc-stablefx-hackathon-access"
            target="_blank"
            rel="noreferrer"
            className="pill warn"
            style={{ textDecoration: "none" }}
            title="Subscribe + redeem use a deterministic stub until Circle issues the hackathon sandbox key."
          >
            sandbox pending
          </a>
        )}
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
