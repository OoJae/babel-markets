// Circle Modular Wallets helpers. Used by the passkey enrollment flow on the client
// (see components/passkey-setup.tsx). Server-side helpers live here too for any flow
// that needs to read a user's smart account address from a stored credential.

import { createPublicClient } from "viem";
import {
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
} from "@circle-fin/modular-wallets-core";
import { toWebAuthnAccount } from "viem/account-abstraction";
import { arcTestnet } from "@/lib/chain/arc";

export function getCirclePasskeyTransport() {
  return toPasskeyTransport(
    process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL,
    process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY,
  );
}

export function getCircleModularTransport() {
  // The /arcTestnet suffix targets Arc testnet through Circle's bundler. Confirmed in
  // .arc-canteen/context/docs/circlefin-skills/use-modular-wallets.md.
  return toModularTransport(
    `${process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL}/arcTestnet`,
    process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY,
  );
}

// Derive the smart account address from a stored P256 credential. Useful server-side
// when we have the credential blob but no live browser session.
export async function deriveSmartAccountAddress(credential: unknown) {
  const transport = getCircleModularTransport();
  const publicClient = createPublicClient({ chain: arcTestnet, transport });
  // viem's toWebAuthnAccount accepts the credential shape Circle's passkey returns.
  const webAuthn = toWebAuthnAccount({ credential: credential as never });
  const account = await toCircleSmartAccount({
    client: publicClient,
    owner: webAuthn,
  });
  return account.address;
}
