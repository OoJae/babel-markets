// Server component: merged history of credits + claims for the signed-in
// creator. Brand markup; same data shape as Phase 6.

export interface CreditRow {
  kind: "credit";
  id: string;
  question_text: string | null;
  amount_usdc: number;
  arc_tx: string;
  created_at: string;
}

export interface PayoutRow {
  kind: "claim";
  id: string;
  amount_usdc: number;
  arc_tx: string | null;
  currency: string;
  status: string;
  created_at: string;
  settled_at: string | null;
}

export type HistoryRow = CreditRow | PayoutRow;

function arcscan(hash: string | null): string | null {
  return hash ? `https://testnet.arcscan.app/tx/${hash}` : null;
}

export function PayoutHistory({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <p
        style={{
          fontFamily: "var(--f-mono)",
          fontSize: 12,
          lineHeight: 1.7,
          opacity: 0.7,
        }}
      >
        No payouts or credits yet. Earn a builder fee on a Polymarket fill or
        claim accrued USDC to populate this table.
      </p>
    );
  }

  return (
    <table className="brand-table">
      <thead>
        <tr>
          <th>Kind</th>
          <th>Detail</th>
          <th className="right">Amount</th>
          <th>When</th>
          <th>Tx</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const ts = row.kind === "claim" ? row.settled_at ?? row.created_at : row.created_at;
          const tx = row.kind === "claim" ? row.arc_tx : row.arc_tx;
          const detail =
            row.kind === "credit"
              ? row.question_text ?? "Builder-fee credit"
              : `Claim (${row.status})`;
          const amount = Number(row.amount_usdc).toFixed(4);
          return (
            <tr key={`${row.kind}-${row.id}`}>
              <td>
                <span className={`brand-chip ${row.kind === "claim" ? "ready" : ""}`}>
                  {row.kind === "claim" ? "Claim" : "Credit"}
                </span>
              </td>
              <td>{detail}</td>
              <td className="right">${amount}</td>
              <td style={{ opacity: 0.7 }}>{new Date(ts).toLocaleString()}</td>
              <td>
                {tx ? (
                  <a href={arcscan(tx) ?? "#"} target="_blank" rel="noreferrer">
                    {tx.slice(0, 10)}...
                  </a>
                ) : (
                  <span style={{ opacity: 0.55 }}>pending</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
