"use client";

// Babel Markets, passkey enrollment. Lifted (slimmed) from arc-p2p-payments and
// adjusted for the Babel database schema.
//
// Flow:
//  1. Browser asks Circle Modular Wallets to register a P256 credential via WebAuthn.
//  2. We derive the smart account address by piping the credential through
//     toCircleSmartAccount on the Arc testnet bundler.
//  3. We POST the credential blob + smart account address to /api/setup-wallets,
//     which writes a wallets row tied to the user's profile.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicClient } from "viem";
import { toWebAuthnAccount } from "viem/account-abstraction";
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
} from "@circle-fin/modular-wallets-core";
import { arcTestnet } from "@/lib/chain/arc";

interface Props {
  // Uniquely identifies the user inside Circle's project (we derive
  // `babel-${user.id}`). Never collides across signups, never shown to the user.
  username: string;
  // Optional human-readable name for greeting copy on the card. Defaults to
  // "creator" if absent.
  displayName?: string;
}

export function PasskeySetup({ username, displayName }: Props) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const clientKey = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY;
  const clientUrl = process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL;

  async function enroll() {
    if (typeof window === "undefined" || !clientKey || !clientUrl) {
      setError("Circle credentials missing. See SETUP.md.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const passkeyTransport = toPasskeyTransport(clientUrl, clientKey);
      const credential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Register,
        username,
      });

      // Derive the smart account address.
      const modularTransport = toModularTransport(`${clientUrl}/arcTestnet`, clientKey);
      const publicClient = createPublicClient({
        chain: arcTestnet,
        transport: modularTransport,
      });
      const webAuthnAccount = toWebAuthnAccount({ credential });
      const circleAccount = await toCircleSmartAccount({
        client: publicClient,
        owner: webAuthnAccount,
      });
      const circleAddress = circleAccount.address.toLowerCase();

      const res = await fetch("/api/setup-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: JSON.stringify(credential),
          circleAddress,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `setup-wallets failed (${res.status})`);
      }

      // Small delay so the row is committed before redirect.
      await new Promise((r) => setTimeout(r, 600));
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey enrollment failed.");
    } finally {
      setCreating(false);
    }
  }

  const greeting = displayName ? `, ${displayName.split(/[@\s]/)[0]}` : "";
  return (
    <div className="auth-card passkey-card">
      <h1>
        Set up <em>your wallet{greeting}.</em>
      </h1>
      <p className="copy">
        Babel uses a Circle Modular Smart Account secured by a passkey. Authenticate
        with Face ID or your fingerprint. No seed phrase. The wallet lives on Arc
        testnet and signs trades with your builder code attached.
      </p>
      {error && <p className="auth-error">{error}</p>}
      <div className="actions">
        <button
          type="button"
          className="auth-submit"
          onClick={enroll}
          disabled={creating}
        >
          {creating ? "Setting up passkey..." : "Create wallet with passkey"}
        </button>
        <button
          type="button"
          className="brand-pill outline"
          onClick={() => router.push("/dashboard")}
          style={{ alignSelf: "center" }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
