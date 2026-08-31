"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, History } from "lucide-react";
import northstarData from "@/data/business-context-northstar.json";

function syncBusinessNameHeadline() {
  const headline = document.querySelector<HTMLElement>(".overview-heading h1");
  if (!headline) return;

  const reconstructedMessage = Array.from(document.querySelectorAll(".chat-bubble.assistant p"))
    .map((node) => node.textContent?.trim() ?? "")
    .find((text) => /^I reconstructed .+ from /i.test(text));
  const reconstructedName = reconstructedMessage?.match(/^I reconstructed (.+?) from /i)?.[1]?.trim();
  const isPersonalWorkspace = Array.from(document.querySelectorAll("[data-slot='badge']"))
    .some((node) => node.textContent?.trim() === "Personal workspace");

  const businessName = reconstructedName || (isPersonalWorkspace ? "My business" : northstarData.business_name);
  if (businessName && headline.textContent?.trim() !== businessName) headline.textContent = businessName;
}

function syncForensicsIntro() {
  const heading = document.querySelector<HTMLElement>(".forensics-heading h1");
  const description = document.querySelector<HTMLElement>(".forensics-heading p");
  const desiredHeading = "Connect, upload, or talk through the current state of your business.";
  const desiredDescription = "The agent reconstructs the graph and asks only what matters next.";

  if (heading && heading.textContent?.trim() !== desiredHeading) {
    heading.textContent = desiredHeading;
  }
  if (description && description.textContent?.trim() !== desiredDescription) {
    description.textContent = desiredDescription;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sectionText(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.innerText?.trim() ?? "";
}

function downloadOverviewReport() {
  const businessName = document.querySelector<HTMLElement>(".overview-heading h1")?.textContent?.trim()
    || northstarData.business_name
    || "Business";
  const generatedAt = new Date().toLocaleString();
  const sections = [
    ["Overview metrics", sectionText(".overview-stat-grid")],
    ["Historical causal timeline", sectionText(".history-card")],
    ["Priority investigations", sectionText(".priority-card")],
    ["Economic engine", sectionText(".engine-overview-card")],
    ["Business Context Gate", sectionText(".readiness-card")],
    ["Framework Router", sectionText(".framework-card")],
  ] as Array<[string, string]>;

  const body = sections
    .filter(([, value]) => value)
    .map(([title, value]) => `<section><h2>${escapeHtml(title)}</h2><div>${escapeHtml(value).replaceAll("\n", "<br>")}</div></section>`)
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(businessName)} · ProofLoop Report</title><style>body{font-family:Inter,Arial,sans-serif;background:#f7f7fb;color:#202536;margin:0;padding:40px}.report{max-width:900px;margin:0 auto;background:#fff;border:1px solid #e8e8ef;border-radius:18px;padding:36px}header{padding-bottom:22px;border-bottom:1px solid #ececf2}header span{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#7568d8}h1{margin:8px 0 4px;font-size:32px}header p{margin:0;color:#73798b}section{padding:22px 0;border-bottom:1px solid #eeeeF4}section:last-child{border-bottom:0}h2{font-size:18px;margin:0 0 12px}section div{line-height:1.65;color:#43495a}@media(max-width:640px){body{padding:14px}.report{padding:22px}}</style></head><body><main class="report"><header><span>ProofLoop standardized analysis report</span><h1>${escapeHtml(businessName)}</h1><p>Generated ${escapeHtml(generatedAt)}</p></header>${body}</main></body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business"}-proofloop-report.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function syncOverviewReportButton() {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".overview-actions button"))
    .find((item) => /add my business|download report/i.test(item.textContent ?? ""));
  if (!button) return;

  if (!button.dataset.proofloopDownloadReport) {
    button.dataset.proofloopDownloadReport = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      downloadOverviewReport();
    }, true);
  }

  if (button.textContent?.trim() !== "Download report") {
    button.replaceChildren(document.createTextNode("Download report"));
  }
  if (button.getAttribute("aria-label") !== "Download ProofLoop analysis report") {
    button.setAttribute("aria-label", "Download ProofLoop analysis report");
  }
}

