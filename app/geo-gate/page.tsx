// Geo-gate page. Shown when the middleware detects a US IP and the user has not
// self-attested as non-US. Polymarket prohibits US-person trading, so we hard-stop.

import Link from "next/link";

export default function GeoGatePage() {
  return (
    <main className="auth-page">
      <header className="auth-head">
        <Link href="/" className="b-mark" style={{ fontSize: 18 }}>
          <span className="glyph">
            <i />
            <u />
          </span>
          BABEL
        </Link>
      </header>
      <section className="auth-main">
        <div className="auth-card geo-card">
          <h1>
            This region is <em>not supported.</em>
          </h1>
          <p>
            Babel Markets posts to Polymarket, which prohibits trading by US persons.
            If you are not a US person, you can self-attest from the compliance banner
            on the landing page. We use a cookie to remember your attestation; we do
            not perform KYC at this time.
          </p>
          <p style={{ opacity: 0.7 }}>
            Babel is testnet-only for the hackathon period. No real user funds are at
            risk.
          </p>
        </div>
      </section>
    </main>
  );
}
