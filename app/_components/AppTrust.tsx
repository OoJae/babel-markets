// Trust signals strip on the /app page. Server-component: reads agent EOA +
// escrow address from env via the existing helpers so judges can verify the
// addresses on ArcScan. Lifted from the old (internal)/app/page.tsx but
// rewritten in brand markup.

import { getAgentAddress } from "@/lib/circle/nanopay";
import { getPublicEscrowAddress } from "@/lib/chain/escrow";

function shortAddress(addr?: string | null): string | null {
  if (!addr) return null;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function AppTrust() {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7) ??
    "local";
  const agentAddress = getAgentAddress();
  const escrowAddress = getPublicEscrowAddress();
  const nanopaymentsEnabled = process.env.BABEL_NANOPAYMENTS_ENABLED === "1";
  const cctpEnabled = process.env.BABEL_CCTP_ENABLED === "1";

  return (
    <section className="app-trust">
      <div className="app-trust-grid">
        <div>
          <div className="k">Build</div>
          <div className="v">{commit}</div>
        </div>
        <div>
          <div className="k">Nanopayments</div>
          <div className={`v ${nanopaymentsEnabled ? "on" : "off"}`}>
            {nanopaymentsEnabled ? "live" : "off"}
          </div>
        </div>
        <div>
          <div className="k">CCTP</div>
          <div className={`v ${cctpEnabled ? "on" : "off"}`}>
            {cctpEnabled ? "live" : "mock"}
          </div>
        </div>
        <div>
          <div className="k">Agent EOA</div>
          <div className="v">
            {agentAddress ? (
              <a
                href={`https://testnet.arcscan.app/address/${agentAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(agentAddress)}
              </a>
            ) : (
              <span className="off">unconfigured</span>
            )}
          </div>
        </div>
        <div>
          <div className="k">AttributionEscrow</div>
          <div className="v">
            {escrowAddress ? (
              <a
                href={`https://testnet.arcscan.app/address/${escrowAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(escrowAddress)}
              </a>
            ) : (
              <span className="off">not deployed</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
