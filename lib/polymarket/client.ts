// Polymarket CLOB v2 client wrapper.
//
// Single chokepoint for all order-posting calls. Attaches the configured
// builder code to every order via the SDK's BuilderConfig so attribution lands
// in the signed EIP-712 struct.
//
// Defaults to PREVIEW mode: returns the signed order payload without submitting,
// so we can build and test the full flow without funding a Polygon mainnet
// signer. Flip POLYMARKET_LIVE_POSTING=1 once Joseph's verified-tier code is
// approved AND a mainnet signer is funded.
//
// Live docs confirm:
// - Package: @polymarket/clob-client-v2
// - Host: https://clob.polymarket.com
// - Chain: Polygon mainnet (137); no V2 testnet exists
// - BuilderConfig: { builderCode: string }
// - Method: client.createAndPostOrder(userOrder, options, orderType?, postOnly?, deferExec?)

import { ClobClient } from "@polymarket/clob-client-v2";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import type {
  PostOrderParams,
  PostOrderResult,
  SignedOrderPreview,
} from "@/lib/polymarket/types";

const POLYMARKET_HOST = "https://clob.polymarket.com";
const POLYGON_CHAIN_ID = 137;

let cachedClient: ClobClient | null = null;

function liveMode(): boolean {
  return process.env.POLYMARKET_LIVE_POSTING === "1";
}

function builderCode(): string {
  return process.env.POLYMARKET_BUILDER_CODE ?? "";
}

async function ensureClient(): Promise<ClobClient> {
  if (cachedClient) return cachedClient;
  const signerKey = process.env.POLYMARKET_SIGNER_KEY;
  if (!signerKey || !signerKey.startsWith("0x")) {
    throw new Error(
      "POLYMARKET_SIGNER_KEY missing or not 0x-prefixed; Polymarket client cannot init",
    );
  }
  // ClobSigner accepts viem WalletClient; we use viem directly to avoid pulling
  // in ethers as a parallel chain stack.
  const account = privateKeyToAccount(signerKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || polygon.rpcUrls.default.http[0]),
  });
  const code = builderCode();
  cachedClient = new ClobClient({
    host: POLYMARKET_HOST,
    chain: POLYGON_CHAIN_ID,
    signer: walletClient as never,
    ...(code ? { builderConfig: { builderCode: code } } : {}),
  });
  return cachedClient;
}

async function buildPreview(params: PostOrderParams): Promise<SignedOrderPreview> {
  // In preview mode, we still construct the signed order so the UI can show
  // what would be submitted. We do this via the SDK's order builder rather than
  // hitting the CLOB. If signer / network init fails, we fall back to an
  // unsigned preview so the demo path still works.
  const code = params.builderCode ?? builderCode();
  try {
    const client = await ensureClient();
    // The SDK exposes orderBuilder; build the order locally and surface it.
    const built = await (client as any).createOrder({
      tokenID: params.tokenID,
      price: params.price,
      side: params.side === "BUY" ? 0 : 1,
      size: params.size,
    });
    return {
      signedOrder: built ?? null,
      builderCode: code,
      tokenID: params.tokenID,
      price: params.price,
      size: params.size,
      side: params.side,
    };
  } catch {
    return {
      signedOrder: null,
      builderCode: code,
      tokenID: params.tokenID,
      price: params.price,
      size: params.size,
      side: params.side,
    };
  }
}

export async function postOrder(params: PostOrderParams): Promise<PostOrderResult> {
  const preview = await buildPreview(params);

  if (!liveMode()) {
    return { submitted: false, preview };
  }

  const code = preview.builderCode;
  if (!code) {
    throw new Error(
      "POLYMARKET_LIVE_POSTING is on but POLYMARKET_BUILDER_CODE is empty; refusing to submit without builder attribution",
    );
  }

  const client = await ensureClient();
  const receipt = await client.createAndPostOrder({
    tokenID: params.tokenID,
    price: params.price,
    side: params.side === "BUY" ? 0 : (1 as never),
    size: params.size,
  } as never);
  return { submitted: true, preview, receipt };
}

export function getBuilderCode(): string {
  return builderCode();
}

export function isLiveMode(): boolean {
  return liveMode();
}
