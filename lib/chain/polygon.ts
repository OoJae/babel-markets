// Polygon Amoy testnet viem client. Polymarket V2 settles on Polygon, so the
// fills poller and CCTP burn live here.

import { createPublicClient, http } from "viem";
import { polygonAmoy } from "viem/chains";

export { polygonAmoy };

export function getPolygonPublicClient() {
  return createPublicClient({
    chain: polygonAmoy,
    transport: http(process.env.POLYGON_RPC_URL),
  });
}
