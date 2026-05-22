// Server component: the creator's recent synthesized questions with a link
// into the market view + accrued so far.

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface RecentQuestion {
  id: string;
  question_text: string;
  status: string;
  source_lang: string | null;
  currency: string;
  category: string;
  created_at: string;
  accrued_usdc: number;
}

export function RecentQuestions({ rows }: { rows: RecentQuestion[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Paste your first article on the home page and the question lands here
        with a deep link to the market view.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {rows.map((q) => (
        <li
          key={q.id}
          className="rounded-md border bg-card p-3 transition hover:bg-muted/30"
        >
          <Link href={`/market/${q.id}`} className="block space-y-1">
            <p className="text-sm font-medium leading-snug">
              {q.question_text}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant={q.status === "ready" ? "success" : "warning"}
                className="text-[10px]"
              >
                {q.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {q.category}
              </Badge>
              {q.source_lang && (
                <Badge variant="outline" className="text-[10px]">
                  {q.source_lang}
                </Badge>
              )}
              <span className="font-mono">${q.accrued_usdc.toFixed(4)}</span>
              <span>{new Date(q.created_at).toLocaleDateString()}</span>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
