"use client";

// USYC float tile, testnet stub only. Calls /api/usyc/subscribe which writes a
// usyc_events row and returns the running float; no real Teller is touched.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
        setError(json.error || `USYC ${action} failed`);
      } else {
        setFloatState(json.float as FloatState);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "USYC call failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold">${floatState.netFloatUsdc.toFixed(4)}</div>
        <Badge variant="outline">4.8% APY</Badge>
        <Badge variant="warning">testnet stub</Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        {floatState.totalUsycHeld.toFixed(4)} USYC at $1.0020 / share
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-24 rounded border bg-background px-2 py-1 text-sm font-mono"
        />
        <Button size="sm" onClick={() => act("subscribe")} disabled={busy !== null}>
          {busy === "subscribe" ? "Subscribing..." : "Subscribe"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => act("redeem")}
          disabled={busy !== null || floatState.totalUsycHeld <= 0}
        >
          {busy === "redeem" ? "Redeeming..." : "Redeem"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        USYC is non-US-only and KYC-allowlisted. Babel demonstrates the integration
        on testnet only; no real funds are parked.
      </p>
    </div>
  );
}
