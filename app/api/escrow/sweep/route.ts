// Manual "Sweep fees to Arc" route. Streams CCTP v2 burn -> attestation ->
// mint progress as SSE events. When BABEL_CCTP_ENABLED != "1", uses the mock
// generator so the UI flow is testable without burning testnet USDC.

import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import {
  cctpEnabled,
  sweepUsdcToArc,
  sweepUsdcToArcMock,
  type SweepProgress,
  type SweepResult,
} from "@/lib/circle/cctp";

export const runtime = "nodejs";
// Vercel Hobby caps Serverless Functions at 300s. The mock sweep finishes in
// ~2.5s; a real CCTP sweep usually completes in 30-90s on Arc testnet but can
// stretch to several minutes on a slow attestation. If we hit the cap, the
// `sweeps` row stays in `pending` and a follow-up poller (TODO post-hackathon)
// can finish the mint.
export const maxDuration = 300;

const InputSchema = z.object({
  amountUsdc: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .refine((v) => Number(v) >= 0.1, { message: "Minimum sweep is 0.1 USDC" }),
});

function sseEncode(event: string, payload: unknown): Uint8Array {
  const data = JSON.stringify(payload, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
  return new TextEncoder().encode(`event: ${event}\ndata: ${data}\n\n`);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues.map((i) => i.message).join("; ") }),
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Sign in required" }), { status: 401 });
  }

  const service = getSupabaseServiceClient();
  const { data: sweep } = await service
    .from("sweeps")
    .insert({
      initiator_profile_id: user.id,
      amount_usdc: Number(parsed.data.amountUsdc),
      status: "pending",
    })
    .select("id")
    .single();
  const sweepId = (sweep as { id?: string } | null)?.id;

  const mock = !cctpEnabled();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        sseEncode("init", {
          sweepId,
          mock,
          amountUsdc: parsed.data.amountUsdc,
        }),
      );
      try {
        const gen = mock
          ? sweepUsdcToArcMock({ amountUsdc: parsed.data.amountUsdc })
          : sweepUsdcToArc({ amountUsdc: parsed.data.amountUsdc });
        let result: SweepResult | null = null;
        while (true) {
          const next = await gen.next();
          if (next.done) {
            result = next.value;
            break;
          }
          const progress = next.value as SweepProgress;
          controller.enqueue(sseEncode("progress", progress));
          if (sweepId) {
            await service
              .from("sweeps")
              .update({
                burn_tx: progress.burnTxHash ?? null,
                mint_tx: progress.mintTxHash ?? null,
                attestation_id: progress.attestationStatus ?? null,
              })
              .eq("id", sweepId);
          }
        }
        if (sweepId && result) {
          await service
            .from("sweeps")
            .update({
              status: "complete",
              burn_tx: result.burnTxHash,
              mint_tx: result.mintTxHash,
              attestation_id: result.attestationStatus,
              settled_at: new Date().toISOString(),
            })
            .eq("id", sweepId);
        }
        controller.enqueue(
          sseEncode("done", {
            sweepId,
            mock,
            result,
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sweep failed";
        if (sweepId) {
          await service
            .from("sweeps")
            .update({ status: "failed", error: message })
            .eq("id", sweepId);
        }
        controller.enqueue(sseEncode("error", { error: message }));
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
