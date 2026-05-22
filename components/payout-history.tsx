// Server component: merged history of credits + claims for the signed-in
// creator. Renders a scrollable table with kind chip, question, amount, time,
// and ArcScan link.

import { Badge } from "@/components/ui/badge";

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
      <p className="text-sm text-muted-foreground">
        No payouts or credits yet. Earn a builder fee on a Polymarket fill or
        claim accrued USDC to populate this table.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Kind</th>
            <th className="px-3 py-2 text-left">Detail</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-left">When</th>
            <th className="px-3 py-2 text-left">Tx</th>
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
              <tr key={`${row.kind}-${row.id}`} className="border-t">
                <td className="px-3 py-2">
                  <Badge variant={row.kind === "claim" ? "success" : "outline"}>
                    {row.kind === "claim" ? "Claim" : "Credit"}
                  </Badge>
                </td>
                <td className="px-3 py-2">{detail}</td>
                <td className="px-3 py-2 text-right font-mono">${amount}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(ts).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  {tx ? (
                    <a
                      href={arcscan(tx) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline"
                    >
                      {tx.slice(0, 10)}...
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">pending</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
