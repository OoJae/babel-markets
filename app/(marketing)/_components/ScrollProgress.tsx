"use client";

// Bottom-right scroll progress dots + section label. Reads activeIndex from
// useScrollSection so it stays in lockstep with Nav's theme swap.

import { useScrollSection } from "../_hooks/useScrollSection";

const SECTION_LABELS = [
  "AGORA",
  "PREAMBLE",
  "AGENT",
  "TOWER",
  "STACK",
  "EARNINGS",
  "MANIFESTO",
  "CTA",
];

export function ScrollProgress() {
  const { activeIndex, theme } = useScrollSection();
  const idx = Math.max(0, Math.min(SECTION_LABELS.length - 1, activeIndex));
  const n = String(idx + 1).padStart(2, "0");
  const label = SECTION_LABELS[idx] ?? "";

  return (
    <div className={`scroll-progress${theme === "dark" ? " dark" : ""}`}>
      <div className="sp-label">
        {n} . {label}
      </div>
      <div className="sp-bar">
        {SECTION_LABELS.map((_, i) => (
          <i key={i} className={i <= idx ? "active" : ""} />
        ))}
      </div>
    </div>
  );
}
