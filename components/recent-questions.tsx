// Server component: the creator's recent synthesized questions with a link
// into the market view + accrued so far. Brand markup.

import Link from "next/link";

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
      <p
        style={{
          fontFamily: "var(--f-mono)",
          fontSize: 12,
          lineHeight: 1.7,
          opacity: 0.7,
        }}
      >
        Paste your first article on the home page and the question lands here
        with a deep link to the market view.
      </p>
    );
  }

  return (
    <div className="recent-list">
      {rows.map((q) => (
        <Link key={q.id} href={`/market/${q.id}`} className="recent-card">
          <span className="q">{q.question_text}</span>
          <span className="meta">
            <span className={`brand-chip ${q.status === "ready" ? "ready" : "warn"}`}>
              {q.status}
            </span>
            <span className="brand-chip">{q.category}</span>
            {q.source_lang && <span className="brand-chip">{q.source_lang}</span>}
            <span className="amt">${q.accrued_usdc.toFixed(4)}</span>
            <span>{new Date(q.created_at).toLocaleDateString()}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