function contextForBubble(bubble: HTMLElement) {
  const isUser = bubble.classList.contains("user");
  const text = bubble.querySelector("p")?.textContent?.trim() ?? "";
  const meta = bubble.querySelector("em")?.textContent?.trim() ?? "";

  if (isUser) {
    return {
      label: "Analyzed context",
      items: [
        { key: "Signal", value: "Founder-provided input" },
        { key: "Effect", value: "Used to update or challenge the current Business Context Graph" },
      ],
    };
  }

  if (/reconstructed/i.test(text)) {
    return {
      label: "Analyzed context",
      items: [
        { key: "Interpretation", value: "Business identity and model were reconstructed from the currently supplied evidence" },
        { key: "Evidence state", value: meta || "Provisional until supported by source evidence or founder confirmation" },
      ],
    };
  }

  if (/reopened your saved Business Context Graph/i.test(text)) {
    return {
      label: "Analyzed context",
      items: [
        { key: "Source", value: "Previously persisted Business Context Graph" },
        { key: "Effect", value: "Restored prior business memory before new evidence is applied" },
      ],
    };
  }

  if (/applied your claim decisions/i.test(text)) {
    return {
      label: "Analyzed context",
      items: [
        { key: "Action", value: "Founder confirmations/rejections were applied to material inferences" },
        { key: "Effect", value: "Readiness and downstream routing were recomputed" },
      ],
    };
  }

  if (/prepared.+investigation candidate/i.test(text)) {
    return {
      label: "Analyzed context",
      items: [
        { key: "Status", value: "Investigation lead, not a verified cause" },
        { key: "Next step", value: "Evidence gate must test the lead before intervention" },
      ],
    };
  }

  return {
    label: "Analyzed context",
    items: [
      { key: "Role", value: "ProofLoop interpretation" },
      { key: "Basis", value: meta || "Current conversation, workspace evidence, and Business Context Gate" },
    ],
  };
}

function removeBubbleContext() {
  document.querySelectorAll(".bubble-context-analysis").forEach((node) => node.remove());
}

function syncBubbleContext(enabled: boolean) {
  if (!enabled) {
    removeBubbleContext();
    return;
  }

  document.querySelectorAll<HTMLElement>(".chat-bubble").forEach((bubble) => {
    if (bubble.querySelector(":scope > .bubble-context-analysis")) return;

    const context = contextForBubble(bubble);
    const annotation = document.createElement("div");
    annotation.className = "bubble-context-analysis";
    annotation.innerHTML = `
      <div class="bubble-context-label">${context.label}</div>
      <div class="bubble-context-items">
        ${context.items.map((item) => `<div><span>${item.key}</span><p>${item.value}</p></div>`).join("")}
      </div>
    `;
    bubble.appendChild(annotation);
  });
}

export function ClientEnhancements() {
  const [mode, setMode] = useState<"proofloop" | "context">("proofloop");
  const [tabsMount, setTabsMount] = useState<HTMLElement | null>(null);
  const lastTabs = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const attach = () => {
      syncBusinessNameHeadline();
      syncForensicsIntro();
      syncOverviewReportButton();

      const tabs = document.querySelector<HTMLElement>(".assistant-tabs");
      if (!tabs) return;
      tabs.classList.add("has-enhanced-toggle");
      if (tabs !== lastTabs.current) {
        lastTabs.current = tabs;
        setTabsMount(tabs);
      }
      syncBubbleContext(mode === "context");
    };

    attach();
    const observer = new MutationObserver(() => attach());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      removeBubbleContext();
    };
  }, [mode]);

  return (
    <>
      {tabsMount && createPortal(
        <div className="agent-mode-toggle" role="group" aria-label="Agent view">
          <button
            type="button"
            className={mode === "proofloop" ? "active" : ""}
            aria-pressed={mode === "proofloop"}
            onClick={() => setMode("proofloop")}
          >
            <Bot /> ProofLoop
          </button>
          <button
            type="button"
            className={mode === "context" ? "active" : ""}
            aria-pressed={mode === "context"}
            onClick={() => setMode("context")}
          >
            <History /> Context
          </button>
        </div>,
        tabsMount,
      )}
    </>
  );
}
