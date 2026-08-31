"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BrainCircuit, CheckCircle2, DollarSign, Route, Sparkles, Target } from "lucide-react";

type Fact = { label: string; value: string; evidence: string };
type Lens = { name: string; state: "selected" | "rejected" | "supporting"; finding: string; evidence: string };

function text(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? "";
}

function texts(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).map((node) => node.textContent?.trim() ?? "").filter(Boolean);
}

function readFact(label: string, fallback: string, evidence: string): Fact {
  return { label, value: fallback || "Not established yet", evidence };
}

function collectDefineData() {
  const signal = text(".structured-metrics article:nth-child(1) strong") || text(".topbar h1");
  const affected = text(".structured-metrics article:nth-child(2) strong") || text(".root-meta > div:nth-child(1) strong");
  const impact = text(".structured-metrics article:nth-child(3) strong") || text(".root-meta > div:nth-child(2) strong");
  const actual = text(".model-contract .contract-fields > div:nth-child(2) strong") || text(".root-meta > div:nth-child(3) strong");
  const expected = text(".model-contract .contract-fields > div:nth-child(1) strong");
  const process = text(".causal-chain .cause-node:nth-of-type(1) strong");
  const timeframe = text(".graph-gate.problem p") || "Current diagnostic window";
  const root = text(".root-statement > p");
  const metricSummary = text(".graph-gate.problem p");

  const facts: Fact[] = [
    readFact("What", signal, "Problem-definition gate"),
    readFact("Who", affected, "Affected population / segment evidence"),
    readFact("When", timeframe, "Baseline and change-window evidence"),
    readFact("Where", process, "Process / journey mapping"),
    readFact("Why it matters", impact, "Economic and business impact evidence"),
    readFact("How", actual, "Observed execution / behavior evidence"),
  ];

  const unitCards = Array.from(document.querySelectorAll<HTMLElement>(".graph-unit"));
  const lenses: Lens[] = unitCards.map((card) => {
    const name = card.querySelector<HTMLElement>("div > span")?.textContent?.trim() || "System";
    const verdict = card.querySelector<HTMLElement>("footer span")?.textContent?.trim().toLowerCase() || "";
    const finding = card.querySelector<HTMLElement>("p")?.textContent?.trim() || "No finding yet";
    const evidence = card.querySelector<HTMLElement>("footer span:last-child")?.textContent?.trim() || "Evidence pending";
    const state: Lens["state"] = verdict.includes("reject") ? "rejected" : verdict.includes("support") ? "selected" : "supporting";
    return { name, state, finding, evidence };
  });

  const selected = lenses.filter((lens) => lens.state === "selected").map((lens) => lens.name.toLowerCase());
  const frameworks: Array<{ name: string; why: string }> = [];
  if (selected.some((name) => ["product", "growth", "customer"].includes(name))) {
    frameworks.push({ name: "AARRR / Funnel analysis", why: "Locate where value progression breaks across acquisition, activation, conversion, or retention." });
  }
  if (selected.some((name) => ["operations", "product", "capacity"].includes(name))) {
    frameworks.push({ name: "DMAIC / Standard-gap analysis", why: "Compare expected process standards with actual execution and isolate the control gap." });
  }
  if (selected.length) {
    frameworks.push({ name: "5 Whys / causal drill-down", why: "Trace supported mechanisms from the observed failure toward a systemic cause without jumping to a solution." });
  }
  if (!frameworks.length) {
    frameworks.push({ name: "Evidence collection only", why: "No assessment lens has enough evidence to justify a specialist framework yet." });
  }

  return { facts, lenses, frameworks, expected, actual, impact, metricSummary, root };
}

export function DefineAssessmentEnhancements() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const sync = () => {
      const panel = document.querySelector<HTMLElement>(".stage-panel.root-panel");
      if (panel !== mount) setMount(panel);
      setVersion((value) => value + 1);
    };
    sync();
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(sync);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [mount]);

  const data = useMemo(() => collectDefineData(), [version]);
  if (!mount) return null;

  return createPortal(
    <section className="define-assessment-shell" aria-label="Evidence-selected problem definition">
      <div className="define-assessment-heading">
        <div>
          <span><Sparkles /> Gemini live assessment</span>
          <h3>Evidence selects the lens</h3>
          <p>ProofLoop separates facts, assessment, and economic consequence before routing specialist agents and frameworks.</p>
        </div>
        <em><BrainCircuit /> Assessment System</em>
      </div>

      <div className="define-assessment-grid">
        <article className="define-assessment-card facts-card">
          <header><span>01</span><div><strong>5W1H facts</strong><p>Observed facts only — no root-cause assumptions.</p></div></header>
          <div className="facts-table">
            {data.facts.map((fact) => (
              <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong><em>{fact.evidence}</em></div>
            ))}
          </div>
        </article>

        <article className="define-assessment-card lens-card">
          <header><span>02</span><div><strong>Assessment lens</strong><p>Business systems are selected or rejected by evidence.</p></div></header>
          <div className="lens-list">
            {data.lenses.length ? data.lenses.map((lens) => (
              <div key={lens.name} className={`lens-row ${lens.state}`}>
                <span>{lens.state === "selected" ? <CheckCircle2 /> : <Target />}</span>
                <div><strong>{lens.name}</strong><p>{lens.finding}</p></div>
                <em>{lens.state}</em>
              </div>
            )) : <p className="define-empty">Run the AI diagnosis to populate evidence-selected lenses.</p>}
          </div>
        </article>

        <article className="define-assessment-card economic-card">
          <header><span>03</span><div><strong>Economic impact</strong><p>Translate the problem into measurable business consequence.</p></div></header>
          <div className="economic-fields">
            <div><span>Expected state</span><strong>{data.expected || "Baseline not established"}</strong></div>
            <div><span>Observed state</span><strong>{data.actual || "Observed state pending"}</strong></div>
            <div><span>Business impact</span><strong>{data.impact || "Impact estimate pending"}</strong></div>
            <div><span>Metric / delta</span><strong>{data.metricSummary || "Metric gate pending"}</strong></div>
          </div>
        </article>
      </div>

      <article className="framework-router-card">
        <div className="router-title"><Route /><div><span>Assessment System → Framework Router</span><strong>Route only the agents and methods justified by evidence.</strong></div></div>
        <div className="framework-route-list">
          {data.frameworks.map((framework) => (
            <div key={framework.name}><span><DollarSign /></span><div><strong>{framework.name}</strong><p>{framework.why}</p></div></div>
          ))}
        </div>
        <footer><span>Current problem definition</span><strong>{data.root || "Gemini will form the testable problem statement after the evidence gate."}</strong></footer>
      </article>
    </section>,
    mount,
  );
}
