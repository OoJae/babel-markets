"use client";

// Babel Markets hero paste box.
// Streams agent steps live via Server-Sent Events. Each step lands as it completes
// with its USDC cost so the demo video can show sub-cent (or sub-dime) per-question
// economics in real time.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export interface PasteSample {
  label: string;
  text: string;
}

interface StepEvent {
  step: string;
  output: any;
  latencyMs: number;
  costUsdc: number;
  cachedInputTokens?: number;
  tokensIn?: number;
  tokensOut?: number;
  nanopayment?: {
    paid: boolean;
    amountUsdc: string;
    network?: string;
    txHash?: string | null;
    note?: string;
  };
}

interface DoneEvent {
  question: {
    question: string;
    resolution_rule: string;
    resolution_source: string;
    expiry: string;
    category: string;
    currency: string;
    suggested_probability: number;
    source_lang: string;
    reject: boolean;
    reject_reason?: string;
  };
  quality: {
    resolvability: number;
    source_quality: number;
    timeliness: number;
    faithfulness: number;
    translation_fidelity: number;
  };
  qualityAverage: number;
  shouldPost: boolean;
  rationale: string;
  questionId?: string | null;
  matchedMarket?: {
    id: string;
    conditionId: string;
    question: string;
    url: string;
  } | null;
  matchedSimilarity?: number | null;
  totalCostUsdc: number;
  totalLatencyMs: number;
}

const DEFAULT_SAMPLES: PasteSample[] = [
  {
    label: "Yoruba",
    text: `Ijoba apapo ti Naijiria so wipe oun yoo gbero lori ipinnu lati yo idiyele owo epo petirolu sile ki o to di ojo kerinla osu Keje 2026. Aare Bola Tinubu so fun awon onise iroyin ni ile Aso Rock pe ipinnu yi yoo da lori bi inawo ijoba se ri.`,
  },
  {
    label: "French",
    text: `Paris a confirmé officiellement sa candidature pour accueillir les finales des championnats du monde d'athlétisme en 2027. Le maire Anne Hidalgo a déclaré mercredi que la décision finale du Comité international d'athlétisme sera annoncée le 12 mars 2026.`,
  },
  {
    label: "Mandarin",
    text: `中国国务院总理李强本周宣布,政府计划在2026年第三季度之前推出新的人民币数字货币跨境支付试点项目,初期将覆盖上海、深圳和香港。央行表示,试点的成功标准将在2026年6月30日前公布。`,
  },
];

const STEP_LABEL: Record<string, string> = {
  detect: "1. Detect language",
  translate: "2. Translate to English",
  assess: "3. Assess tradability",
  synthesize: "4. Synthesize question",
  "synthesize:revise": "4b. Revise question",
  critique: "5. Self-critique",
  "critique:revise": "5b. Re-critique",
  map_to_market: "8. Map to Polymarket",
  dedup: "6. Check duplicates",
  decide: "7. Post or hold",
};

interface PasteBoxProps {
  initialText?: string;
  samples?: PasteSample[];
}

