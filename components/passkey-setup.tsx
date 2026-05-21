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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { arcTestnet } from "@/lib/chain/arc";

interface Props {
  username: string;
}

export function PasskeySetup({ username }: Props) {
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

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set up your wallet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Babel uses a Circle Modular Smart Account secured by a passkey. Authenticate
          with Face ID or your fingerprint. No seed phrase. The wallet lives on Arc
          testnet and signs trades with your builder code attached.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={enroll} disabled={creating} className="w-full">
          {creating ? "Setting up passkey..." : "Create wallet with passkey"}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="w-full"
        >
          Skip for now
        </Button>
      </CardContent>
    </Card>
  );
}
