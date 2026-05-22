"use client";

// Creator dashboard "Sweep fees to Arc" panel. Calls /api/escrow/sweep and
// renders each CCTP v2 step as it arrives. In mock mode (BABEL_CCTP_ENABLED=0)
// the route returns fake tx hashes so the UI flow demos cleanly without
// burning testnet USDC.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SweepEvent {
  stage: "burn-pending" | "burn-confirmed" | "attestation-fetched" | "mint-confirmed";
  burnTxHash?: string;
  mintTxHash?: string;
  attestationStatus?: string;
  note?: string;
}

interface InitEvent {
  sweepId: string;
  mock: boolean;
  amountUsdc: string;
}

interface DoneEvent {
  sweepId: string;
  mock: boolean;
  result: {
    burnTxHash: string;
    mintTxHash: string;
    attestationStatus: string;
    amountUsdc: string;
  } | null;
}

function polygonscan(hash: string): string {
  return `https://amoy.polygonscan.com/tx/${hash}`;
}

function arcscan(hash: string): string {
  return `https://testnet.arcscan.app/tx/${hash}`;
}

const STAGE_LABEL: Record<SweepEvent["stage"], string> = {
  "burn-pending": "Burning USDC on Polygon Amoy",
  "burn-confirmed": "Burn confirmed",
  "attestation-fetched": "Iris attestation received",
  "mint-confirmed": "Minted on Arc testnet",
};

export function SweepPanel({ accrued }: { accrued: number }) {
  const [running, setRunning] = useState(false);
  const [amount, setAmount] = useState("0.1");
  const [init, setInit] = useState<InitEvent | null>(null);
  const [events, setEvents] = useState<SweepEvent[]>([]);
  const [done, setDone] = useState<DoneEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startSweep() {
    setRunning(true);
    setEvents([]);
    setDone(null);
    setError(null);
    setInit(null);
    try {
      const res = await fetch("/api/escrow/sweep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsdc: amount }),
      });
      if (!res.ok || !res.body) {
        const body = await res.text();
        setError(`Sweep failed (${res.status}): ${body.slice(0, 200)}`);
        setRunning(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done: rdone } = await reader.read();
        if (rdone) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const evMatch = block.match(/^event: (.+)$/m);
          const dataMatch = block.match(/^data: (.+)$/m);
          if (!evMatch || !dataMatch) continue;
          const evType = evMatch[1];
          const payload = JSON.parse(dataMatch[1]);
          if (evType === "init") setInit(payload as InitEvent);
          else if (evType === "progress") setEvents((p) => [...p, payload as SweepEvent]);
          else if (evType === "done") setDone(payload as DoneEvent);
          else if (evType === "error") setError((payload as { error: string }).error);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sweep failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-3xl font-bold">${accrued.toFixed(4)}</div>
          <div className="text-xs text-muted-foreground">Accrued USDC ready to sweep</div>
        </div>
        {init?.mock || (!init && !running) ? (
          <Badge variant="outline">demo mode</Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={running}
          className="w-28 rounded border bg-background px-2 py-1 text-sm font-mono"
        />
        <Button onClick={startSweep} disabled={running} size="sm">
          {running ? "Sweeping..." : "Sweep to Arc"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {(events.length > 0 || done) && (
        <ol className="space-y-1 text-sm">
          {events.map((ev, idx) => (
            <li key={`${ev.stage}-${idx}`} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{idx + 1}</span>
              <span>{STAGE_LABEL[ev.stage]}</span>
              {ev.burnTxHash && ev.stage === "burn-confirmed" && (
                <a
                  className="text-xs underline"
                  href={polygonscan(ev.burnTxHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {ev.burnTxHash.slice(0, 10)}...
                </a>
              )}
              {ev.mintTxHash && ev.stage === "mint-confirmed" && (
                <a
                  className="text-xs underline"
                  href={arcscan(ev.mintTxHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {ev.mintTxHash.slice(0, 10)}...
                </a>
              )}
              {ev.attestationStatus && ev.stage === "attestation-fetched" && (
                <Badge variant="outline">{ev.attestationStatus}</Badge>
              )}
              {ev.note && (
                <span className="text-xs text-muted-foreground">{ev.note}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {done?.result && (
        <p className="text-xs text-muted-foreground">
          Swept {done.result.amountUsdc} USDC{done.mock ? " (mock)" : ""}.
        </p>
      )}
    </div>
  );
}
