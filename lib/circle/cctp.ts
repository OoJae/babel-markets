// CCTP v2 sweep from Polygon Amoy (domain 7) to Arc testnet (domain 26).
// Phase 5 deliverable. arc-fintech sample at .arc-canteen/context/samples/arc-fintech
// already demonstrates the bridge-kit pattern; mine that file before implementing.

import { CCTP_DOMAINS } from "@/lib/chain/arc";

export interface SweepParams {
  amountUsdc: string;
  fromDomain: number;
  toDomain: number;
  transferSpeed?: "FAST" | "STANDARD";
}

export interface SweepReceipt {
  burnTxHash: string;
  attestationId: string;
  mintTxHash: string;
}

export async function sweepUsdcToArc(_params: SweepParams): Promise<SweepReceipt> {
  throw new Error(
    "CCTP sweep not implemented. Phase 5 task. Reference arc-fintech sample at " +
      ".arc-canteen/context/samples/arc-fintech and use @circle-fin/bridge-kit.",
  );
}

export const DEFAULT_SWEEP_PARAMS = {
  fromDomain: CCTP_DOMAINS.POLYGON_AMOY,
  toDomain: CCTP_DOMAINS.ARC_TESTNET,
  transferSpeed: "FAST" as const,
};
