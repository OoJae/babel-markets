"use client";

// Creator dashboard "Sweep fees to Arc" panel. Calls /api/escrow/sweep and
// renders each CCTP v2 step as it arrives. In mock mode (BABEL_CCTP_ENABLED=0)
// the route returns fake tx hashes so the UI flow demos cleanly without
// burning testnet USDC.
//
// Brand markup, no shadcn primitives. The streaming SSE logic is unchanged
// from Phase 6; only the JSX moved into .dash / .sweep-event / .brand-pill
// selectors defined in app/brand.css.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const MIN_SWEEP_USDC = 0.1;

interface SweepEvent {
  stage: "burn-pending" | "burn-confirmed" | "attestation-fetched" | "mint-confirmed";
  burnTxHash?: string;
  mintTxHash?: string;
  attestationStatus?: string;
  note?: string;
}

interface CreditState {
  status: "pending" | "confirmed" | "skipped";
  txHash?: string;
  reason?: string;
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
  creditTxHash: string | null;
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

const STAGE_NOTE: Record<SweepEvent["stage"], string> = {
  "burn-pending": "depositForBurn on TokenMessengerV2",
  "burn-confirmed": "Polygon Amoy block included",
  "attestation-fetched": "Iris v2 signed the message",
  "mint-confirmed": "receiveMessage on MessageTransmitterV2",
};

export function SweepPanel({ accrued }: { accrued: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [amount, setAmount] = useState("0.1");
  // The init event from /api/escrow/sweep is still received; we just don't
  // need to surface it in the UI now that the "demo mode" chip is gone.
  const [events, setEvents] = useState<SweepEvent[]>([]);
  const [credit, setCredit] = useState<CreditState | null>(null);
  const [done, setDone] = useState<DoneEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startSweep() {
    setRunning(true);
    setEvents([]);
    setCredit(null);
    setDone(null);
    setError(null);
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
          if (evType === "init") {
            // sweepId / mock flag arrive here but we no longer render either.
          } else if (evType === "progress") setEvents((p) => [...p, payload as SweepEvent]);
          else if (evType === "credit-pending") {
            setCredit({ status: "pending" });
          } else if (evType === "credit-confirmed") {
            const p = payload as { creditTxHash: string; amountUsdc: string };
            setCredit({ status: "confirmed", txHash: p.creditTxHash });
          } else if (evType === "credit-skipped") {
            const p = payload as { reason: string };
            setCredit({ status: "skipped", reason: p.reason });
          } else if (evType === "done") {
            const d = payload as DoneEvent;
            setDone(d);
            if (d.result) {
              toast.success(
                `Swept ${d.result.amountUsdc} USDC to Arc${d.mock ? " (mock)" : ""}`,
                d.mock
                  ? undefined
                  : {
                      description: d.result.mintTxHash.slice(0, 18) + "...",
                      action: {
                        label: "ArcScan",
                        onClick: () =>
                          window.open(
                            `https://testnet.arcscan.app/tx/${d.result!.mintTxHash}`,
                            "_blank",
                          ),
                      },
                    },
              );
            }
            // Re-fetch the dashboard server component so the on-chain accrued
            // balance + Claim button pick up the new credit.
            if (d.creditTxHash) router.refresh();
          } else if (evType === "error") {
            const msg = (payload as { error: string }).error;
            setError(msg);
            toast.error(msg);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sweep failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div>
        <div className="dash-stat">${accrued.toFixed(4)}</div>
        <div className="dash-stat-sub">Accrued USDC ready to sweep</div>
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}
      >
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={running}
          className="brand-input"
        />
        <button
          type="button"
          className="brand-pill"
          onClick={startSweep}
          disabled={running || Number(amount) < MIN_SWEEP_USDC}
          title={
            Number(amount) < MIN_SWEEP_USDC
              ? `CCTP v2 minimum sweep is ${MIN_SWEEP_USDC} USDC`
              : undefined
          }
        >
          {running ? "Sweeping..." : "Sweep to Arc"} <span>→</span>
        </button>
      </div>
      {!running && Number(amount) < MIN_SWEEP_USDC && (
        <p
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.55,
            marginTop: 8,
          }}
        >
          CCTP v2 minimum sweep is {MIN_SWEEP_USDC} USDC.
        </p>
      )}
      {error && (
        <p
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 12,
            color: "var(--pompeii)",
            marginTop: 10,
          }}
        >
          {error}
        </p>
      )}

      {(events.length > 0 || done) && (
        <ol className="sweep-events">
          {events.map((ev, idx) => (
            <li key={`${ev.stage}-${idx}`} className="sweep-event">
              <span className="n">0{idx + 1}</span>
              <span className="lbl">
                <b>{STAGE_LABEL[ev.stage]}</b>
                <span>{STAGE_NOTE[ev.stage]}</span>
              </span>
              <span>
                {ev.burnTxHash && ev.stage === "burn-confirmed" && (
                  <a
                    className="lnk"
                    href={polygonscan(ev.burnTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ev.burnTxHash.slice(0, 10)}...
                  </a>
                )}
                {ev.mintTxHash && ev.stage === "mint-confirmed" && (
                  <a
                    className="lnk"
                    href={arcscan(ev.mintTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ev.mintTxHash.slice(0, 10)}...
                  </a>
                )}
                {ev.attestationStatus && ev.stage === "attestation-fetched" && (
                  <span className="brand-chip dark">{ev.attestationStatus}</span>
                )}
              </span>
            </li>
          ))}
          {credit && credit.status !== "skipped" && (
            <li className="sweep-event">
              <span className="n">0{events.length + 1}</span>
              <span className="lbl">
                <b>Credited to your balance</b>
                <span>creditFees on AttributionEscrow (80% creator, 20% platform)</span>
              </span>
              <span>
                {credit.status === "pending" && (
                  <span className="brand-chip dark">pending</span>
                )}
                {credit.status === "confirmed" && credit.txHash && (
                  <a
                    className="lnk"
                    href={arcscan(credit.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {credit.txHash.slice(0, 10)}...
                  </a>
                )}
              </span>
            </li>
          )}
        </ol>
      )}
      {credit?.status === "skipped" && credit.reason && (
        <p
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.55,
            marginTop: 10,
          }}
        >
          Credit skipped: {credit.reason}
        </p>
      )}
      {done?.result && (
        <p
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.55,
            marginTop: 12,
          }}
        >
          Swept {done.result.amountUsdc} USDC{done.mock ? " (mock)" : ""}.
        </p>
      )}
    </div>
  );
}
