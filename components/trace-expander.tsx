"use client";

// Fetches the IPFS-pinned reasoning trace on demand and renders the 8 agent
// steps inline. Kept collapsed by default so the market view loads fast.

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Reasoning trace pinned at{" "}
          <a
            className="font-mono underline"
            href={ipfsGatewayUrl(cid)}
            target="_blank"
            rel="noreferrer"
          >
            {cid.slice(0, 14)}...
          </a>
        </p>
        <Button variant="outline" size="sm" onClick={toggle}>
          {open ? "Hide" : "Show"} trace
        </Button>
      </div>

      {open && (
        <div className="space-y-2">
          {loading && (
            <p className="text-sm text-muted-foreground">Fetching from IPFS...</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {trace?.steps?.map((step, idx) => (
            <details
              key={`${step.step ?? idx}-${idx}`}
              className="rounded border bg-muted/30 px-3 py-2"
            >
              <summary className="cursor-pointer text-xs font-mono">
                {idx + 1}. {step.step ?? "step"}
                {typeof step.latencyMs === "number" && (
                  <span className="ml-2 text-muted-foreground">
                    {step.latencyMs}ms
                  </span>
                )}
                {typeof step.costUsdc === "number" && (
                  <span className="ml-2 text-muted-foreground">
                    ${step.costUsdc.toFixed(6)}
                  </span>
                )}
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs">
                {JSON.stringify(step.output ?? null, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
