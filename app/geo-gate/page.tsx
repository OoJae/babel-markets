// Geo-gate page. Shown when the middleware detects a US IP and the user has not
// self-attested as non-US. Polymarket prohibits US-person trading, so we hard-stop.

export default function GeoGatePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-bold">This region is not supported</h1>
        <p className="text-muted-foreground">
          Babel Markets posts to Polymarket, which prohibits trading by US persons.
          If you are not a US person, you can self-attest from the compliance banner
          on the landing page. We use a cookie to remember your attestation; we do
          not perform KYC at this time.
        </p>
        <p className="text-sm text-muted-foreground">
          Babel is also testnet-only for the hackathon period. No real user funds
          are at risk.
        </p>
      </div>
    </main>
  );
}
