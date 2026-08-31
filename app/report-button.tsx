"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

function findOriginalReportButton() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".overview-actions button"))
    .find((button) => !button.classList.contains("proofloop-download-report") && /add my business|download report/i.test(button.textContent ?? ""));
}

export function ReportButton() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [original, setOriginal] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    const sync = () => {
      const actions = document.querySelector<HTMLElement>(".overview-actions");
      const sourceButton = findOriginalReportButton();

      if (actions !== mount) setMount(actions);
      if (sourceButton !== original) setOriginal(sourceButton ?? null);

      if (sourceButton) {
        sourceButton.classList.add("proofloop-original-report-action");
        sourceButton.setAttribute("aria-hidden", "true");
        sourceButton.tabIndex = -1;
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [mount, original]);

  if (!mount) return null;

  return createPortal(
    <Button
      type="button"
      className="proofloop-download-report"
      onClick={() => {
        const sourceButton = original ?? findOriginalReportButton();
        sourceButton?.click();
      }}
    >
      <Download /> Download report
    </Button>,
    mount,
  );
}
