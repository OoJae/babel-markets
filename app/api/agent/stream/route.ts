// Server-Sent Events endpoint that streams the agent pipeline step by step.
// This is the hero shot of the demo video: paste a non-English article, watch the
// 7 agent steps land one at a time with each step's cost in USDC.

import { NextRequest } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/lib/agent/pipeline";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";
export const maxDuration = 300;

const InputSchema = z.object({
  sourceText: z.string().min(20).max(20_000),
  sourceUrl: z.string().url().optional(),
});

function sseEncode(event: string, payload: unknown): Uint8Array {
  const data = JSON.stringify(payload);
  return new TextEncoder().encode(`event: ${event}\ndata: ${data}\n\n`);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues.map((i) => i.message).join("; "),
      }),
      { status: 400 },
    );
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

        controller.enqueue(
          sseEncode("done", {
            question: result.question,
            quality: result.quality,
            qualityAverage: result.qualityAverage,
            shouldPost: result.shouldPost,
            rationale: result.rationale,
            totalCostUsdc: result.totalCostUsdc,
            totalLatencyMs: result.totalLatencyMs,
          }),
        );
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
