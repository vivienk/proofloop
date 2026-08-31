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
