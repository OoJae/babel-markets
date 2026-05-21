// USDC vs EURC routing. Phase 5 deliverable.
// The agent's QuestionSchema already emits a `currency` field; this module honors it
// at the market layer and the payout layer.

import { type Currency } from "@/lib/agent/schema";
import { ARC_CONTRACTS } from "@/lib/chain/arc";

export function tokenAddressFor(currency: Currency): string {
  return currency === "EURC" ? ARC_CONTRACTS.EURC : ARC_CONTRACTS.USDC;
}

// Decide currency by audience geography. Phase 2 may override with the LLM's own pick.
export function defaultCurrencyForAudience(audienceRegion?: string): Currency {
  if (!audienceRegion) return "USDC";
  const region = audienceRegion.toUpperCase();
  const eu = ["EU", "EUR", "GERMANY", "FRANCE", "ITALY", "SPAIN", "NETHERLANDS"];
  return eu.some((k) => region.includes(k)) ? "EURC" : "USDC";
}
