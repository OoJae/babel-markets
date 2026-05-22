"use client";

// Walks descendant .drift elements inside the given container and applies a
// scroll-driven translate3d based on each element's data-speed.

import { useEffect, type RefObject } from "react";

export function useDriftParallax(scopeRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scopeRef.current;
    if (!root) return;
    const drifts = Array.from(root.querySelectorAll<HTMLElement>(".drift"));
    if (drifts.length === 0) return;

    function apply() {
      const y = window.scrollY;
      for (const d of drifts) {
        const s = parseFloat(d.dataset.speed || "0") || 0;
        d.style.transform = `translate3d(${y * s}px, ${y * s * 0.3}px, 0)`;
      }
    }
    apply();
    window.addEventListener("scroll", apply, { passive: true });
    return () => window.removeEventListener("scroll", apply);
  }, [scopeRef]);
}