export function PasteBox({
  initialText = "",
  samples = DEFAULT_SAMPLES,
}: PasteBoxProps = {}) {
  const [text, setText] = useState(initialText);
  const [streaming, setStreaming] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [done, setDone] = useState<DoneEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function reset() {
    setSteps([]);
    setDone(null);
    setError(null);
  }

  async function submit() {
    if (!text.trim()) return;
    reset();
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceText: text }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        // Read the server's error reason instead of swallowing it.
        let serverReason = "";
        try {
          const data = (await res.clone().json()) as { error?: string };
          if (data?.error) serverReason = data.error;
        } catch {
          try {
            serverReason = (await res.text()).slice(0, 400);
          } catch {
            // Ignore.
          }
        }
        throw new Error(
          serverReason
            ? `Error ${res.status}: ${serverReason}`
            : `Stream failed (${res.status})`,
        );
      }
      if (!res.body) {
        throw new Error("Stream had no body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done: closed } = await reader.read();
        if (closed) break;
        buffer += decoder.decode(value, { stream: true });

        let nl;
        while ((nl = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 2);
          const lines = chunk.split("\n");
          let eventName = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
          }
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine);
          if (eventName === "step") {
            setSteps((prev) => [...prev, payload as StepEvent]);
          } else if (eventName === "done") {
            const d = payload as DoneEvent;
            setDone(d);
            if (d.question?.reject) {
              toast.warning("Question held back: not tradable.");
            } else if (d.shouldPost) {
              toast.success(
                `Synthesized: ${d.question.question.slice(0, 60)}`,
                {
                  description: d.matchedMarket
                    ? "Matched a live Polymarket market."
                    : "Saved as draft.",
                },
              );
            } else {
              toast("Synthesized, holding for review.");
            }
          } else if (eventName === "error") {
            setError(payload.error ?? "Pipeline failed");
            toast.error(payload.error ?? "Pipeline failed");
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Stream error");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  const totalCost = steps.reduce((s, e) => s + (e.costUsdc ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">
            Paste a non-English news article
          </CardTitle>
          <p className="text-muted-foreground">
            Translate, judge tradability, synthesize a binary YES/NO question,
            self-critique, dedup, and decide whether to post. Live, one step at a
            time.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste an article in Yoruba, Swahili, Spanish, Arabic, French, Portuguese, Mandarin..."
            className="min-h-[180px]"
            disabled={streaming}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={streaming || !text.trim()}>
              {streaming ? "Streaming..." : "Synthesize question"}
            </Button>
            {samples.map((s) => (
              <Button
                key={s.label}
                variant="outline"
                onClick={() => setText(s.text)}
                disabled={streaming}
              >
                Try {s.label}
              </Button>
            ))}
            {streaming && (
              <Button variant="ghost" onClick={cancel}>
                Cancel
              </Button>
            )}
            {(steps.length > 0 || done) && !streaming && (
              <Button variant="ghost" onClick={reset}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!streaming && steps.length === 0 && !done && !error && text.trim().length === 0 && (
        <p className="text-xs text-muted-foreground">
          Steps appear here as the agent runs. Each one ships with a USDC cost
          and a Gateway Nanopayment receipt.
        </p>
      )}

      {(steps.length > 0 || done) && (
        <div className="space-y-3">
          {steps.map((s, i) => (
            <Card key={`${s.step}-${i}`} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base font-mono">
                    {STEP_LABEL[s.step] ?? s.step}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{s.latencyMs}ms</Badge>
                    <Badge variant="outline">${s.costUsdc.toFixed(6)}</Badge>
                    {(s.cachedInputTokens ?? 0) > 0 && (
                      <Badge variant="success">
                        cached {s.cachedInputTokens}
                      </Badge>
                    )}
                    {typeof s.tokensIn === "number" && (
                      <Badge variant="outline">
                        {s.tokensIn} in / {s.tokensOut} out
                      </Badge>
                    )}
                    {s.nanopayment?.paid && (
                      <Badge
                        variant="success"
                        title={
                          s.nanopayment.txHash
                            ? `Settlement tx: ${s.nanopayment.txHash}`
                            : "Signed Nanopayment, batched for settlement"
                        }
                      >
                        ${Number(s.nanopayment.amountUsdc).toFixed(6)} via Gateway
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(s.output, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}

          <Card className="border-l-4 border-l-muted">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm text-muted-foreground">
              <span>Steps complete: {steps.length}</span>
              <span>
                Model: ${totalCost.toFixed(6)} · Nanopayments: $
                {steps
                  .reduce(
                    (acc, s) =>
                      acc +
                      (s.nanopayment?.paid
                        ? Number(s.nanopayment.amountUsdc)
                        : 0),
                    0,
                  )
                  .toFixed(6)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {done && done.question && !done.question.reject && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-xl">Final question</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant={done.shouldPost ? "success" : "warning"}>
                  {done.shouldPost ? "post" : "hold"}
                </Badge>
                <Badge variant="outline">
                  quality {done.qualityAverage.toFixed(2)}
                </Badge>
                <Badge variant="outline">{done.question.currency}</Badge>
                <Badge variant="outline">{done.question.source_lang}</Badge>
                <Badge variant="outline">
                  total ${done.totalCostUsdc.toFixed(6)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-medium">{done.question.question}</p>
            <div className="text-sm">
              <span className="font-semibold">Resolution rule: </span>
              {done.question.resolution_rule}
            </div>
            <div className="text-sm">
              <span className="font-semibold">Source: </span>
              <a
                className="underline"
                href={done.question.resolution_source}
                target="_blank"
                rel="noreferrer"
              >
                {done.question.resolution_source}
              </a>
            </div>
            <div className="text-sm text-muted-foreground">
              Expires {new Date(done.question.expiry).toLocaleDateString()},{" "}
              category {done.question.category}, initial prior{" "}
              {(done.question.suggested_probability * 100).toFixed(0)}%
            </div>
            <p className="text-sm italic text-muted-foreground">
              {done.rationale}
            </p>
            {done.matchedMarket && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <p className="font-semibold">
                  Matched live Polymarket market
                  {typeof done.matchedSimilarity === "number" && (
                    <span className="ml-2 font-normal text-green-700">
                      ({(done.matchedSimilarity * 100).toFixed(0)}% similarity)
                    </span>
                  )}
                </p>
                <p className="mt-1">{done.matchedMarket.question}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <a
                    className="underline"
                    href={done.matchedMarket.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Trade on Polymarket
                  </a>
                  {done.questionId && (
                    <a className="underline" href={`/market/${done.questionId}`}>
                      Open market view + provenance
                    </a>
                  )}
                </div>
              </div>
            )}
            {!done.matchedMarket && done.questionId && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                No live Polymarket market matched yet. Question saved as draft at{" "}
                <a className="underline" href={`/market/${done.questionId}`}>
                  /market/{done.questionId.slice(0, 8)}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {done && done.question?.reject && (
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-6 text-sm">
            <p className="font-semibold">Held back: not tradable.</p>
            <p className="text-muted-foreground">
              {done.question.reject_reason ?? done.rationale}
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
