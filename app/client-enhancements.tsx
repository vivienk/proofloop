"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, GitBranch, History, Sparkles } from "lucide-react";

type TraceItem = {
  title: string;
  detail: string;
};

function collectTrace(): { messages: string[]; question: string } {
  if (typeof document === "undefined") return { messages: [], question: "" };
  const messages = Array.from(document.querySelectorAll(".chat-bubble.assistant p"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);
  const question = document.querySelector(".next-question strong")?.textContent?.trim() ?? "";
  return { messages, question };
}

export function ClientEnhancements() {
  const [mode, setMode] = useState<"proofloop" | "context">("proofloop");
  const [tabsMount, setTabsMount] = useState<HTMLElement | null>(null);
  const [traceMount, setTraceMount] = useState<HTMLElement | null>(null);
  const [traceRevision, setTraceRevision] = useState(0);
  const lastTabs = useRef<HTMLElement | null>(null);
  const lastTraceMount = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const attach = () => {
      const tabs = document.querySelector<HTMLElement>(".assistant-tabs");
      const content = document.querySelector<HTMLElement>(".assistant-content");
      if (!tabs || !content) return;

      tabs.classList.add("has-enhanced-toggle");
      if (tabs !== lastTabs.current) {
        lastTabs.current = tabs;
        setTabsMount(tabs);
      }

      let mount = content.querySelector<HTMLElement>(".agent-trace-mount");
      if (!mount) {
        mount = document.createElement("div");
        mount.className = "agent-trace-mount";
        tabs.insertAdjacentElement("afterend", mount);
      }
      if (mount !== lastTraceMount.current) {
        lastTraceMount.current = mount;
        setTraceMount(mount);
        setTraceRevision((value) => value + 1);
      }
    };

    attach();
    const observer = new MutationObserver(() => attach());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mode !== "context") return;
    const stream = document.querySelector(".chat-stream");
    if (!stream) return;
    const observer = new MutationObserver(() => setTraceRevision((value) => value + 1));
    observer.observe(stream, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [mode]);

  const trace = useMemo(() => {
    void traceRevision;
    return collectTrace();
  }, [traceRevision, mode]);

  const items: TraceItem[] = useMemo(() => {
    const latest = trace.messages.at(-1);
    const result: TraceItem[] = [];
    if (latest) result.push({ title: "What the agent concluded", detail: latest });
    result.push({
      title: "What it used",
      detail: "Workspace evidence, confirmed founder context, source provenance, readiness gates, and the current conversation. Claims remain provisional unless supported by evidence or founder confirmation.",
    });
    if (trace.question) {
      result.push({
        title: "Why this question is next",
        detail: `ProofLoop selected “${trace.question}” because it is the highest-information unresolved input for the current Business Context Gate.`,
      });
    }
    result.push({
      title: "Architecture path",
      detail: "Diagnoses use the ADK sequential workflow: validate signal → map systems → build competing hypotheses → falsify → define root problem → plan a bounded intervention.",
    });
    return result;
  }, [trace]);

  return (
    <>
      {tabsMount && createPortal(
        <div className="agent-mode-toggle" role="group" aria-label="Agent view">
          <button type="button" className={mode === "proofloop" ? "active" : ""} aria-pressed={mode === "proofloop"} onClick={() => setMode("proofloop")}>
            <Bot /> ProofLoop
          </button>
          <button type="button" className={mode === "context" ? "active" : ""} aria-pressed={mode === "context"} onClick={() => { setMode("context"); setTraceRevision((value) => value + 1); }}>
            <History /> Context
          </button>
        </div>,
        tabsMount,
      )}

      {traceMount && mode === "context" && createPortal(
        <section className="agent-decision-trace" aria-label="Agent decision trace">
          <div className="agent-decision-trace-heading">
            <span><GitBranch /> Decision trace</span>
            <em>Inspectable rationale, not hidden chain-of-thought</em>
          </div>
          <div className="agent-decision-trace-list">
            {items.map((item) => (
              <article key={item.title}>
                <span><Sparkles /></span>
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
              </article>
            ))}
          </div>
        </section>,
        traceMount,
      )}
    </>
  );
}
