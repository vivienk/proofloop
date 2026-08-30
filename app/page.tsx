"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  FileCode2,
  GitBranch,
  Globe2,
  Lightbulb,
  LockKeyhole,
  Play,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Stage = "detect" | "investigate" | "define" | "act" | "measure" | "learn";

const stages: Array<{ id: Stage; label: string; icon: typeof Activity }> = [
  { id: "detect", label: "Detect", icon: Radar },
  { id: "investigate", label: "Investigate", icon: Search },
  { id: "define", label: "Define", icon: Target },
  { id: "act", label: "Act", icon: Zap },
  { id: "measure", label: "Measure", icon: Activity },
  { id: "learn", label: "Learn", icon: BrainCircuit },
];

const evidence = [
  {
    source: "Looker",
    title: "Mobile Safari pricing → payment fell 38%",
    detail: "The break begins at the pricing selector, not at landing-page arrival.",
    reliability: "High",
    tone: "negative",
  },
  {
    source: "Google Ads",
    title: "Click quality remained within baseline",
    detail: "CTR, CPC, search terms, and engaged sessions remained stable.",
    reliability: "High",
    tone: "positive",
  },
  {
    source: "Release log",
    title: "Pricing component shipped 34 min before decline",
    detail: "Release v1.8.4 changed selector state and mobile breakpoints.",
    reliability: "High",
    tone: "negative",
  },
  {
    source: "Customer voice",
    title: "Five reports mention an unresponsive CTA",
    detail: "All five sessions were mobile Safari; four arrived from paid search.",
    reliability: "Medium",
    tone: "negative",
  },
];

const hypotheses = [
  {
    rank: 1,
    title: "Mobile pricing-selector regression",
    confidence: "Supported",
    score: 86,
    supporting: 4,
    contradicting: 0,
    next: "Reproduce on Safari and run a guarded rollback",
  },
  {
    rank: 2,
    title: "Lower-intent campaign traffic",
    confidence: "Disfavored",
    score: 24,
    supporting: 1,
    contradicting: 3,
    next: "Compare source-adjusted engagement",
  },
  {
    rank: 3,
    title: "New pricing created resistance",
    confidence: "Plausible",
    score: 41,
    supporting: 1,
    contradicting: 2,
    next: "Separate interaction failure from price objection",
  },
];

const runSteps = [
  "Validating metric definitions",
  "Comparing affected segments",
  "Testing competing explanations",
  "Tracing recent business changes",
  "Defining the root problem",
];

const API_URL = process.env.NEXT_PUBLIC_PROOFLOOP_API_URL?.replace(/\/$/, "");

function MiniTrend({ recovered = false }: { recovered?: boolean }) {
  return (
    <svg viewBox="0 0 360 92" role="img" aria-label={recovered ? "Conversion recovery trend" : "Conversion decline trend"} className="trend-chart">
      <defs>
        <linearGradient id={recovered ? "fill-green" : "fill-coral"} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={recovered ? "#247a52" : "#db5a43"} stopOpacity="0.26" />
          <stop offset="100%" stopColor={recovered ? "#247a52" : "#db5a43"} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[18, 46, 74].map((y) => (
        <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="currentColor" opacity="0.08" />
      ))}
      <path
        d={recovered ? "M0,69 C38,67 55,65 86,64 C116,62 126,70 158,65 C187,60 197,48 226,45 C255,42 263,30 292,28 C320,26 337,19 360,17 L360,92 L0,92Z" : "M0,22 C34,20 54,24 84,22 C116,20 137,27 165,25 C193,23 204,34 232,39 C263,45 277,62 306,65 C330,67 345,70 360,73 L360,92 L0,92Z"}
        fill={`url(#${recovered ? "fill-green" : "fill-coral"})`}
      />
      <path
        d={recovered ? "M0,69 C38,67 55,65 86,64 C116,62 126,70 158,65 C187,60 197,48 226,45 C255,42 263,30 292,28 C320,26 337,19 360,17" : "M0,22 C34,20 54,24 84,22 C116,20 137,27 165,25 C193,23 204,34 232,39 C263,45 277,62 306,65 C330,67 345,70 360,73"}
        fill="none"
        stroke={recovered ? "#247a52" : "#db5a43"}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line x1="205" x2="205" y1="8" y2="82" stroke="#b88b51" strokeDasharray="4 4" />
      <circle cx={recovered ? 292 : 306} cy={recovered ? 28 : 65} r="4.5" fill={recovered ? "#247a52" : "#db5a43"} />
    </svg>
  );
}

