// AttributionEscrow read/write helpers. Wraps the deployed contract on Arc
// testnet (address in ATTRIBUTION_ESCROW_ADDRESS). Off-chain plumbing only;
// the .sol source lives at contracts/AttributionEscrow.sol.

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  keccak256,
  toHex,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_CONTRACTS } from "@/lib/chain/arc";

// The ABI is small enough to keep inline; mirrors contracts/AttributionEscrow.sol.
// We do not import from contracts/build/ because that artifact is gitignored
// and not present at runtime on Vercel.
export const ESCROW_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "accrued",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "questionCreator",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "registerQuestion",
    stateMutability: "nonpayable",
    inputs: [
      { type: "bytes32", name: "questionId" },
      { type: "address", name: "creator" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "creditFees",
    stateMutability: "nonpayable",
    inputs: [
      { type: "bytes32", name: "questionId" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "payoutBatch",
    stateMutability: "nonpayable",
    inputs: [{ type: "address[]", name: "creators" }],
    outputs: [],
  },
] as const;

function getEscrowAddress(): Address | null {
  const addr = process.env.ATTRIBUTION_ESCROW_ADDRESS;
  if (!addr || !addr.startsWith("0x") || addr.length !== 42) return null;
  return addr as Address;
}

export function isEscrowDeployed(): boolean {
  return getEscrowAddress() !== null;
}

function getPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"),
  });
}

function getOwnerWallet() {
  const key = process.env.AGENT_EOA_PRIVATE_KEY;
  if (!key || !key.startsWith("0x")) {
    throw new Error("AGENT_EOA_PRIVATE_KEY missing or invalid");
  }
  const account = privateKeyToAccount(key as Hex);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"),
  });
}

// The contract takes a bytes32 questionId; we keccak256 the Supabase UUID so
// every question gets a deterministic on-chain id without changing the schema.
export function questionIdToBytes32(questionId: string): Hex {
  return keccak256(toHex(questionId));
}

export interface CreditFeesParams {
  questionId: string;
  amountUsdc: string;
  creatorAddress: Address;
}

export async function registerQuestion(params: {
  questionId: string;
  creatorAddress: Address;
}): Promise<Hex> {
  const address = getEscrowAddress();
  if (!address) throw new Error("ATTRIBUTION_ESCROW_ADDRESS not set");
  const wallet = getOwnerWallet();
  return wallet.writeContract({
    address,
    abi: ESCROW_ABI,
    functionName: "registerQuestion",
    args: [questionIdToBytes32(params.questionId), params.creatorAddress],
  });
}

export async function creditFees(params: CreditFeesParams): Promise<Hex> {
  const address = getEscrowAddress();
  if (!address) throw new Error("ATTRIBUTION_ESCROW_ADDRESS not set");
  const wallet = getOwnerWallet();
  const amount = parseUnits(params.amountUsdc, 6);
  return wallet.writeContract({
    address,
    abi: ESCROW_ABI,
    functionName: "creditFees",
    args: [questionIdToBytes32(params.questionId), amount],
  });
}

// claimPayout is called from the dashboard "Claim" button. The caller is the
// creator's wallet (Modular Wallet, EOA-equivalent address). When triggered via
// the API on behalf of the user, the owner key cannot claim for them; the
// dashboard sends a transaction from the user's wallet directly. This helper
// stays available for owner-batched payouts (payoutBatch).
export async function payoutBatch(creators: Address[]): Promise<Hex> {
  const address = getEscrowAddress();
  if (!address) throw new Error("ATTRIBUTION_ESCROW_ADDRESS not set");
  const wallet = getOwnerWallet();
  return wallet.writeContract({
    address,
    abi: ESCROW_ABI,
    functionName: "payoutBatch",
    args: [creators],
  });
}

export async function readAccruedBalance(creator: Address): Promise<string> {
  const address = getEscrowAddress();
  if (!address) return "0";
  const client = getPublicClient();
  const raw = await client.readContract({
    address,
    abi: ESCROW_ABI,
    functionName: "accrued",
    args: [creator],
  });
  return formatUnits(raw as bigint, 6);
}

export async function readQuestionCreator(questionId: string): Promise<Address | null> {
  const address = getEscrowAddress();
  if (!address) return null;
  const client = getPublicClient();
  const creator = await client.readContract({
    address,
    abi: ESCROW_ABI,
    functionName: "questionCreator",
    args: [questionIdToBytes32(questionId)],
  });
  const c = creator as Address;
  if (c === "0x0000000000000000000000000000000000000000") return null;
  return c;
}

// claimPayout returns the typed payload a client-side wallet needs to call
// `claim()` from the creator's address. Used by the dashboard "Claim" button
// when wired to the Modular Wallet signer.
export function claimPayoutCalldata() {
  const address = getEscrowAddress();
  if (!address) throw new Error("ATTRIBUTION_ESCROW_ADDRESS not set");
  return {
    to: address,
    abi: ESCROW_ABI,
    functionName: "claim" as const,
  };
}
