"use client";

import { useEffect } from "react";

export function HistoryTimelineBridge() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const action = target?.closest<HTMLButtonElement>(".history-card .event-detail button, .history-card .timeline-table tbody button");
      if (!action) return;

      window.setTimeout(() => {
        const investigationsButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".product-left-rail nav button"))
          .find((button) => button.textContent?.includes("Investigations"));
        investigationsButton?.click();
      }, 0);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
