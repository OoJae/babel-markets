// USDC vs EURC routing. The agent's QuestionSchema already emits `currency`;
// these helpers map it to the right on-chain bits at the market and escrow
// layers.

import { type Currency } from "@/lib/agent/schema";
import { ARC_CONTRACTS, arcTestnet } from "@/lib/chain/arc";

export function tokenAddressFor(currency: Currency): `0x${string}` {
  return (currency === "EURC" ? ARC_CONTRACTS.EURC : ARC_CONTRACTS.USDC) as `0x${string}`;
}

export function displayLabelFor(currency: Currency): string {
  return currency === "EURC" ? "EURC" : "USDC";
}

// Both Arc stablecoins are 6 decimals on the ERC-20 interface.
export function decimalsFor(_currency: Currency): number {
  return 6;
}

export function explorerTokenUrl(currency: Currency): string {
  const base = arcTestnet.blockExplorers.default.url.replace(/\/$/, "");
  return `${base}/token/${tokenAddressFor(currency)}`;
}

// Decide currency by audience geography. The LLM's own pick (in QuestionSchema)
// overrides this; we only fall back when the model is silent.
export function defaultCurrencyForAudience(audienceRegion?: string): Currency {
  if (!audienceRegion) return "USDC";
  const region = audienceRegion.toUpperCase();
  const eu = ["EU", "EUR", "GERMANY", "FRANCE", "ITALY", "SPAIN", "NETHERLANDS"];
  return eu.some((k) => region.includes(k)) ? "EURC" : "USDC";
}
