"use client";

// IntersectionObserver-backed scroll reveals. Toggles .visible on every
// [data-reveal] / [data-reveal-x] element inside the given scope so the CSS
// transitions in brand.css fire as elements enter the viewport.

import { useEffect, type RefObject } from "react";

export function useScrollReveal(scopeRef?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scopeRef?.current ?? document.body;
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-x]"),
    );
    if (targets.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    for (const t of targets) obs.observe(t);
    return () => obs.disconnect();
  }, [scopeRef]);
}
