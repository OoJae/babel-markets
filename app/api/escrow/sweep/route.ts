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
import {
  creditFees,
  getPublicEscrowAddress,
  isEscrowDeployed,
} from "@/lib/chain/escrow";
import type { Address } from "viem";

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

  // Resolve the user's Arc wallet + most recent registered question up front so
  // the post-mint creditFees step has what it needs. In real CCTP mode we also
  // route the mint into the escrow contract so it has working capital that
  // backs the credit we are about to write to AttributionEscrow.accrued[].
  const escrowAddress = getPublicEscrowAddress();
  const { data: arcWalletRow } = await service
    .from("wallets")
    .select("wallet_address")
    .eq("profile_id", user.id)
    .eq("blockchain", "ARC")
    .limit(1)
    .maybeSingle();
  const arcWallet =
    (arcWalletRow as { wallet_address?: string } | null)?.wallet_address ?? null;
  const { data: registeredQuestion } = await service
    .from("questions")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const creditQuestionId =
    (registeredQuestion as { id?: string } | null)?.id ?? null;
  const canCredit =
    !mock && isEscrowDeployed() && !!arcWallet && !!creditQuestionId;

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
          : sweepUsdcToArc({
              amountUsdc: parsed.data.amountUsdc,
              // Mint into the escrow contract so the USDC it just received
              // backs the creditFees call we are about to issue.
              recipientArc: (escrowAddress ?? undefined) as Address | undefined,
            });
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

        // Credit the swept amount to the creator's accrued balance on
        // AttributionEscrow. In the production flow this is normally done by
        // scripts/poll-fills.ts when a real Polymarket fill lands; for the
        // hackathon demo we route each manual sweep through the same
        // creditFees path so the Claim button activates end-to-end. Skipped
        // in mock mode (no real USDC backs the contract) and when the user
        // has no registered question yet (creditFees would revert with
        // "unknown question").
        let creditTxHash: string | null = null;
        if (canCredit && result && creditQuestionId && arcWallet) {
          controller.enqueue(
            sseEncode("credit-pending", {
              note: "Crediting accrued balance on AttributionEscrow",
            }),
          );
          try {
            const tx = await creditFees({
              questionId: creditQuestionId,
              amountUsdc: parsed.data.amountUsdc,
              creatorAddress: arcWallet as Address,
            });
            creditTxHash = tx;
            await service.from("escrow_credits").insert({
              question_id: creditQuestionId,
              creator_profile_id: user.id,
              amount_usdc: Number(parsed.data.amountUsdc),
              arc_tx: tx,
            });
            controller.enqueue(
              sseEncode("credit-confirmed", {
                creditTxHash: tx,
                amountUsdc: parsed.data.amountUsdc,
              }),
            );
          } catch (e) {
            console.warn(
              "[sweep] creditFees failed:",
              e instanceof Error ? e.message : e,
            );
            controller.enqueue(
              sseEncode("credit-skipped", {
                reason:
                  e instanceof Error
                    ? `creditFees reverted: ${e.message.slice(0, 160)}`
                    : "creditFees failed",
              }),
            );
          }
        } else if (!mock && isEscrowDeployed()) {
          const reason = !arcWallet
            ? "Set up your passkey wallet to credit accrued balance."
            : !creditQuestionId
              ? "No registered question yet; create a market first."
              : "Escrow not available; skipping credit.";
          controller.enqueue(sseEncode("credit-skipped", { reason }));
        }

        controller.enqueue(
          sseEncode("done", {
            sweepId,
            mock,
            result,
            creditTxHash,
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
