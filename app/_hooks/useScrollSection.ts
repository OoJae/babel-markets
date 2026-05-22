"use client";

// Tracks the active section by nav-midline + light/dark theme + scroll percent.
// Reads [data-theme] attributes from all child sections and returns whichever
// one currently straddles the nav midline (60px). Used by Nav + ScrollProgress
// so the theme swap + dot state stay in sync.

import { useEffect, useState } from "react";

interface SectionState {
  activeIndex: number;
  theme: "light" | "dark";
  scrollPct: number;
}

const NAV_MID = 60;

export function useScrollSection(): SectionState {
  const [state, setState] = useState<SectionState>({
    activeIndex: 0,
    theme: "light",
    scrollPct: 0,
  });

  useEffect(() => {
    function update() {
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>("section[data-theme]"),
      );
      if (sections.length === 0) return;

      let current = sections[0];
      let currentIdx = 0;
      for (let i = 0; i < sections.length; i++) {
        const r = sections[i].getBoundingClientRect();
        if (r.top <= NAV_MID && r.bottom > NAV_MID) {
          current = sections[i];
          currentIdx = i;
          break;
        }
      }
      const theme = (current.dataset.theme as "light" | "dark") || "light";
      const scrollPct =
        window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
      const idxFromScroll = Math.min(
        sections.length - 1,
        Math.floor(scrollPct * sections.length),
      );

      setState((prev) => {
        const next: SectionState = {
          activeIndex: Math.max(currentIdx, idxFromScroll),
          theme,
          scrollPct,
        };
        if (
          prev.activeIndex === next.activeIndex &&
          prev.theme === next.theme &&
          Math.abs(prev.scrollPct - next.scrollPct) < 0.005
        ) {
          return prev;
        }
        return next;
      });
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return state;
}
