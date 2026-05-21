// Arc testnet chain definition + viem public client.
// Hard facts confirmed in .arc-canteen/context/docs/docs.arc.network/arc-chain.md
// and connect-to-arc.md as of 2026-05-21.

import { createPublicClient, defineChain, http } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// Contract addresses on Arc testnet. Confirm against ARC-cli context before sending real value.
export const ARC_CONTRACTS = {
  // USDC, native gas + ERC-20 interface. 18 decimals for gas, 6 for ERC-20.
  USDC: "0x3600000000000000000000000000000000000000",
  // EURC, 6 decimals.
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  // Paymaster v0.8 (testnet). Lets users sign without holding native gas.
  PAYMASTER_V08: "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966",
} as const;

// CCTP domain IDs. Polygon Amoy 7, Arc testnet 26.
export const CCTP_DOMAINS = {
  POLYGON_AMOY: 7,
  ARC_TESTNET: 26,
} as const;

export function getArcPublicClient(rpcUrl?: string) {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl ?? process.env.ARC_RPC_URL),
  });
}
