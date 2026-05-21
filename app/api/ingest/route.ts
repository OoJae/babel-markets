// Synchronous ingest endpoint. Calls the agent pipeline end-to-end and returns
// a single JSON response. Kept around for non-streaming clients (the eval harness
// and any future API consumers). The browser hero path uses /api/agent/stream.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { runPipeline } from "@/lib/agent/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

const InputSchema = z.object({
  sourceText: z.string().min(20).max(20_000),
  sourceUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  // Authed user is optional at the ingest step; anonymous pastes are allowed so the
  // landing page demo works without sign-in friction. Authed pastes get attribution.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Write the submission row via the service client so RLS does not block anon pastes.
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
    console.error("ingest insert error", subError);
    return NextResponse.json(
      { ok: false, error: "Failed to record submission" },
      { status: 500 },
    );
  }

  try {
    const result = await runPipeline({
      sourceText: parsed.data.sourceText,
      sourceUrl: parsed.data.sourceUrl,
      submissionId: submission.id,
      userId: user?.id,
    });

    await service
      .from("submissions")
      .update({ status: "synthesized", source_lang: result.question.source_lang })
      .eq("id", submission.id);

    return NextResponse.json({
      ok: true,
      submissionId: submission.id,
      question: result.question,
      qualityAverage: result.qualityAverage,
      shouldPost: result.shouldPost,
      rationale: result.rationale,
      totalCostUsdc: result.totalCostUsdc,
      totalLatencyMs: result.totalLatencyMs,
      steps: result.steps,
    });
  } catch (err) {
    console.error("pipeline error", err);
    await service
      .from("submissions")
      .update({ status: "failed" })
      .eq("id", submission.id);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Pipeline failed" },
      { status: 500 },
    );
  }
}
