// Gated-call helper. Each agent step routes through this so the per-step
// Nanopayment receipt and the LLM result land in one shape.
//
// When BABEL_NANOPAYMENTS_ENABLED=1 and the agent EOA is funded, the helper:
//   1. Calls the babel-nanopay seller route via GatewayClient.pay(). The SDK
//      signs an EIP-3009 authorization on the agent's behalf and submits it
//      to Circle's facilitator for batched settlement on Arc testnet.
//   2. Calls callStructured against MiMo for the actual inference.
//   3. Returns the LLM result plus the Nanopayment receipt.
//
// When disabled or the payment errors, the helper falls through to a direct
// callStructured so the pipeline keeps producing questions. The receipt
// surfaces the reason so the UI can show "Nanopayments off" instead of "$X".

import { type ZodType } from "zod";
import { callStructured, type ModelCallResult } from "@/lib/agent/llm";
import {
  payAndCall,
  isNanopaymentsEnabled,
  type NanopaymentReceipt,
} from "@/lib/circle/nanopay";

export interface GatedCallArgs<T> {
  step: string;
  schema: ZodType<T>;
  system: string;
  prompt: string;
  cacheSystemPrompt?: boolean;
  temperature?: number;
}

export interface GatedCallResult<T> extends ModelCallResult<T> {
  nanopayment: NanopaymentReceipt;
}

function getSelfUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.BABEL_PUBLIC_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/babel-nanopay`;
}

export async function gatedCallStructured<T>(
  args: GatedCallArgs<T>,
): Promise<GatedCallResult<T>> {
  let receipt: NanopaymentReceipt;

  if (isNanopaymentsEnabled()) {
    const url = getSelfUrl();
    const payment = await payAndCall({
      url,
      method: "POST",
      body: { step: args.step },
    });
    receipt = payment.receipt;
  } else {
    receipt = {
      paid: false,
      amountUsdc: "0",
      note: "Nanopayments disabled (BABEL_NANOPAYMENTS_ENABLED != 1)",
    };
  }

  const model = await callStructured({
    schema: args.schema,
    system: args.system,
    prompt: args.prompt,
    cacheSystemPrompt: args.cacheSystemPrompt,
    temperature: args.temperature,
  });

  return { ...model, nanopayment: receipt };
}
