"use client";

// Fetches the IPFS-pinned reasoning trace on demand and renders the 8 agent
// steps inline. Kept collapsed by default so the market view loads fast.

import { useState } from "react";

interface Props {
  cid: string;
}

function ipfsGatewayUrl(cid: string): string {
  return `https://gateway.irys.xyz/${cid}`;
}

interface StepTrace {
  step?: string;
  output?: unknown;
  latencyMs?: number;
  costUsdc?: number;
}

interface TracePayload {
  babel_version?: string;
  steps?: StepTrace[];
  question?: unknown;
  quality?: unknown;
  rationale?: string;
  matched_market?: unknown;
  generated_at?: string;
}

export function TraceExpander({ cid }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trace, setTrace] = useState<TracePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (trace || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ipfsGatewayUrl(cid));
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
      const data = (await res.json()) as TracePayload;
      setTrace(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch trace");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="market-provenance">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <p className="cid">
          Reasoning trace pinned at{" "}
          <a href={ipfsGatewayUrl(cid)} target="_blank" rel="noreferrer">
            {cid.slice(0, 14)}...
          </a>
        </p>
        <button type="button" className="brand-pill outline" onClick={toggle}>
          {open ? "Hide" : "Show"} trace
        </button>
      </div>

      {open && (
        <>
          {loading && (
            <p
              style={{
                fontFamily: "var(--f-mono)",
                fontSize: 12,
                opacity: 0.7,
                marginTop: 12,
              }}
            >
              Fetching from IPFS...
            </p>
          )}
          {error && (
            <p
              style={{
                fontFamily: "var(--f-mono)",
                fontSize: 12,
                color: "var(--pompeii)",
                marginTop: 12,
              }}
            >
              {error}
            </p>
          )}
          {trace?.steps?.map((step, idx) => (
            <details key={`${step.step ?? idx}-${idx}`}>
              <summary>
                {idx + 1}. {step.step ?? "step"}
                {typeof step.latencyMs === "number" && (
                  <span style={{ marginLeft: 8, opacity: 0.6 }}>
                    {step.latencyMs}ms
                  </span>
                )}
                {typeof step.costUsdc === "number" && (
                  <span style={{ marginLeft: 8, opacity: 0.6 }}>
                    ${step.costUsdc.toFixed(6)}
                  </span>
                )}
              </summary>
              <pre>{JSON.stringify(step.output ?? null, null, 2)}</pre>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
