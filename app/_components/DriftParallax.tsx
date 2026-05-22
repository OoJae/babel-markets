"use client";

// Wraps the drifting language fragments and attaches the scroll-driven
// translate3d via useDriftParallax.

import { useRef } from "react";
import { useDriftParallax } from "../_hooks/useDriftParallax";

export function DriftParallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDriftParallax(ref);
  return (
    <div ref={ref} className="drifts" aria-hidden="true">
      {children}
    </div>
  );
}
