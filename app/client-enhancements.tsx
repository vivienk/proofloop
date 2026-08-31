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

function textFrom(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.innerText?.trim() ?? "";
}

function activeBusinessName() {
  const activeRail = document.querySelector<HTMLElement>(".rail-workspace-card.is-active-business > strong")?.textContent?.trim();
  const overview = document.querySelector<HTMLElement>(".overview-heading h1")?.textContent?.trim();
  return activeRail || (overview && overview !== "Your business, reconstructed." ? overview : "") || "Business workspace";
}

function reportSection(title: string, content: string) {
  if (!content.trim()) return "";
  return `<section><h2>${escapeHtml(title)}</h2><div class="report-copy">${escapeHtml(content).replaceAll("\n", "<br>")}</div></section>`;
}

type ReportConflict = {
  topic: string;
  preferred_claim: string;
  alternative_claim: string;
  selection_reason: string;
};

function buildNorthstarStructuredReport() {
  const context = northstarData;
  const conflicts = context.conflicts as ReportConflict[];
  const rows = (items: Array<[string, string]>) => items.map(([label, value]) => `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

  return `
    <section><h2>Business profile</h2>${rows([
      ["Business name", context.business_name],
      ["Value proposition", context.value_proposition],
      ["Primary customer", context.primary_customer],
      ["Current objective", context.current_objective],
      ["Primary model", context.classification.primary_model],
      ["Stage", context.classification.stage],
      ["Revenue models", context.classification.revenue_models.join(" · ")],
    ])}</section>
    <section><h2>Readiness</h2>${rows([
      ["Status", context.readiness.status],
      ["Score", `${context.readiness.score}%`],
      ["Ready scopes", context.readiness.ready_scopes.join(" · ")],
      ["Blocked scopes", context.readiness.blocked_scopes.join(" · ")],
      ["Next best question", context.readiness.next_best_question],
      ["Reason", context.readiness.reason],
    ])}</section>
    <section><h2>Economic engine</h2>${context.economic_engine.map((stage) => `<article><strong>${stage.order}. ${escapeHtml(stage.name)}</strong><p>${escapeHtml(stage.description)}</p><small>${escapeHtml(stage.metric_ids.join(" · ") || "No metric mapped")}</small></article>`).join("")}</section>
    <section><h2>Operating system</h2>${context.operating_system.map((area) => `<article><strong>${escapeHtml(area.area)}</strong><p>${escapeHtml(area.process_summary)}</p><small>Systems: ${escapeHtml(area.systems.join(" · ") || "None recorded")}<br>Dependencies: ${escapeHtml(area.dependencies.join(" · ") || "None recorded")}</small></article>`).join("")}</section>
    <section><h2>Evidence sources</h2>${context.evidence_sources.map((source) => `<article><strong>${escapeHtml(source.name)}</strong><p>${escapeHtml(source.domain)} · ${escapeHtml(source.source_type)} · ${escapeHtml(source.status)}</p><small>${escapeHtml(source.provenance)} · ${escapeHtml(source.coverage)} · ${escapeHtml(source.freshness)}</small></article>`).join("")}</section>
    <section><h2>Claims</h2>${context.claims.map((claim) => `<article><strong>${escapeHtml(claim.claim)}</strong><p>${escapeHtml(claim.domain)} · ${escapeHtml(claim.reliability)} reliability · ${escapeHtml(claim.confirmation_status)}</p><small>${escapeHtml(claim.source_locator)} · Sources: ${escapeHtml(claim.source_ids.join(", "))}</small></article>`).join("")}</section>
    <section><h2>Metrics and baselines</h2>${context.metrics.map((metric) => `<article><strong>${escapeHtml(metric.label)}: ${metric.current_value} ${escapeHtml(metric.unit)}</strong><p>Baseline ${escapeHtml(metric.baseline_level)} · ${escapeHtml(metric.standard_type)} · ${escapeHtml(metric.standard_basis)}</p><small>Trend: ${escapeHtml(metric.trend)} · Volatility: ${escapeHtml(metric.volatility)} · Seasonality: ${escapeHtml(metric.seasonality)} · Sources: ${escapeHtml(metric.source_ids.join(", "))}</small></article>`).join("")}</section>
    <section><h2>Historical timeline</h2>${context.timeline_events.map((event) => `<article><strong>${escapeHtml(event.date)} · ${escapeHtml(event.title)}</strong><p>${escapeHtml(event.description)}</p><small>${escapeHtml(event.before_after)} · Leads: ${escapeHtml(event.ranked_investigation_leads.join(" · "))}</small></article>`).join("")}</section>
    <section><h2>Selected frameworks</h2>${context.selected_frameworks.map((framework) => `<article><strong>${escapeHtml(framework.framework)}</strong><p>${escapeHtml(framework.purpose)}</p><small>Triggered by: ${escapeHtml(framework.trigger_evidence_ids.join(" · "))}<br>Excluded alternatives: ${escapeHtml(framework.excluded_alternatives.join(" · ") || "None")}</small></article>`).join("")}</section>
    <section><h2>Conflicts and limitations</h2>${conflicts.map((conflict) => `<article><strong>${escapeHtml(conflict.topic)}</strong><p>${escapeHtml(conflict.preferred_claim)} ↔ ${escapeHtml(conflict.alternative_claim)}</p><small>${escapeHtml(conflict.selection_reason)}</small></article>`).join("")}${context.limitations.map((limitation) => `<p>• ${escapeHtml(limitation)}</p>`).join("")}</section>
    <section><h2>Raw Business Context Graph</h2><pre>${escapeHtml(JSON.stringify(context, null, 2))}</pre></section>
  `;
}

function downloadStandardizedReport() {
  const businessName = activeBusinessName();
  const isNorthstar = businessName.toLowerCase() === String(northstarData.business_name).toLowerCase();
  const generatedAt = new Date().toISOString();
  const transcript = Array.from(document.querySelectorAll<HTMLElement>(".chat-bubble"))
    .map((bubble) => `${bubble.classList.contains("user") ? "Founder" : "ProofLoop"}: ${bubble.querySelector("p")?.textContent?.trim() ?? ""}`)
    .filter((line) => !line.endsWith(": "))
    .join("\n\n");

  const visibleSnapshot = [
    reportSection("Overview and key metrics", textFrom(".overview-stat-grid")),
    reportSection("Historical causal timeline", textFrom(".history-card")),
    reportSection("Priority investigations", textFrom(".priority-card")),
    reportSection("Economic engine", textFrom(".engine-overview-card")),
    reportSection("Business Context Gate", textFrom(".readiness-card")),
    reportSection("Framework Router", textFrom(".framework-card")),
    reportSection("Business Forensics", textFrom(".forensics-stage")),
    reportSection("Conversation record", transcript),
  ].join("");

  const body = isNorthstar ? buildNorthstarStructuredReport() : visibleSnapshot;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(businessName)} · ProofLoop Analysis Report</title><style>
    :root{font-family:Inter,Arial,sans-serif;color:#202536;background:#f7f7fb}body{margin:0;padding:48px;background:#f7f7fb}.report{max-width:920px;margin:0 auto;background:#fff;border:1px solid #e8e8ef;border-radius:20px;padding:44px;box-shadow:0 18px 50px rgba(44,48,70,.08)}header{border-bottom:1px solid #ececf2;padding-bottom:24px;margin-bottom:26px}header span{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7568d8;font-weight:800}h1{font-size:34px;margin:8px 0 6px}header p{margin:0;color:#6f7689}section{padding:22px 0;border-bottom:1px solid #eeeeF4}section:last-child{border-bottom:0}h2{font-size:18px;margin:0 0 14px}article{padding:12px 0}article p{margin:5px 0;color:#42485a;line-height:1.55}small{color:#777e91;line-height:1.5}.row{display:grid;grid-template-columns:190px 1fr;gap:18px;padding:9px 0;border-bottom:1px solid #f1f1f5}.row span{color:#777e91}.report-copy{line-height:1.65;color:#41475a}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f7fb;padding:18px;border-radius:12px;font-size:11px;line-height:1.5}@media(max-width:640px){body{padding:16px}.report{padding:24px}.row{grid-template-columns:1fr;gap:3px}}</style></head><body><main class="report"><header><span>ProofLoop standardized analysis report</span><h1>${escapeHtml(businessName)}</h1><p>Generated ${escapeHtml(generatedAt)} · Evidence-linked Business Context snapshot</p></header>${body || reportSection("Workspace snapshot", "No analyzed workspace content was available in the current view.")}</main></body></html>`;

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

function syncReportButton() {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".overview-actions button"))
    .find((item) => /add my business|download report/i.test(item.textContent ?? ""));
  if (!button) return;

  if (!button.dataset.proofloopReport) {
    button.dataset.proofloopReport = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      downloadStandardizedReport();
    }, true);
  }

  if (button.textContent?.trim() !== "Download report") {
    button.replaceChildren(document.createTextNode("Download report"));
    button.setAttribute("aria-label", "Download standardized ProofLoop analysis report");
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
      syncReportButton();

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
