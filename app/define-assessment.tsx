"use client";

import { CheckCircle2, GitBranch, ShieldCheck, Sparkles, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type InvestigationUnit = {
  id: string;
  domain: "product" | "customer" | "growth" | "operations" | "finance" | "capacity" | "partner" | "external";
  hypothesis: string;
  finding: string;
  verdict: "supported" | "rejected" | "inconclusive";
  evidence_ids: string[];
  contradicting_evidence_ids: string[];
  blocking_missing_evidence: string[];
  attempts: number;
  status: "red" | "green";
  correction_request: string;
};

type RootProblem = {
  signal: string;
  expected_state: string;
  actual_state: string;
  affected_segment: string;
  business_impact: string;
  problem_statement: string;
  proximate_cause: string;
  systemic_cause: string;
  process_gap: {
    process: string;
    failing_step: string;
    expected_standard: string;
    actual_execution: string;
    gap: string;
    standard_evidence_id: string;
  };
};

type ProblemGate = {
  metric: string;
  expected_value: number;
  observed_value: number;
  delta: number;
  timeframe: string;
  affected_population: string;
  source_evidence_ids: string[];
  anomaly_reproducible: boolean;
  status: "red" | "green";
  failed_checks: string[];
};

type Props = {
  problemGate?: ProblemGate;
  rootProblem?: RootProblem;
  graphUnits: InvestigationUnit[];
};

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceLabel(ids: string[]) {
  return ids.length ? `${ids.length} evidence ${ids.length === 1 ? "record" : "records"}` : "Evidence pending";
}

export function DefineAssessment({ problemGate, rootProblem, graphUnits }: Props) {
  const facts = [
    {
      label: "What",
      value: rootProblem?.signal ?? "Purchase conversion declined after qualified traffic increased.",
      evidence: problemGate?.source_evidence_ids.length ? evidenceLabel(problemGate.source_evidence_ids) : "Signal validation",
    },
    {
      label: "Who",
      value: rootProblem?.affected_segment ?? problemGate?.affected_population ?? "Mobile Safari checkout sessions",
      evidence: "Affected population",
    },
    {
      label: "When",
      value: problemGate?.timeframe ?? "Immediately after the pricing release",
      evidence: "Change-window evidence",
    },
    {
      label: "Where",
      value: rootProblem?.process_gap ? `${rootProblem.process_gap.process} · ${rootProblem.process_gap.failing_step}` : "Pricing → payment progression",
      evidence: "Journey / process evidence",
    },
    {
      label: "Why it matters",
      value: rootProblem?.business_impact ?? "$4.8k monthly revenue at risk",
      evidence: "Economic assessment",
    },
    {
      label: "How",
      value: rootProblem?.process_gap?.actual_execution ?? rootProblem?.actual_state ?? "The affected segment fails to progress at the changed interaction.",
      evidence: "Observed execution",
    },
  ];

  const lenses = graphUnits.map((unit) => ({
    domain: unit.domain,
    state: unit.verdict === "supported" ? "selected" : unit.verdict === "rejected" ? "rejected" : "supporting",
    finding: unit.status === "red" ? unit.correction_request : unit.finding,
    evidenceCount: unit.evidence_ids.length + unit.contradicting_evidence_ids.length,
  }));

  const selectedDomains = new Set(lenses.filter((lens) => lens.state === "selected").map((lens) => lens.domain));
  const frameworks: Array<{ name: string; agents: string; why: string }> = [];

  if (["product", "growth", "customer"].some((domain) => selectedDomains.has(domain as InvestigationUnit["domain"]))) {
    frameworks.push({
      name: "AARRR / Funnel analysis",
      agents: "Product · Growth · Customer",
      why: "Locate the measurable value-progression break before changing acquisition or pricing strategy.",
    });
  }
  if (["operations", "product", "capacity"].some((domain) => selectedDomains.has(domain as InvestigationUnit["domain"]))) {
    frameworks.push({
      name: "DMAIC / Standard-gap analysis",
      agents: "Operations · Product",
      why: "Compare the required operating standard with actual execution and isolate the control gap.",
    });
  }
  if (selectedDomains.size > 0) {
    frameworks.push({
      name: "5 Whys / causal drill-down",
      agents: Array.from(selectedDomains).map(humanize).join(" · "),
      why: "Trace evidence-supported mechanisms toward a systemic cause without treating correlation as proof.",
    });
  }

  if (!frameworks.length) {
    frameworks.push({
      name: "Evidence collection",
      agents: "No specialist agent routed yet",
      why: "The current evidence does not justify a specialist framework. Gather discriminating evidence first.",
    });
  }

  const economicDelta = problemGate
    ? `${problemGate.metric}: ${problemGate.expected_value} → ${problemGate.observed_value} (${problemGate.delta > 0 ? "+" : ""}${problemGate.delta})`
    : "Purchase conversion: expected baseline → observed decline";

  return (
    <section className="define-assessment" aria-label="Evidence-selected problem definition">
      <style>{`
        .define-assessment{margin:0 0 24px;padding:20px;border:1px solid rgba(122,110,180,.18);border-radius:18px;background:linear-gradient(145deg,rgba(128,110,205,.07),rgba(255,255,255,.02));display:grid;gap:16px}
        .define-assessment__intro{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.define-assessment__intro>div>span{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8170d7}.define-assessment__intro svg{width:15px;height:15px}.define-assessment__intro h3{margin:5px 0 4px;font-size:20px}.define-assessment__intro p{margin:0;max-width:760px;color:var(--muted-foreground);font-size:13px;line-height:1.55}.define-assessment__principle{flex:none;border:1px solid rgba(99,192,191,.3);background:rgba(99,192,191,.1);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;color:inherit}
        .define-assessment__grid{display:grid;grid-template-columns:1.25fr 1fr;gap:14px}.define-assessment__card{border:1px solid var(--glass-line,rgba(255,255,255,.14));border-radius:14px;background:rgba(255,255,255,.035);padding:16px}.define-assessment__card>header{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}.define-assessment__card>header>span{width:27px;height:27px;display:grid;place-items:center;border-radius:8px;background:rgba(129,112,215,.12);font-size:10px;font-weight:900;color:#8170d7}.define-assessment__card>header strong{display:block;font-size:14px}.define-assessment__card>header p{margin:2px 0 0;font-size:11px;color:var(--muted-foreground)}
        .define-facts{display:grid;gap:0}.define-fact{display:grid;grid-template-columns:88px minmax(0,1fr) 125px;gap:10px;padding:9px 0;border-top:1px solid rgba(127,127,145,.12);align-items:start}.define-fact:first-child{border-top:0}.define-fact>span{font-size:11px;font-weight:800;color:var(--muted-foreground)}.define-fact>strong{font-size:12px;line-height:1.45}.define-fact>em{font-size:10px;font-style:normal;color:var(--muted-foreground);text-align:right}
        .define-lenses{display:grid;gap:8px}.define-lens{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:9px;align-items:start;padding:10px;border:1px solid rgba(127,127,145,.12);border-radius:11px}.define-lens>span{width:25px;height:25px;border-radius:7px;display:grid;place-items:center;background:rgba(127,127,145,.08)}.define-lens>span svg{width:14px;height:14px}.define-lens strong{display:block;font-size:12px}.define-lens p{margin:2px 0 0;font-size:10.5px;line-height:1.45;color:var(--muted-foreground)}.define-lens>em{font-size:9px;font-style:normal;font-weight:900;text-transform:uppercase;letter-spacing:.05em;padding:4px 7px;border-radius:999px}.define-lens.selected{border-color:rgba(58,146,104,.25);background:rgba(58,146,104,.055)}.define-lens.selected>em{background:rgba(58,146,104,.12);color:#247a52}.define-lens.rejected{opacity:.7}.define-lens.rejected>em{background:rgba(127,127,145,.11)}.define-lens.supporting>em{background:rgba(184,139,81,.12);color:#9a6c34}
        .define-economic{grid-column:1/-1}.define-economic__fields{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.define-economic__fields>div{padding:11px;border:1px solid rgba(127,127,145,.12);border-radius:10px}.define-economic__fields span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.07em;font-weight:800;color:var(--muted-foreground);margin-bottom:4px}.define-economic__fields strong{font-size:11.5px;line-height:1.45;display:block}
        .framework-router{border:1px solid rgba(99,192,191,.22);border-radius:14px;padding:16px;background:rgba(99,192,191,.045)}.framework-router__title{display:flex;gap:10px;align-items:flex-start;margin-bottom:11px}.framework-router__title>span{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(99,192,191,.12)}.framework-router__title svg{width:16px;height:16px}.framework-router__title small{display:block;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-foreground)}.framework-router__title strong{font-size:13px}.framework-router__routes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.framework-route{padding:11px;border:1px solid rgba(127,127,145,.12);border-radius:10px;background:rgba(255,255,255,.025)}.framework-route>span{display:block;font-size:9px;color:var(--muted-foreground);margin-bottom:4px}.framework-route strong{font-size:11.5px;display:block}.framework-route p{font-size:10px;line-height:1.45;color:var(--muted-foreground);margin:5px 0 0}.framework-router__footer{display:grid;grid-template-columns:150px 1fr;gap:10px;margin-top:11px;padding-top:11px;border-top:1px solid rgba(127,127,145,.12)}.framework-router__footer span{font-size:10px;font-weight:800;color:var(--muted-foreground)}.framework-router__footer strong{font-size:11.5px;line-height:1.45}
        html[data-theme="light"] .define-assessment,html[data-theme="light"] .define-assessment__card,html[data-theme="light"] .framework-router{background:#fff}html[data-theme="light"] .define-lens,html[data-theme="light"] .define-economic__fields>div,html[data-theme="light"] .framework-route{background:#faf9fd}
        @media(max-width:900px){.define-assessment__grid{grid-template-columns:1fr}.define-economic{grid-column:auto}.define-economic__fields,.framework-router__routes{grid-template-columns:1fr 1fr}.define-fact{grid-template-columns:70px 1fr}.define-fact>em{grid-column:2;text-align:left}.define-assessment__intro{display:grid}}
        @media(max-width:620px){.define-economic__fields,.framework-router__routes{grid-template-columns:1fr}.framework-router__footer{grid-template-columns:1fr}}
      `}</style>

      <div className="define-assessment__intro">
        <div>
          <span><Sparkles /> Gemini problem-definition assessment</span>
          <h3>Evidence selects the lens</h3>
          <p>ProofLoop separates observed facts, system assessment, and economic consequence before deciding which investigative agents and frameworks should participate.</p>
        </div>
        <div className="define-assessment__principle">Evidence → lens → agent → framework</div>
      </div>

      <div className="define-assessment__grid">
        <article className="define-assessment__card">
          <header><span>01</span><div><strong>5W1H facts</strong><p>Observed facts only. Root-cause assumptions stay out of this layer.</p></div></header>
          <div className="define-facts">
            {facts.map((fact) => (
              <div className="define-fact" key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
                <em>{fact.evidence}</em>
              </div>
            ))}
          </div>
        </article>

        <article className="define-assessment__card">
          <header><span>02</span><div><strong>Assessment lens</strong><p>Evidence selects, rejects, or keeps each business system open.</p></div></header>
          <div className="define-lenses">
            {lenses.map((lens) => (
              <div className={`define-lens ${lens.state}`} key={lens.domain}>
                <span>{lens.state === "selected" ? <CheckCircle2 /> : <Target />}</span>
                <div><strong>{humanize(lens.domain)}</strong><p>{lens.finding || "Evidence is still being evaluated."} · {evidenceLabel(Array.from({ length: lens.evidenceCount }, (_, index) => String(index)))}</p></div>
                <em>{lens.state}</em>
              </div>
            ))}
          </div>
        </article>

        <article className="define-assessment__card define-economic">
          <header><span>03</span><div><strong>Economic impact</strong><p>Translate the problem definition into a measurable business consequence.</p></div></header>
          <div className="define-economic__fields">
            <div><span>Expected state</span><strong>{rootProblem?.expected_state ?? (problemGate ? String(problemGate.expected_value) : "Baseline pending")}</strong></div>
            <div><span>Observed state</span><strong>{rootProblem?.actual_state ?? (problemGate ? String(problemGate.observed_value) : "Observed state pending")}</strong></div>
            <div><span>Metric / delta</span><strong>{economicDelta}</strong></div>
            <div><span>Business impact</span><strong>{rootProblem?.business_impact ?? "Economic impact estimate pending"}</strong></div>
          </div>
        </article>
      </div>

      <article className="framework-router">
        <div className="framework-router__title">
          <span><GitBranch /></span>
          <div><small>Assessment System → Framework Router</small><strong>Only route agents and methods justified by the evidence-selected lens.</strong></div>
        </div>
        <div className="framework-router__routes">
          {frameworks.map((framework) => (
            <div className="framework-route" key={framework.name}>
              <span>{framework.agents}</span>
              <strong>{framework.name}</strong>
              <p>{framework.why}</p>
            </div>
          ))}
        </div>
        <div className="framework-router__footer">
          <span><ShieldCheck /> Current problem definition</span>
          <strong>{rootProblem?.problem_statement ?? "Gemini will form the testable problem statement after the evidence gate."}</strong>
        </div>
      </article>
    </section>
  );
}
