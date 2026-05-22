// Server-Sent Events endpoint that streams the agent pipeline step by step.
// This is the hero shot of the demo video: paste a non-English article, watch the
// 7 agent steps land one at a time with each step's cost in USDC.

import { NextRequest } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/lib/agent/pipeline";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { pinReasoningTrace } from "@/lib/proof/irys";
import { isEscrowDeployed, registerQuestion } from "@/lib/chain/escrow";
import type { Address } from "viem";

export const runtime = "nodejs";
export const maxDuration = 300;

const InputSchema = z.object({
  sourceText: z.string().min(20).max(20_000),
  sourceUrl: z.string().url().optional(),
});

function sseEncode(event: string, payload: unknown): Uint8Array {
  // BigInt-aware replacer: any SDK field that returns a BigInt (e.g. Circle's
  // PayResult.amount) is coerced to its decimal string. Defense in depth so a
  // future SDK leak does not crash the stream.
  const data = JSON.stringify(payload, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
  return new TextEncoder().encode(`event: ${event}\ndata: ${data}\n\n`);
}

export async function POST(req: NextRequest) {
  // Dev-only diagnostic: confirm the route is reached and inspect inbound headers.
  // Remove once Phase 2 hotfix work is done.
  console.log(
    "[/api/agent/stream] POST received",
    JSON.stringify({
      contentType: req.headers.get("content-type"),
      contentLength: req.headers.get("content-length"),
      ua: req.headers.get("user-agent")?.slice(0, 60),
    }),
  );

  let body: unknown;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[/api/agent/stream] JSON parse failed:", e);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  // Surface body shape in the server console so we can see exactly what arrived
  // when validation rejects.
  if (typeof body === "object" && body !== null) {
    const sample = body as Record<string, unknown>;
    const sourceText = typeof sample.sourceText === "string" ? sample.sourceText : "";
    console.log(
      "[/api/agent/stream] body shape",
      JSON.stringify({
        keys: Object.keys(sample),
        sourceTextLen: sourceText.length,
        sourceTextPreview: sourceText.slice(0, 80).replace(/\s+/g, " "),
      }),
    );
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    console.warn("[/api/agent/stream] validation failed:", message);
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }

  const supabaseUser = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  const service = getSupabaseServiceClient();
  const { data: submission, error: subError } = await service
    .from("submissions")
    .insert({
      profile_id: user?.id ?? null,
      source_text: parsed.data.sourceText,
      source_url: parsed.data.sourceUrl ?? null,
      status: "processing",
    })
    .select("id")
    .single();

  if (subError || !submission) {
    return new Response(
      JSON.stringify({ error: "Failed to record submission" }),
      { status: 500 },
    );
  }

  const submissionId = submission.id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sseEncode("submission", { submissionId }));
      try {
        const result = await runPipeline({
          sourceText: parsed.data.sourceText,
          sourceUrl: parsed.data.sourceUrl,
          submissionId,
          userId: user?.id,
          onStep: (event) => {
            controller.enqueue(sseEncode("step", event));
          },
        });

        await service
          .from("submissions")
          .update({
            status: "synthesized",
            source_lang: result.question.source_lang,
          })
          .eq("id", submissionId);

        // Persist the synthesized question so the market view page can render it.
        // Wrapped in try/catch so a Supabase hiccup doesn't kill the stream.
        let questionId: string | null = null;
        try {
          const { data: qrow } = await service
            .from("questions")
            .insert({
              submission_id: submissionId,
              profile_id: user?.id ?? null,
              question_text: result.question.question.slice(0, 500),
              resolution_rule: result.question.resolution_rule,
              resolution_source: result.question.resolution_source,
              expiry: result.question.expiry,
              category: result.question.category,
              currency: result.question.currency,
              suggested_probability: result.question.suggested_probability,
              source_lang: result.question.source_lang,
              quality_score: result.qualityAverage,
              status: result.shouldPost ? "ready" : "draft",
              polymarket_market_id: result.matchedMarket?.id ?? null,
            })
            .select("id")
            .single();
          questionId = qrow?.id ?? null;
        } catch (qerr) {
          console.warn("[stream] questions insert failed:", qerr);
        }

        controller.enqueue(
          sseEncode("done", {
            questionId,
            question: result.question,
            quality: result.quality,
            qualityAverage: result.qualityAverage,
            shouldPost: result.shouldPost,
            rationale: result.rationale,
            matchedMarket: result.matchedMarket
              ? {
                  id: result.matchedMarket.id,
                  conditionId: result.matchedMarket.conditionId,
                  question: result.matchedMarket.question,
                  url: result.matchedMarket.url,
                }
              : null,
            matchedSimilarity: result.matchedSimilarity ?? null,
            totalCostUsdc: result.totalCostUsdc,
            totalLatencyMs: result.totalLatencyMs,
          }),
        );

        // Register the question on AttributionEscrow so future fill credits can
        // accrue onchain. Fire-and-forget; the contract is the source of truth
        // for payouts, but the demo still works if this fails (questions row
        // already exists, the dashboard reads accrued from the contract).
        if (questionId && user?.id && isEscrowDeployed() && result.shouldPost) {
          (async () => {
            try {
              const { data: wallet } = await service
                .from("wallets")
                .select("wallet_address")
                .eq("profile_id", user.id)
                .eq("blockchain", "ARC")
                .limit(1)
                .maybeSingle();
              const addr = (wallet as { wallet_address?: string } | null)?.wallet_address;
              if (!addr) return;
              const tx = await registerQuestion({
                questionId,
                creatorAddress: addr as Address,
              });
              console.log(`[stream] registerQuestion tx=${tx}`);
            } catch (e) {
              console.warn(
                "[stream] registerQuestion failed:",
                e instanceof Error ? e.message : e,
              );
            }
          })();
        }

        // Fire-and-forget IPFS pin so the stream can close before the upload
        // finishes. The CID lands on the questions row asynchronously.
        if (questionId) {
          const tracePayload = {
            babel_version: "phase-3",
            submission_id: submissionId,
            question_id: questionId,
            steps: result.steps,
            question: result.question,
            quality: result.quality,
            rationale: result.rationale,
            matched_market: result.matchedMarket ?? null,
            generated_at: new Date().toISOString(),
          };
          pinReasoningTrace(tracePayload)
            .then(async (cid) => {
              await service
                .from("questions")
                .update({ ipfs_cid: cid })
                .eq("id", questionId);
            })
            .catch((err) => {
              console.warn("[stream] IPFS pin failed:", err);
            });
        }
      } catch (err) {
        controller.enqueue(
          sseEncode("error", {
            error: err instanceof Error ? err.message : "Pipeline failed",
          }),
        );
        await service
          .from("submissions")
          .update({ status: "failed" })
          .eq("id", submissionId);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
