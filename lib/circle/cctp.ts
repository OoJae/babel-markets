// CCTP v2 sweep Polygon Amoy (domain 7) to Arc testnet (domain 26).
//
// Raw viem against TokenMessengerV2 + MessageTransmitterV2, with the Iris v2
// sandbox attestation API in between. No bridge-kit, no Circle Developer
// Wallets; just the agent EOA on both legs.
//
// CRITICAL: amounts are in 6-decimal USDC subunits everywhere except the
// optional `note` strings. The dashboard "Sweep to Arc" button is the only
// user-facing trigger.

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  pad,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { arcTestnet, CCTP_DOMAINS } from "@/lib/chain/arc";

// CCTP v2 testnet contracts. The same address ships on every supported testnet,
// confirmed against .arc-canteen/context/docs/developers.circle.com/cctp/references/contract-addresses.md
// (Testnet contract addresses section, scanned 2026-05-22).
export const CCTP_V2_TESTNET = {
  TOKEN_MESSENGER: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as Address,
  MESSAGE_TRANSMITTER: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as Address,
} as const;

// Source-chain USDC contracts.
export const CCTP_TESTNET_USDC = {
  POLYGON_AMOY: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as Address,
} as const;

const IRIS_V2_TESTNET = "https://iris-api-sandbox.circle.com/v2";

// Fast Transfer finality threshold per the quickstart. 1000 or lower triggers
// fast finality on supported chains; anything higher is hard finality.
const MIN_FINALITY_THRESHOLD_FAST = 1000;

// 500 subunits = 0.0005 USDC, matches the docs' demo fee for fast transfer.
const DEFAULT_MAX_FEE_SUBUNITS = 500n;

// Attestation polling settings. Iris v2 typically completes within 30-90s on
// fast transfer. Vercel Hobby caps the calling route at 300s total, so we
// budget ~240s for the attestation and leave headroom for the burn + mint txs.
const ATTESTATION_POLL_BACKOFFS_MS = [3_000, 5_000, 8_000, 13_000, 21_000, 34_000, 55_000, 90_000];
const ATTESTATION_MAX_TOTAL_MS = 4 * 60 * 1000;

const TOKEN_MESSENGER_ABI = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
] as const;

const MESSAGE_TRANSMITTER_ABI = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export interface SweepParams {
  amountUsdc: string;
  recipientArc?: Address;
}

export interface SweepProgress {
  stage: "burn-pending" | "burn-confirmed" | "attestation-fetched" | "mint-confirmed";
  burnTxHash?: Hex;
  attestationStatus?: string;
  mintTxHash?: Hex;
  note?: string;
}

export interface SweepResult {
  burnTxHash: Hex;
  attestationStatus: string;
  mintTxHash: Hex;
  amountUsdc: string;
}

export function cctpEnabled(): boolean {
  return process.env.BABEL_CCTP_ENABLED === "1";
}

function getAgentAccount() {
  const key = process.env.AGENT_EOA_PRIVATE_KEY;
  if (!key || !key.startsWith("0x")) {
    throw new Error("AGENT_EOA_PRIVATE_KEY missing or invalid");
  }
  return privateKeyToAccount(key as Hex);
}

function addressToBytes32(addr: Address): Hex {
  return pad(addr, { size: 32 });
}

interface IrisMessage {
  status: "pending_confirmations" | "complete" | string;
  message?: Hex;
  attestation?: Hex;
  eventNonce?: string;
}

async function fetchAttestation(
  burnTxHash: Hex,
  fromDomain: number,
  onPoll?: (status: string) => void,
): Promise<{ message: Hex; attestation: Hex; status: string }> {
  const url = `${IRIS_V2_TESTNET}/messages/${fromDomain}?transactionHash=${burnTxHash}`;
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < ATTESTATION_MAX_TOTAL_MS) {
    const res = await fetch(url);
    if (res.ok) {
      const json = (await res.json()) as { messages?: IrisMessage[] };
      const msg = json.messages?.[0];
      if (msg) {
        onPoll?.(msg.status);
        if (msg.status === "complete" && msg.message && msg.attestation) {
          return { message: msg.message, attestation: msg.attestation, status: msg.status };
        }
      }
    } else if (res.status !== 404) {
      const text = (await res.text()).slice(0, 200);
      throw new Error(`Iris attestation fetch failed (${res.status}): ${text}`);
    }
    const wait =
      ATTESTATION_POLL_BACKOFFS_MS[Math.min(attempt, ATTESTATION_POLL_BACKOFFS_MS.length - 1)];
    await new Promise((r) => setTimeout(r, wait));
    attempt += 1;
  }
  throw new Error("Iris attestation timed out after 10 minutes");
}

