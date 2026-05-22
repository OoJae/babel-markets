"use client";

// Mounts the scroll-reveal IntersectionObserver once for everything inside.
// Wrap the page in <Observer>...</Observer> and any descendant with
// data-reveal / data-reveal-x will animate in when it enters the viewport.

import { useRef } from "react";
import { useScrollReveal } from "../_hooks/useScrollReveal";

export function Observer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollReveal(ref);
  return <div ref={ref}>{children}</div>;
}
