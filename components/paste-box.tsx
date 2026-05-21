"use client";

// Babel Markets hero paste box.
// Streams agent steps live via Server-Sent Events. Each step lands as it completes
// with its USDC cost so the demo video can show sub-cent (or sub-dime) per-question
// economics in real time.

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface StepEvent {
  step: string;
  output: any;
  latencyMs: number;
  costUsdc: number;
  cachedInputTokens?: number;
  tokensIn?: number;
  tokensOut?: number;
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
  totalCostUsdc: number;
  totalLatencyMs: number;
}

const SAMPLE_TEXT = `Ijoba apapo ti Naijiria so wipe oun yoo gbero lori ipinnu lati yo idiyele owo epo petirolu sile ki o to di ojo kerinla osu Keje 2026. Aare Bola Tinubu so fun awon onise iroyin ni ile Aso Rock pe ipinnu yi yoo da lori bi inawo ijoba se ri.`;

const STEP_LABEL: Record<string, string> = {
  detect: "1. Detect language",
  translate: "2. Translate to English",
  assess: "3. Assess tradability",
  synthesize: "4. Synthesize question",
  "synthesize:revise": "4b. Revise question",
  critique: "5. Self-critique",
  "critique:revise": "5b. Re-critique",
  dedup: "6. Check duplicates",
  decide: "7. Post or hold",
};

export function PasteBox() {
  const [text, setText] = useState("");
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
      if (!res.ok || !res.body) {
        throw new Error(`Stream failed (${res.status})`);
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
            setDone(payload as DoneEvent);
          } else if (eventName === "error") {
            setError(payload.error ?? "Pipeline failed");
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
            <Button
              variant="outline"
              onClick={() => setText(SAMPLE_TEXT)}
              disabled={streaming}
            >
              Try a sample (Yoruba)
            </Button>
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
              <span>Running total: ${totalCost.toFixed(6)}</span>
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