function SourceMark({ type }: { type: string }) {
  const icons: Record<string, typeof Database> = {
    "Google Ads": Globe2,
    Looker: Database,
    "Release log": FileCode2,
    "Customer voice": CircleDot,
  };
  const Icon = icons[type] ?? Database;
  return <Icon aria-hidden="true" />;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("define");
  const [isRunning, setIsRunning] = useState(false);
  const [runIndex, setRunIndex] = useState(runSteps.length);
  const [actionStatus, setActionStatus] = useState<"ready" | "monitoring" | "verified">("ready");
  const [lastUpdated, setLastUpdated] = useState("2 min ago");
  const [runId, setRunId] = useState<string | null>(null);
  const [backendMode, setBackendMode] = useState<"demo" | "calling" | "live" | "fallback">("demo");

  useEffect(() => {
    if (!isRunning) return;
    if (runIndex >= runSteps.length) {
      setIsRunning(false);
      setStage("define");
      setLastUpdated("just now");
      return;
    }
    const timer = window.setTimeout(() => setRunIndex((value) => value + 1), 620);
    return () => window.clearTimeout(timer);
  }, [isRunning, runIndex]);

  const completedStage = useMemo(() => {
    if (actionStatus === "verified") return 6;
    if (actionStatus === "monitoring") return 5;
    return 3;
  }, [actionStatus]);

  async function callLiveDiagnostic() {
    if (!API_URL) return;
    setBackendMode("calling");
    try {
      const response = await fetch(`${API_URL}/v1/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_id: "PL-0047",
          concern: "Paid traffic is rising while purchases are falling.",
          user_id: "demo-founder",
        }),
      });
      if (!response.ok) throw new Error("Agent request failed");
      const payload = await response.json();
      setRunId(payload.run_id);
      setBackendMode("live");
    } catch {
      setBackendMode("fallback");
    }
  }

  function runDiagnostic() {
    setStage("investigate");
    setRunIndex(0);
    setIsRunning(true);
    void callLiveDiagnostic();
  }

  function launchIntervention() {
    setActionStatus("monitoring");
    setStage("measure");
    setLastUpdated("just now");
    if (API_URL && runId) {
      void fetch(`${API_URL}/v1/interventions/${runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved_by: "demo-founder",
          scope_acknowledged: true,
        }),
      });
    }
  }

  function verifyOutcome() {
    setActionStatus("verified");
    setStage("learn");
    setLastUpdated("just now");
    if (API_URL && runId) {
      void fetch(`${API_URL}/v1/interventions/${runId}/evaluate`, {
        method: "POST",
      });
    }
  }

  return (
    <main className="proof-shell">
      <aside className="side-rail">
        <div className="brand-lockup">
          <div className="brand-mark"><GitBranch /></div>
          <div>
            <span className="brand-name">ProofLoop</span>
            <span className="brand-edition">Business diagnostic agent</span>
          </div>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">NS</div>
          <div>
            <strong>Northstar Studio</strong>
            <span>Solo business · Growth</span>
          </div>
          <ChevronRight />
        </div>

        <nav className="side-nav" aria-label="Diagnostic stages">
          <p className="nav-kicker">Active flywheel</p>
          {stages.map((item, index) => {
            const Icon = item.icon;
            const isComplete = index < completedStage;
            const isCurrent = item.id === stage;
            return (
              <button
                key={item.id}
                type="button"
                className={`stage-button ${isCurrent ? "is-current" : ""}`}
                onClick={() => setStage(item.id)}
              >
                <span className={`stage-icon ${isComplete ? "is-complete" : ""}`}>
                  {isComplete ? <Check /> : <Icon />}
                </span>
                <span>{item.label}</span>
                {item.id === "define" && actionStatus === "ready" && <span className="stage-pulse" />}
              </button>
            );
          })}
        </nav>

        <div className="rail-footer">
          <div className="connection-row"><span className="status-dot" /> 4 evidence sources live</div>
          <div className="connection-row muted"><ShieldCheck /> Read-only data access</div>
        </div>
      </aside>

      <section className="workbench">
        <header className="topbar">
          <div>
            <div className="eyebrow-row">
              <span className="incident-code">PL–0047</span>
              <span className="severity-pill"><TriangleAlert /> Revenue risk</span>
            </div>
            <h1>Paid traffic is rising. Purchases are falling.</h1>
          </div>
          <div className="topbar-actions">
            <span className="updated-label"><Clock3 /> Updated {lastUpdated}</span>
            <Button variant="outline" onClick={runDiagnostic} disabled={isRunning} className="replay-button">
              {isRunning ? <RefreshCw className="animate-spin" /> : <Play />}
              {isRunning ? "Investigating" : "Run diagnostic"}
            </Button>
          </div>
        </header>

        {isRunning && (
          <section className="agent-run" aria-live="polite">
            <div className="agent-run-copy">
              <div className="gemini-orb"><Sparkles /></div>
              <div>
                <strong>Gemini is investigating the business system</strong>
                <span>{runSteps[Math.min(runIndex, runSteps.length - 1)]}</span>
              </div>
            </div>
            <div className="run-progress">
              <span>{Math.round((runIndex / runSteps.length) * 100)}%</span>
              <Progress value={(runIndex / runSteps.length) * 100} />
            </div>
          </section>
        )}

        <section className="metric-strip" aria-label="Incident metrics">
          <article>
            <span>Ad clicks</span>
            <strong>12,840</strong>
            <em className="metric-up">+22.4%</em>
          </article>
          <article>
            <span>Purchase conversion</span>
            <strong>8.5%</strong>
            <em className="metric-down">−24.1%</em>
          </article>
          <article>
            <span>Revenue at risk</span>
            <strong>$4.8k</strong>
            <em>monthly estimate</em>
          </article>
          <article className="metric-chart-card">
            <div><span>Conversion trend</span><em>Release v1.8.4</em></div>
            <MiniTrend recovered={actionStatus === "verified"} />
          </article>
        </section>

        <div className="stage-canvas">
          {stage === "detect" && (
            <section className="stage-panel">
              <div className="panel-heading">
                <div><span className="section-number">01 / Detect</span><h2>A meaningful business change, not ordinary noise</h2></div>
                <Badge variant="outline" className="status-badge alert"><TrendingDown /> Anomaly confirmed</Badge>
              </div>
              <div className="detect-grid">
                <article className="primary-signal">
                  <div className="signal-header"><span>Purchase conversion</span><strong>−24.1%</strong></div>
                  <MiniTrend />
                  <div className="chart-legend"><span>Aug 18</span><span className="release-label">Pricing release</span><span>Aug 29</span></div>
                </article>
                <article className="validation-list">
                  <h3>Signal validation</h3>
                  {[
                    ["Tracking continuity", "Passed"],
                    ["Sample sufficiency", "Passed"],
                    ["Seasonality check", "Passed"],
                    ["Metric definition", "Unchanged"],
                  ].map(([label, value]) => <div key={label}><span><CheckCircle2 /> {label}</span><strong>{value}</strong></div>)}
                  <button type="button" onClick={() => setStage("investigate")}>Investigate what changed <ArrowRight /></button>
                </article>
              </div>
            </section>
          )}

          {stage === "investigate" && (
            <section className="stage-panel">
              <div className="panel-heading">
                <div><span className="section-number">02 / Investigate</span><h2>Evidence before explanation</h2></div>
                <Badge variant="outline" className="status-badge"><Database /> 4 sources · 26 observations</Badge>
              </div>
              <Tabs defaultValue="evidence" className="evidence-tabs">
                <TabsList variant="line">
                  <TabsTrigger value="evidence">Evidence ledger</TabsTrigger>
                  <TabsTrigger value="hypotheses">Competing hypotheses</TabsTrigger>
                  <TabsTrigger value="system">Business system</TabsTrigger>
                </TabsList>
                <TabsContent value="evidence" className="evidence-ledger">
                  {evidence.map((item) => (
                    <article key={item.title}>
                      <div className={`source-icon ${item.tone}`}><SourceMark type={item.source} /></div>
                      <div className="evidence-copy"><span>{item.source}</span><strong>{item.title}</strong><p>{item.detail}</p></div>
                      <div className="reliability"><span>Reliability</span><strong>{item.reliability}</strong></div>
                    </article>
                  ))}
                </TabsContent>
                <TabsContent value="hypotheses" className="hypothesis-list">
                  {hypotheses.map((item) => (
                    <article key={item.rank} className={item.rank === 1 ? "leading-hypothesis" : ""}>
                      <div className="rank">0{item.rank}</div>
                      <div className="hypothesis-copy"><div><strong>{item.title}</strong><Badge variant="outline">{item.confidence}</Badge></div><p>Next test: {item.next}</p></div>
                      <div className="score-ring" style={{ "--score": `${item.score * 3.6}deg` } as React.CSSProperties}><span>{item.score}</span></div>
                      <div className="evidence-count"><span className="supports">+{item.supporting}</span><span className="contradicts">−{item.contradicting}</span></div>
                    </article>
                  ))}
                </TabsContent>
                <TabsContent value="system" className="system-map">
                  {[
                    ["Market", "Demand stable", "clear"],
                    ["Acquisition", "Traffic quality stable", "clear"],
                    ["Frontstage", "Pricing interaction failing", "risk"],
                    ["Backstage", "Release controls missing", "risk"],
                    ["Economics", "$4.8k monthly exposure", "watch"],
                  ].map(([name, detail, tone]) => <article key={name} className={tone}><span>{name}</span><strong>{detail}</strong></article>)}
                </TabsContent>
              </Tabs>
            </section>
          )}

          {stage === "define" && (
            <section className="stage-panel root-panel">
              <div className="panel-heading">
                <div><span className="section-number">03 / Define the actual problem</span><h2>What is actually wrong?</h2></div>
                <Badge variant="outline" className="status-badge supported"><ShieldCheck /> Supported · ready to test</Badge>
              </div>

              <div className="root-layout">
                <article className="root-statement">
                  <div className="statement-kicker"><Target /> Root problem to test</div>
                  <p>
                    Qualified <mark>mobile Safari visitors</mark> are unable to advance from pricing to payment because the new selector leaves the primary CTA in a disabled state.
                  </p>
                  <div className="root-meta">
                    <div><span>Affected</span><strong>38% of mobile Safari sessions</strong></div>
                    <div><span>Business consequence</span><strong>$4.8k monthly revenue at risk</strong></div>
                    <div><span>First observed</span><strong>34 min after release v1.8.4</strong></div>
                  </div>
                </article>

                <article className="causal-chain">
                  <div className="causal-label">Causal chain</div>
                  <div className="cause-node"><span>Observed signal</span><strong>Purchase conversion ↓ 24%</strong></div>
                  <div className="chain-line"><ChevronRight /></div>
                  <div className="cause-node"><span>Proximate cause</span><strong>CTA cannot be activated</strong></div>
                  <div className="chain-line"><ChevronRight /></div>
                  <div className="cause-node systemic"><span>Systemic root cause</span><strong>No mobile-browser release gate</strong></div>
                </article>
              </div>

              <div className="reasoning-grid">
                <article>
                  <div className="reasoning-icon positive"><Check /></div>
                  <div><span>Why this fits</span><strong>Four independent observations predict the same mechanism.</strong><p>Segment, timing, user reports, and release evidence converge.</p></div>
                </article>
                <article>
                  <div className="reasoning-icon negative"><X /></div>
                  <div><span>What it is probably not</span><strong>Lower-quality paid traffic.</strong><p>Upstream campaign quality and engagement remain within baseline.</p></div>
                </article>
                <article>
                  <div className="reasoning-icon neutral"><Lightbulb /></div>
                  <div><span>What would prove it</span><strong>A controlled rollback restores progression.</strong><p>Compare affected Safari sessions against the current experience.</p></div>
                </article>
              </div>

              <div className="decision-bar">
                <div><LockKeyhole /><span><strong>Proof gate passed</strong> The proposed intervention is bounded, reversible, and measurable.</span></div>
                <Button onClick={() => setStage("act")}>Review intervention <ArrowRight /></Button>
              </div>
            </section>
          )}

          {stage === "act" && (
            <section className="stage-panel">
              <div className="panel-heading">
                <div><span className="section-number">04 / Act</span><h2>Run the smallest test that could prove us wrong</h2></div>
                <Badge variant="outline" className="status-badge"><LockKeyhole /> Human approval required</Badge>
              </div>
              <div className="intervention-layout">
                <article className="intervention-card">
                  <div className="intervention-top"><span>Recommended intervention</span><Badge variant="outline">Low risk</Badge></div>
                  <h3>Guarded rollback for mobile Safari</h3>
                  <p>Route 50% of affected sessions to the previous pricing component. Leave all other traffic unchanged.</p>
                  <div className="intervention-specs">
                    <div><span>Primary metric</span><strong>Pricing → payment progression</strong></div>
                    <div><span>Success threshold</span><strong>≥ 12% relative recovery</strong></div>
                    <div><span>Observation window</span><strong>24 hours or 1,200 sessions</strong></div>
                    <div><span>Automatic stop</span><strong>Revenue/session declines &gt; 5%</strong></div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={actionStatus !== "ready"} className="launch-button"><Play /> {actionStatus === "ready" ? "Approve and launch test" : "Test already launched"}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogMedia><ShieldCheck /></AlertDialogMedia>
                        <AlertDialogTitle>Launch the guarded rollback?</AlertDialogTitle>
                        <AlertDialogDescription>ProofLoop will create the intervention record, route the test cohort, and begin the 24-hour measurement window. It will not change ad budgets or affect desktop traffic.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep investigating</AlertDialogCancel>
                        <AlertDialogAction onClick={launchIntervention}>Approve intervention</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </article>
                <article className="execution-log">
                  <h3>Execution plan</h3>
                  {[
                    ["Create experiment record", "Firestore", true],
                    ["Open implementation issue", "GitHub", true],
                    ["Route guarded cohort", "Feature flag", false],
                    ["Start measurement window", "Cloud Run", false],
                    ["Evaluate and store learning", "Gemini + Firestore", false],
                  ].map(([task, system, done], i) => <div key={String(task)}><span className={done ? "done" : "queued"}>{done ? <Check /> : i + 1}</span><div><strong>{task}</strong><span>{system}</span></div></div>)}
                </article>
              </div>
            </section>
          )}

          {stage === "measure" && (
            <section className="stage-panel">
              <div className="panel-heading">
                <div><span className="section-number">05 / Measure</span><h2>Did the intervention actually work?</h2></div>
                <Badge variant="outline" className={`status-badge ${actionStatus === "verified" ? "supported" : "monitoring"}`}>{actionStatus === "verified" ? <CheckCircle2 /> : <Activity />} {actionStatus === "verified" ? "Outcome verified" : "Measurement active"}</Badge>
              </div>
              <div className="measure-layout">
                <article className="outcome-chart">
                  <div className="signal-header"><div><span>Pricing → payment progression</span><strong>{actionStatus === "verified" ? "+16.8%" : "Collecting…"}</strong></div><Badge variant="outline">Safari cohort</Badge></div>
                  <MiniTrend recovered={actionStatus === "verified"} />
                  <div className="comparison-row"><div><span>Control</span><strong>41.2%</strong></div><div><span>Rollback cohort</span><strong>{actionStatus === "verified" ? "48.1%" : "—"}</strong></div><div><span>Sessions</span><strong>{actionStatus === "verified" ? "1,284" : "628 / 1,200"}</strong></div></div>
                </article>
                <article className="evaluation-card">
                  <span className="evaluation-kicker">Causal evaluation</span>
                  <h3>{actionStatus === "verified" ? "The predicted mechanism held." : "Waiting for the proof threshold."}</h3>
                  <p>{actionStatus === "verified" ? "The rollback cohort recovered while the unchanged control remained flat. No material change occurred in traffic quality or pricing mix." : "ProofLoop will compare the guarded cohort with the unchanged experience once the minimum sample is reached."}</p>
                  <div className="evaluation-checks">
                    <span><Check /> Direction matched prediction</span>
                    <span><Check /> Guardrail metrics protected</span>
                    <span className={actionStatus === "verified" ? "" : "pending"}>{actionStatus === "verified" ? <Check /> : <Clock3 />} Minimum evidence reached</span>
                  </div>
                  {actionStatus !== "verified" && <Button onClick={verifyOutcome}>Load post-intervention result <RefreshCw /></Button>}
                  {actionStatus === "verified" && <Button onClick={() => setStage("learn")}>View learned business rule <ArrowRight /></Button>}
                </article>
              </div>
            </section>
          )}

          {stage === "learn" && (
            <section className="stage-panel learn-panel">
              <div className="panel-heading">
                <div><span className="section-number">06 / Learn</span><h2>Turn one fix into a stronger business</h2></div>
                <Badge variant="outline" className="status-badge supported"><BrainCircuit /> Memory updated</Badge>
              </div>
              <div className="learning-hero">
                <div className="learning-mark"><Sparkles /></div>
                <span>Verified operating rule · Frontstage reliability</span>
                <h3>Revenue-critical interface releases must pass mobile Safari regression checks before full rollout.</h3>
                <p>When a conversion decline begins after a frontstage release while acquisition quality remains stable, test the affected experience before changing advertising spend.</p>
                <div className="learning-evidence"><span><CheckCircle2 /> Supported by intervention PL–0047</span><span><Database /> 1,284 evaluated sessions</span><span><Clock3 /> Learned Aug 29, 2026</span></div>
              </div>
              <div className="next-time-grid">
                <article><span>Next detection</span><strong>Watch pricing progression by browser after every release.</strong></article>
                <article><span>Next diagnosis</span><strong>Prioritize frontstage failure before acquisition quality.</strong></article>
                <article><span>Next prevention</span><strong>Add Safari checks to the release readiness gate.</strong></article>
              </div>
              <button type="button" className="ledger-link"><span><GitBranch /> Open the complete proof ledger</span><ExternalLink /></button>
            </section>
          )}
        </div>

        <footer className="app-footer">
          <span><Sparkles /> Gemini 3.5</span>
          <span>Google ADK</span>
          <span>Cloud Run</span>
          <span>Firestore</span>
          <span className="footer-note">
            {backendMode === "live"
              ? "Live Gemini agent run"
              : backendMode === "calling"
                ? "Connecting to Gemini agent…"
                : backendMode === "fallback"
                  ? "Agent unavailable · privacy-safe replay active"
                  : "Synthetic, privacy-safe demonstration data"}
          </span>
        </footer>
      </section>
    </main>
  );
}
