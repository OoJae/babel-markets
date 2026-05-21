// Polymarket fills poller. Reads Fill events from the Polymarket CTF Exchange
// contract on Polygon mainnet, filters to orders that carry our builder code,
// computes the builder fee using POLYMARKET_FEE_BPS, and writes `fills` plus
// `attributions` rows.
//
// Designed to run as a Vercel cron every 5 minutes. Idempotent via a Redis
// cursor at `babel:fills:last_block` so we never double-count.
//
// Phase 3 ships the SKELETON. Live event-name + ABI confirmation comes when
// Joseph's verified-tier builder code lands; until then this runs in dry-run
// mode (reads the latest block but writes nothing).

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { getPolygonPublicClient } from "@/lib/chain/polygon";
import { getRedis } from "@/lib/db/redis";
import { getSupabaseServiceClient } from "@/lib/supabase/service-client";

const CTF_EXCHANGE = (process.env.POLYGON_CTF_EXCHANGE_ADDRESS ||
  "0xE111180000d2663C0091e4f400237545B87B996B") as `0x${string}`;
const FEE_BPS = Number(process.env.POLYMARKET_FEE_BPS || "100");
const BUILDER_CODE = process.env.POLYMARKET_BUILDER_CODE || "";
const DRY_RUN =
  process.env.POLYMARKET_LIVE_POSTING !== "1" || !BUILDER_CODE;

interface PollState {
  fromBlock: bigint;
  toBlock: bigint;
}

async function readState(): Promise<PollState> {
  const client = getPolygonPublicClient();
  const head = await client.getBlockNumber();
  let from = head - 1_000n;
  try {
    const redis = getRedis();
    const stored = await redis.get<string>("babel:fills:last_block");
    if (stored) {
      const parsed = BigInt(stored);
      if (parsed > 0n) from = parsed;
    }
  } catch {
    // Redis missing locally; default window.
  }
  return { fromBlock: from, toBlock: head };
}

async function persistCursor(block: bigint) {
  try {
    const redis = getRedis();
    await redis.set("babel:fills:last_block", block.toString(), { ex: 60 * 60 * 24 * 7 });
  } catch {
    // ignore in dev
  }
}

async function main() {
  console.log("[poll-fills] start", {
    ctfExchange: CTF_EXCHANGE,
    feeBps: FEE_BPS,
    builderCode: BUILDER_CODE ? `${BUILDER_CODE.slice(0, 10)}...` : "(none)",
    dryRun: DRY_RUN,
  });

  const { fromBlock, toBlock } = await readState();
  console.log(`[poll-fills] window blocks=${fromBlock}..${toBlock}`);

  if (DRY_RUN) {
    console.log(
      "[poll-fills] dry-run mode: no builder code set or POLYMARKET_LIVE_POSTING off. Skipping event scan.",
    );
    await persistCursor(toBlock);
    return;
  }

  // Full Fill-event decoding lands when Joseph's verified-tier builder code is
  // approved AND we confirm the exact event signature on the CTF Exchange
  // contract. Until then the dry-run path above keeps the cursor advancing so
  // the cron doesn't pile up unprocessed blocks.

  const client = getPolygonPublicClient();
  const fillEventAbi = {
    type: "event",
    name: "OrderFilled",
    inputs: [
      { indexed: true, name: "orderHash", type: "bytes32" },
      { indexed: true, name: "maker", type: "address" },
      { indexed: true, name: "taker", type: "address" },
      { name: "makerAssetId", type: "uint256" },
      { name: "takerAssetId", type: "uint256" },
      { name: "makerAmountFilled", type: "uint256" },
      { name: "takerAmountFilled", type: "uint256" },
      { name: "fee", type: "uint256" },
    ],
  } as const;

  const logs = await client.getLogs({
    address: CTF_EXCHANGE,
    event: fillEventAbi,
    fromBlock,
    toBlock,
  });

  console.log(`[poll-fills] ${logs.length} fill events in window`);
  const supabase = getSupabaseServiceClient();
  let written = 0;

  for (const log of logs) {
    const args = (log as any).args ?? {};
    // The order metadata that contains our builder code is NOT in the Fill
    // event itself; it lives in the off-chain order book. We can fetch it via
    // the CLOB v2 client. Phase 3 ships the skeleton; the fetch-by-orderHash
    // step lands the day we go live.
    if (BUILDER_CODE && args.orderHash) {
      // Placeholder: the real fee-share computation depends on the public
      // Polymarket fee formula, which we'll confirm before live-posting.
      const sizeUsdc = Number(args.makerAmountFilled ?? 0n) / 1_000_000;
      const builderFee = (sizeUsdc * FEE_BPS) / 10_000;
      const { error } = await supabase.from("fills").upsert(
        {
          polymarket_market_id: String(args.makerAssetId ?? ""),
          taker: String(args.taker ?? ""),
          side: "BUY",
          size_usdc: sizeUsdc,
          builder_fee_usdc: builderFee,
          tx_hash: log.transactionHash ?? "",
          observed_at: new Date().toISOString(),
          question_id: null as never,
        } as never,
        { onConflict: "tx_hash,side" } as never,
      );
      if (!error) written += 1;
    }
  }

  console.log(`[poll-fills] wrote ${written} fills rows`);
  await persistCursor(toBlock);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