export async function burnOnPolygon(
  amountSubunits: bigint,
  recipientArc: Address,
): Promise<Hex> {
  const account = getAgentAccount();
  const rpcUrl = process.env.POLYGON_RPC_URL;
  if (!rpcUrl) throw new Error("POLYGON_RPC_URL not set");
  const publicClient = createPublicClient({ chain: polygonAmoy, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: polygonAmoy, transport: http(rpcUrl) });

  const usdc = CCTP_TESTNET_USDC.POLYGON_AMOY;
  const messenger = CCTP_V2_TESTNET.TOKEN_MESSENGER;

  const allowance = (await publicClient.readContract({
    address: usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, messenger],
  })) as bigint;

  if (allowance < amountSubunits + DEFAULT_MAX_FEE_SUBUNITS) {
    const approveTx = await walletClient.writeContract({
      address: usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [messenger, amountSubunits + DEFAULT_MAX_FEE_SUBUNITS],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  const burnTx = await walletClient.writeContract({
    address: messenger,
    abi: TOKEN_MESSENGER_ABI,
    functionName: "depositForBurn",
    args: [
      amountSubunits,
      CCTP_DOMAINS.ARC_TESTNET,
      addressToBytes32(recipientArc),
      usdc,
      // destinationCaller = 0x000...0 means "anyone can mint", which is what
      // we want; the agent EOA is the one calling receiveMessage on Arc.
      addressToBytes32("0x0000000000000000000000000000000000000000"),
      DEFAULT_MAX_FEE_SUBUNITS,
      MIN_FINALITY_THRESHOLD_FAST,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: burnTx });
  return burnTx;
}

export async function mintOnArc(message: Hex, attestation: Hex): Promise<Hex> {
  const account = getAgentAccount();
  const rpcUrl = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });

  const mintTx = await walletClient.writeContract({
    address: CCTP_V2_TESTNET.MESSAGE_TRANSMITTER,
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: "receiveMessage",
    args: [message, attestation],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintTx });
  return mintTx;
}

export async function* sweepUsdcToArc(
  params: SweepParams,
): AsyncGenerator<SweepProgress, SweepResult, void> {
  const account = getAgentAccount();
  const recipient = params.recipientArc ?? (account.address as Address);
  const amountSubunits = parseUnits(params.amountUsdc, 6);

  yield { stage: "burn-pending", note: `Burning ${params.amountUsdc} USDC on Polygon Amoy` };
  const burnTxHash = await burnOnPolygon(amountSubunits, recipient);
  yield { stage: "burn-confirmed", burnTxHash };

  let lastStatus = "pending_confirmations";
  const { message, attestation, status } = await fetchAttestation(
    burnTxHash,
    CCTP_DOMAINS.POLYGON_AMOY,
    (s) => {
      lastStatus = s;
    },
  );
  yield { stage: "attestation-fetched", attestationStatus: status, burnTxHash };

  const mintTxHash = await mintOnArc(message, attestation);
  yield { stage: "mint-confirmed", mintTxHash, burnTxHash, attestationStatus: status };

  return {
    burnTxHash,
    attestationStatus: status || lastStatus,
    mintTxHash,
    amountUsdc: params.amountUsdc,
  };
}

// Mock generator used when BABEL_CCTP_ENABLED != "1". Same shape, fake hashes.
export async function* sweepUsdcToArcMock(
  params: SweepParams,
): AsyncGenerator<SweepProgress, SweepResult, void> {
  const fakeHash = (): Hex => {
    const hex = Array.from({ length: 64 })
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join("");
    return `0x${hex}` as Hex;
  };
  const burnTxHash = fakeHash();
  const mintTxHash = fakeHash();
  yield { stage: "burn-pending", note: `(mock) burning ${params.amountUsdc} USDC` };
  await new Promise((r) => setTimeout(r, 600));
  yield { stage: "burn-confirmed", burnTxHash };
  await new Promise((r) => setTimeout(r, 1_200));
  yield {
    stage: "attestation-fetched",
    attestationStatus: "complete",
    burnTxHash,
    note: "(mock) Iris attestation",
  };
  await new Promise((r) => setTimeout(r, 600));
  yield { stage: "mint-confirmed", mintTxHash, burnTxHash, attestationStatus: "complete" };
  return {
    burnTxHash,
    attestationStatus: "complete",
    mintTxHash,
    amountUsdc: params.amountUsdc,
  };
}
