"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  ExternalLink,
  Maximize2,
  FileChartColumn,
  FileText,
  GitBranch,
  Globe2,
  History,
  Layers3,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageCircleMore,
  Minimize2,
  Network,
  Paperclip,
  PanelRightClose,
  PanelRightOpen,
  PlugZap,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Target,
  UploadCloud,
  UserRoundCheck,
  X,
  Zap,
} from "lucide-react";

import northstarData from "@/data/business-context-northstar.json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  firebaseConfigured,
  signInToProofLoop,
  watchProofLoopUser,
  type User,
} from "@/lib/firebase";

type ContextView = "overview" | "forensics" | "ledger";
type ForensicsStep = "evidence" | "history" | "model" | "engine" | "operations" | "baselines" | "readiness";
type EvidenceDomain = "business" | "revenue" | "product" | "growth" | "customers" | "operations";

type EvidenceSource = {
  source_id: string;
  name: string;
  domain: EvidenceDomain;
  source_type: string;
  status: string;
  provenance: string;
  coverage: string;
  freshness: string;
  permission: string;
};

type ContextClaim = {
  claim_id: string;
  domain: EvidenceDomain;
  claim: string;
  source_ids: string[];
  source_locator: string;
  reliability: "low" | "medium" | "high";
  confirmation_status: "pending" | "confirmed" | "rejected" | "conflicted";
};

type Metric = {
  metric_id: string;
  label: string;
  unit: string;
  current_value: number;
  expected_low: number | null;
  expected_high: number | null;
  standard_type: string;
  standard_basis: string;
  evidence_strength: string;
  baseline_level: "A" | "B" | "C" | "D";
  trend: string;
  volatility: string;
  seasonality: string;
  observations: Array<{ period: string; value: number }>;
  source_ids: string[];
};

type TimelineEvent = {
  event_id: string;
  date: string;
  event_type: string;
  title: string;
  description: string;
  evidence_ids: string[];
  before_after: string;
  ranked_investigation_leads: string[];
};

type BusinessContext = {
  workspace_id: string;
  business_name: string;
  value_proposition: string;
  primary_customer: string;
  current_objective: string;
  classification: {
    primary_model: string;
    secondary_models: string[];
    revenue_models: string[];
    stage: string;
    evidence_ids: string[];
    founder_confirmed: boolean;
  };
  economic_engine: Array<{ order: number; name: string; description: string; metric_ids: string[] }>;
  operating_system: Array<{
    area: string;
    systems: string[];
    process_summary: string;
    dependencies: string[];
    evidence_ids: string[];
  }>;
  external_dependencies: string[];
  evidence_sources: EvidenceSource[];
  claims: ContextClaim[];
  metrics: Metric[];
  timeline_events: TimelineEvent[];
  selected_frameworks: Array<{
    framework: string;
    purpose: string;
    trigger_evidence_ids: string[];
    excluded_alternatives: string[];
  }>;
  readiness: {
    status: "red" | "green";
    score: number;
    ready_scopes: string[];
    blocked_scopes: string[];
    areas: Array<{ area: string; status: "red" | "green"; reason: string; missing_evidence: string[] }>;
    next_best_question: string;
    reason: string;
  };
  conflicts: Array<{
    conflict_id: string;
    topic: string;
    preferred_claim: string;
    preferred_source_ids: string[];
    alternative_claim: string;
    alternative_source_ids: string[];
    selection_reason: string;
    founder_approval_required: boolean;
  }>;
  limitations: string[];
};

type ChatMessage = { role: "assistant" | "user"; text: string; meta?: string };

const API_URL = (process.env.NEXT_PUBLIC_PROOFLOOP_API_URL ?? "https://proofloop-agent.onrender.com").replace(/\/$/, "");
const initialContext = northstarData as unknown as BusinessContext;
const numberFormatter = new Intl.NumberFormat("en-US");
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const journey: Array<{ id: ForensicsStep; label: string }> = [
  { id: "evidence", label: "Evidence" },
  { id: "history", label: "History" },
  { id: "model", label: "Business model" },
  { id: "engine", label: "Economic engine" },
  { id: "operations", label: "Operations" },
  { id: "baselines", label: "Baselines" },
  { id: "readiness", label: "Readiness" },
];

const evidenceCatalog: Record<EvidenceDomain, string[]> = {
  business: ["Website", "Pitch deck", "Business plan", "Product documentation", "Pricing page", "Strategy documents"],
  revenue: ["Stripe", "Shopify", "Amazon", "Gumroad", "Lemon Squeezy", "QuickBooks", "Accounting export"],
  product: ["PostHog", "GA4", "Mixpanel", "Amplitude", "App database", "App-store analytics"],
  growth: ["Google Ads", "Meta Ads", "TikTok Ads", "AppsFlyer", "Search Console", "Email platform"],
  customers: ["Salesforce", "HubSpot", "Customer support", "Gmail", "Reviews", "Surveys", "NPS", "Interviews"],
  operations: ["Notion", "Linear", "GitHub", "Project history", "Fulfillment", "Inventory", "Contractor tools"],
};

const demoAvailable = new Set(["Website", "Stripe", "PostHog", "Google Ads", "Customer support", "GitHub"]);

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetric(metric: Metric) {
  if (metric.unit === "%") return `${metric.current_value}%`;
  if (metric.unit === "$" || metric.unit === "USD") return `$${numberFormatter.format(metric.current_value)}`;
  return numberFormatter.format(metric.current_value);
}

function pathFor(values: number[], width = 520, height = 74) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - 10 - ((value - min) / range) * (height - 20);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function openEvidenceDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("proofloop-evidence", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function retainFileInBrowser(workspaceId: string, file: File) {
  const database = await openEvidenceDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("files", "readwrite");
    transaction.objectStore("files").put({
      id: `${workspaceId}:${Date.now()}:${file.name}`,
      workspaceId,
      name: file.name,
      type: file.type,
      size: file.size,
      retainedAt: new Date().toISOString(),
      file,
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function HistoryTimeline({
  context,
  onInvestigate,
}: {
  context: BusinessContext;
  onInvestigate: (event: TimelineEvent) => void;
}) {
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(context.timeline_events[2] ?? null);
  const metrics = context.metrics.slice(0, 4);

  return (
    <section className="history-card">
      <div className="card-heading-row">
        <div><span className="section-kicker">Historical causal timeline</span><h2>What changed, and what changed nearby?</h2></div>
        <div className="segmented-control">
          <button type="button" className={mode === "chart" ? "active" : ""} onClick={() => setMode("chart")}><BarChart3 /> Chart</button>
          <button type="button" className={mode === "table" ? "active" : ""} onClick={() => setMode("table")}><TableProperties /> Table</button>
        </div>
      </div>

      {mode === "chart" ? (
        <div className="timeline-chart">
          <div className="metric-lanes">
            {metrics.map((metric, metricIndex) => (
              <div className="metric-lane" key={metric.metric_id}>
                <div><strong>{metric.label}</strong><span>{humanize(metric.trend)} · {metric.standard_basis}</span></div>
                <svg viewBox="0 0 520 74" role="img" aria-label={`${metric.label} trajectory`}>
                  <line x1="0" x2="520" y1="37" y2="37" />
                  <path d={pathFor(metric.observations.map((item) => item.value))} className={`lane-${metricIndex}`} />
                  {metric.observations.map((item, index) => {
                    const x = metric.observations.length === 1 ? 260 : (index / (metric.observations.length - 1)) * 520;
                    const values = metric.observations.map((entry) => entry.value);
                    const min = Math.min(...values);
                    const range = Math.max(...values) - min || 1;
                    const y = 64 - ((item.value - min) / range) * 54;
                    return <circle key={item.period} cx={x} cy={y} r="4" className={`lane-${metricIndex}`} />;
                  })}
                </svg>
                <strong className="lane-value">{formatMetric(metric)}</strong>
              </div>
            ))}
          </div>
          <div className="event-rail">
            <span className="rail-label">Business events</span>
            <div className="event-track">
              {context.timeline_events.map((event, index) => (
                <button
                  key={event.event_id}
                  type="button"
                  className={selectedEvent?.event_id === event.event_id ? "active" : ""}
                  style={{ left: `${8 + index * (82 / Math.max(context.timeline_events.length - 1, 1))}%` }}
                  onClick={() => setSelectedEvent(event)}
                >
                  <span><Zap /></span>
                  <em>{shortDateFormatter.format(new Date(event.date))}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="timeline-table-wrap">
          <table className="timeline-table">
            <thead><tr><th>Date</th><th>Event</th><th>Before → after</th><th>Ranked leads</th><th /></tr></thead>
            <tbody>{context.timeline_events.map((event) => (
              <tr key={event.event_id}>
                <td>{fullDateFormatter.format(new Date(event.date))}</td>
                <td><strong>{event.title}</strong><span>{humanize(event.event_type)}</span></td>
                <td>{event.before_after}</td>
                <td>{event.ranked_investigation_leads.join(" · ")}</td>
                <td><button type="button" onClick={() => onInvestigate(event)}><ArrowRight /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {mode === "chart" && selectedEvent && (
        <article className="event-detail">
          <div className="event-icon"><GitBranch /></div>
          <div className="event-copy">
            <span>{humanize(selectedEvent.event_type)} · {fullDateFormatter.format(new Date(selectedEvent.date))}</span>
            <h3>{selectedEvent.title}</h3>
            <p>{selectedEvent.description}</p>
          </div>
          <div className="event-evidence"><span>Before → after</span><strong>{selectedEvent.before_after}</strong><em>{selectedEvent.evidence_ids.length} evidence references</em></div>
          <div className="event-leads"><span>Gemini-ranked investigation leads</span>{selectedEvent.ranked_investigation_leads.map((lead) => <em key={lead}>{lead}</em>)}</div>
          <Button variant="outline" onClick={() => onInvestigate(selectedEvent)}>Create investigation <ArrowRight /></Button>
        </article>
      )}
    </section>
  );
}

function AssistantPanel({
  messages,
  question,
  value,
  onValue,
  onSend,
  busy,
  user,
  onSignIn,
}: {
  messages: ChatMessage[];
  question: string;
  value: string;
  onValue: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  user: User | null;
  onSignIn: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [panelMode, setPanelMode] = useState<"docked" | "expanded" | "collapsed">("docked");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, 168)}px`;
  }, [value]);

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!busy && value.trim()) onSend();
    }
  }

  return (
    <aside className={`context-assistant is-${panelMode}`} aria-label="ProofLoop agent">
      <div className="assistant-panel-bar">
        <div className="assistant-panel-identity"><span className="assistant-orb"><Sparkles /></span><strong>ProofLoop agent</strong></div>
        <div className="assistant-panel-controls">
          {panelMode === "collapsed" ? (
            <button type="button" aria-label="Open agent" onClick={() => setPanelMode("docked")}><PanelRightOpen /></button>
          ) : (
            <>
              <button
                type="button"
                aria-label={panelMode === "expanded" ? "Restore agent width" : "Expand agent"}
                onClick={() => setPanelMode((mode) => mode === "expanded" ? "docked" : "expanded")}
              >
                {panelMode === "expanded" ? <Minimize2 /> : <Maximize2 />}
              </button>
              <button type="button" aria-label="Collapse agent" onClick={() => setPanelMode("collapsed")}><PanelRightClose /></button>
            </>
          )}
        </div>
      </div>
      <div className="assistant-content">
        <div className="assistant-hero">
          <span>Business Forensics agent</span>
          <h2>How can I help reconstruct your business?</h2>
          <p>I ask one material question at a time and cite what changed in your context.</p>
        </div>
        <div className="assistant-tabs"><button className="active" type="button"><Bot /> ProofLoop</button><button type="button"><History /> Context</button></div>
        <div className="chat-stream">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
              <span>{message.role === "assistant" ? <Sparkles /> : <UserRoundCheck />}</span>
              <div><p>{message.text}</p>{message.meta && <em>{message.meta}</em>}</div>
            </div>
          ))}
          {busy && <div className="chat-bubble assistant"><span><LoaderCircle className="animate-spin" /></span><div><p>Reconstructing the evidence graph…</p></div></div>}
          <div ref={endRef} />
        </div>
        <div className="next-question"><span>Highest-information question</span><strong>{question}</strong></div>
        {!user && <button type="button" className="signin-inline" onClick={onSignIn}><LockKeyhole /> Sign in to save a personal workspace</button>}
        <div className="chat-composer">
          <textarea
            ref={composerRef}
            value={value}
            onChange={(event) => onValue(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Answer, correct an inference, or ask ProofLoop…"
            rows={1}
          />
          <div><button type="button" aria-label="Attach evidence"><Paperclip /></button><button type="button" className="send" aria-label="Send message" disabled={busy || !value.trim()} onClick={onSend}><Send /></button></div>
        </div>
        <div className="assistant-trust"><ShieldCheck /> Claims remain provisional until evidence or founder confirmation supports them.</div>
      </div>
    </aside>
  );
}

export function BusinessContextWorkspace({
  view,
  onNavigate,
  onOpenPreparedIncident,
  onCreateInvestigation,
}: {
  view: ContextView;
  onNavigate: (view: "overview" | "forensics" | "investigations" | "ledger") => void;
  onOpenPreparedIncident: () => void;
  onCreateInvestigation: (concern: string, contextLink?: { workspaceId: string; idToken: string }) => void;
}) {
  const [context, setContext] = useState<BusinessContext>(initialContext);
  const [step, setStep] = useState<ForensicsStep>("evidence");
  const [timelineSeed, setTimelineSeed] = useState<TimelineEvent | null>(null);
  const [chatValue, setChatValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "I reconstructed Northstar Studio from six privacy-safe evidence sources.", meta: "Business Context Gate · 92% ready" },
    { role: "assistant", text: "You can explore the prepared workspace or sign in to reconstruct your own business from uploads, a public website, and conversation." },
  ]);
  const [user, setUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState("northstar-demo");
  const [personalWorkspace, setPersonalWorkspace] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceDomain, setSourceDomain] = useState<EvidenceDomain | "all">("all");
  const [connectedDemoSources, setConnectedDemoSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimDecisions, setClaimDecisions] = useState<Record<string, "confirmed" | "rejected">>({});

  useEffect(() => watchProofLoopUser(setUser), []);

  useEffect(() => {
    if (!user) return;
    const id = `business-${user.uid.slice(0, 16)}`;
    setWorkspaceId(id);
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${API_URL}/v1/business-contexts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const record = await response.json();
          setContext(record.context as BusinessContext);
          setPersonalWorkspace(true);
          setMessages((current) => [...current, { role: "assistant", text: "I reopened your saved Business Context Graph.", meta: `Version ${record.version}` }]);
        }
      } catch {
        // A new user legitimately has no saved workspace yet.
      }
    })();
  }, [user]);

  const filteredSources = useMemo(() => {
    const entries = Object.entries(evidenceCatalog) as Array<[EvidenceDomain, string[]]>;
    return entries
      .filter(([domain]) => sourceDomain === "all" || domain === sourceDomain)
      .flatMap(([domain, names]) => names.map((name) => ({ domain, name })))
      .filter((item) => item.name.toLowerCase().includes(sourceSearch.toLowerCase()));
  }, [sourceDomain, sourceSearch]);

  const pendingClaims = context.claims.filter((claim) => claim.confirmation_status === "pending" || claim.confirmation_status === "conflicted");
  const activeStepIndex = journey.findIndex((item) => item.id === step);

  async function signIn() {
    setError(null);
    try {
      const signedInUser = await signInToProofLoop();
      setUser(signedInUser);
      setPersonalWorkspace(true);
      setContext({ ...initialContext, workspace_id: `business-${signedInUser.uid.slice(0, 16)}`, business_name: "My business", claims: [], metrics: [], timeline_events: [], evidence_sources: [], readiness: { ...initialContext.readiness, status: "red", score: 0, ready_scopes: [], blocked_scopes: ["growth", "product", "customer", "operations"], next_best_question: "What does your business help customers accomplish?" } });
      setMessages([{ role: "assistant", text: "Let’s reconstruct your business from evidence. Connect, upload, share a public website, or answer one question at a time." }]);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Google sign-in could not start.");
    }
  }

  async function callContextAgent({ message = "", includeSelectedEvidence = false }: { message?: string; includeSelectedEvidence?: boolean }) {
    if (!user) {
      await signIn();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const form = new FormData();
      form.append("workspace_id", workspaceId);
      form.append("message", message);
      form.append("urls_json", JSON.stringify(includeSelectedEvidence && websiteUrl.trim() ? [websiteUrl.trim()] : []));
      form.append("confirmed_claim_ids_json", "[]");
      form.append("rejected_claim_ids_json", "[]");
      if (includeSelectedEvidence) {
        for (const file of selectedFiles) {
          await retainFileInBrowser(workspaceId, file);
          form.append("files", file);
        }
      }
      const response = await fetch(`${API_URL}/v1/business-contexts/reconstruct`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail?.message ?? payload?.detail ?? "Context reconstruction failed.");
      setContext(payload.context as BusinessContext);
      setPersonalWorkspace(true);
      setMessages((current) => [
        ...current,
        ...(message ? [{ role: "user" as const, text: message }] : []),
        { role: "assistant", text: payload.assistant_message, meta: `Context v${payload.version} · ${payload.context.readiness.score}% ready` },
      ]);
      setSelectedFiles([]);
      setWebsiteUrl("");
      setChatValue("");
      if (payload.pending_confirmation_claim_ids?.length) setStep("model");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Context reconstruction failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    if (!chatValue.trim()) return;
    if (personalWorkspace && user) {
      await callContextAgent({ message: chatValue.trim() });
      return;
    }
    const message = chatValue.trim();
    setMessages((current) => [...current, { role: "user", text: message }, { role: "assistant", text: "That changes the business context. Sign in when you want me to persist the evidence-linked reconstruction.", meta: "Demo conversation · not persisted" }]);
    setChatValue("");
  }

  async function applyClaimReview() {
    if (!user) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/v1/business-contexts/${workspaceId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          confirmed_claim_ids: Object.entries(claimDecisions).filter(([, decision]) => decision === "confirmed").map(([id]) => id),
          rejected_claim_ids: Object.entries(claimDecisions).filter(([, decision]) => decision === "rejected").map(([id]) => id),
          approved_conflict_ids: context.conflicts.map((conflict) => conflict.conflict_id),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail ?? "Claim review failed.");
      setContext(payload.context as BusinessContext);
      setClaimDecisions({});
      setMessages((current) => [...current, { role: "assistant", text: "I applied your claim decisions and recomputed the Business Context Gate.", meta: `${payload.context.readiness.score}% ready` }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Claim review failed.");
    } finally {
      setBusy(false);
    }
  }

  function selectTimelineInvestigation(event: TimelineEvent) {
    setTimelineSeed(event);
    setMessages((current) => [...current, { role: "assistant", text: `I prepared “${event.title}” as an investigation candidate. Its correlations remain leads until the evidence gate tests them.` }]);
  }

  async function routeContextInvestigation(concern: string) {
    if (personalWorkspace && user) {
      onCreateInvestigation(concern, {
        workspaceId,
        idToken: await user.getIdToken(),
      });
      return;
    }
    onCreateInvestigation(concern);
  }

  const assistant = (
    <AssistantPanel
      messages={messages}
      question={context.readiness.next_best_question}
      value={chatValue}
      onValue={setChatValue}
      onSend={() => void sendChat()}
      busy={busy}
      user={user}
      onSignIn={() => void signIn()}
    />
  );

  if (view === "overview") {
    return (
      <main className="context-page">
        <section className="context-main">
          <div className="overview-heading">
            <div><span className="page-eyebrow"><Sparkles /> Evidence-linked business intelligence</span><h1>Your business, reconstructed.</h1><p>{context.value_proposition}</p></div>
            <div className="overview-actions">
              <Button variant="outline" onClick={() => onNavigate("forensics")}><FileChartColumn /> Inspect context</Button>
              <Button onClick={() => onNavigate("forensics")}><UploadCloud /> Add my business</Button>
            </div>
          </div>

          <section className="overview-stat-grid">
            <article><div><span>Context readiness</span><strong>{context.readiness.score}%</strong></div><Badge variant="outline" className="mint-badge"><Check /> {humanize(context.readiness.status)}</Badge><p>{context.readiness.ready_scopes.length} investigation scopes ready</p></article>
            <article><div><span>Primary model</span><strong>{humanize(context.classification.primary_model)}</strong></div><Badge variant="outline">+{context.classification.secondary_models.length} hybrid</Badge><p>{context.classification.revenue_models.join(" · ")}</p></article>
            <article><div><span>Evidence sources</span><strong>{context.evidence_sources.length}</strong></div><Badge variant="outline" className="mint-badge">Read only</Badge><p>Business, revenue, product, growth, customer, operations</p></article>
            <article><div><span>Active investigation</span><strong>PL-0047</strong></div><Badge variant="outline" className="coral-badge">Revenue risk</Badge><p>Mobile checkout progression</p></article>
          </section>

          <section className="overview-body-grid">
            <HistoryTimeline context={context} onInvestigate={selectTimelineInvestigation} />
            <article className="priority-card">
              <div className="card-heading-row"><div><span className="section-kicker">Priority investigations</span><h2>What deserves attention now</h2></div><button type="button">See all</button></div>
              <button type="button" className="priority-item urgent" onClick={onOpenPreparedIncident}><span><CircleAlert /></span><div><strong>Checkout conversion break</strong><p>Mobile Safari fell 38% after release v1.8.4.</p><em>Prepared incident · 4 evidence units</em></div><ChevronRight /></button>
              <button type="button" className="priority-item" onClick={() => timelineSeed && void routeContextInvestigation(timelineSeed.title)}><span><Network /></span><div><strong>{timelineSeed?.title ?? "Annual-plan adoption"}</strong><p>{timelineSeed?.before_after ?? "Plan mix changed after pricing was introduced."}</p><em>Ranked lead · requires investigation</em></div><ChevronRight /></button>
              <button type="button" className="priority-item" onClick={() => onNavigate("forensics")}><span><Database /></span><div><strong>Cash-flow context is incomplete</strong><p>Add accounting evidence before asking runway questions.</p><em>Readiness RED for finance scope</em></div><ChevronRight /></button>
            </article>
          </section>

          <section className="engine-overview-card">
            <div className="card-heading-row"><div><span className="section-kicker">Primary economic engine</span><h2>How Northstar creates and retains value</h2></div><Badge variant="outline">{humanize(context.classification.stage)}</Badge></div>
            <div className="engine-flow">{context.economic_engine.map((stage, index) => <div key={stage.order}><article><span>{String(stage.order).padStart(2, "0")}</span><strong>{stage.name}</strong><p>{stage.description}</p></article>{index < context.economic_engine.length - 1 && <ArrowRight />}</div>)}</div>
          </section>

          <section className="overview-bottom-grid">
            <article className="readiness-card">
              <div className="readiness-ring" style={{ "--readiness": `${context.readiness.score * 3.6}deg` } as React.CSSProperties}><span>{context.readiness.score}%</span></div>
              <div><span className="section-kicker">Business Context Gate</span><h3>{context.readiness.reason}</h3><div className="scope-pills">{context.readiness.ready_scopes.map((scope) => <em key={scope}><Check /> {humanize(scope)}</em>)}{context.readiness.blocked_scopes.map((scope) => <em className="blocked" key={scope}><X /> {humanize(scope)}</em>)}</div></div>
            </article>
            <article className="framework-card"><div><Layers3 /><span>Framework Router</span></div>{context.selected_frameworks.map((framework) => <section key={framework.framework}><strong>{framework.framework}</strong><p>{framework.purpose}</p><em>{framework.trigger_evidence_ids.length} trigger sources</em></section>)}<button type="button" onClick={() => { onNavigate("forensics"); setStep("engine"); }}>Why these frameworks? <ArrowRight /></button></article>
          </section>
        </section>
        {assistant}
      </main>
    );
  }

  if (view === "ledger") {
    return (
      <main className="context-page">
        <section className="context-main">
          <div className="overview-heading"><div><span className="page-eyebrow"><GitBranch /> Business memory</span><h1>Proof Ledger</h1><p>Verified outcomes change the standards and splitter used next time.</p></div></div>
          <article className="ledger-feature">
            <div className="ledger-status"><CheckCircle2 /> Intervention validated</div>
            <span>PL-0047 · Mobile checkout regression</span>
            <h2>Revenue-critical interface releases must pass mobile Safari regression checks before full rollout.</h2>
            <p>The rollback cohort recovered 16.8% while guardrails passed. ProofLoop updated the release standard and will prioritize product and operations evidence when a browser-specific revenue anomaly follows a release.</p>
            <div><em>Standard updated</em><strong>Frontend release readiness</strong><em>New control</em><strong>Safari regression gate</strong><em>Monitoring</em><strong>Segment conversion after every release</strong></div>
            <Button onClick={onOpenPreparedIncident}>Open full investigation <ExternalLink /></Button>
          </article>
          <section className="ledger-chain"><span>Incident</span><ArrowRight /><span>Supported cause</span><ArrowRight /><span>Guarded action</span><ArrowRight /><span>Measured outcome</span><ArrowRight /><span>Derived constraint</span></section>
        </section>
        {assistant}
      </main>
    );
  }

  return (
    <main className="context-page">
      <section className="context-main forensics-main">
        <div className="forensics-heading">
          <div><span className="page-eyebrow"><Search /> Business Forensics</span><h1>Show ProofLoop where your business lives.</h1><p>Connect, upload, or talk through what exists. The agent reconstructs the graph and asks only what matters next.</p></div>
          <Badge variant="outline" className={user ? "mint-badge" : "demo-badge"}>{user ? "Personal workspace" : "Demo workspace"}</Badge>
        </div>

        {!firebaseConfigured && <div className="configuration-note"><CircleAlert /><span><strong>Personal workspaces need Firebase configuration.</strong> The Northstar demo remains fully available. Add the four NEXT_PUBLIC_FIREBASE variables in Vercel to enable sign-in.</span></div>}
        {error && <div className="request-error"><CircleAlert /><span>{error}</span></div>}

        <nav className="journey-stepper" aria-label="Business Forensics journey">
          {journey.map((item, index) => (
            <button key={item.id} type="button" className={`${step === item.id ? "active" : ""} ${index < activeStepIndex ? "complete" : ""}`} onClick={() => setStep(item.id)}>
              <span>{index < activeStepIndex ? <Check /> : index + 1}</span><em>{item.label}</em>
            </button>
          ))}
        </nav>

        {step === "evidence" && (
          <section className="forensics-stage">
            <div className="stage-title"><div><span>01 · Connect / import</span><h2>Start with evidence, not answers.</h2><p>Demo integrations are clearly labelled. Personal uploads are extracted on the server and retained only in this browser.</p></div><Badge variant="outline"><ShieldCheck /> Read-only by default</Badge></div>
            <div className="evidence-intake-grid">
              <article className="upload-card">
                <div className="upload-icon"><UploadCloud /></div><h3>Upload what already exists</h3><p>PDF, CSV, XLSX, TXT, Markdown, DOCX, or PPTX · 10 MB each</p>
                <label className="drop-zone"><input type="file" multiple accept=".pdf,.csv,.xlsx,.txt,.md,.docx,.pptx" onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} /><Paperclip /><strong>Choose evidence files</strong><span>Originals stay in your browser for future re-analysis</span></label>
                {selectedFiles.length > 0 && <div className="selected-files">{selectedFiles.map((file) => <span key={`${file.name}-${file.size}`}><FileText /> <strong>{file.name}</strong><em>{(file.size / 1024 / 1024).toFixed(2)} MB</em><button type="button" onClick={() => setSelectedFiles((files) => files.filter((item) => item !== file))}><X /></button></span>)}</div>}
              </article>
              <article className="website-card"><div><Globe2 /><span>Public website evidence</span></div><h3>Import your website or pricing page</h3><p>ProofLoop reads one public HTTPS page and records its provenance.</p><label><span>Public URL</span><input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://yourbusiness.com/pricing" /></label><Button variant="outline" disabled={!websiteUrl.trim() && !selectedFiles.length || busy} onClick={() => void callContextAgent({ includeSelectedEvidence: true })}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Extract and review</Button></article>
            </div>

            <article className="source-library">
              <div className="card-heading-row"><div><span className="section-kicker">Data sources</span><h2>Evidence library</h2></div><label className="source-search"><Search /><input value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} placeholder="Search sources" /></label></div>
              <div className="source-filters"><button type="button" className={sourceDomain === "all" ? "active" : ""} onClick={() => setSourceDomain("all")}>All</button>{(Object.keys(evidenceCatalog) as EvidenceDomain[]).map((domain) => <button type="button" key={domain} className={sourceDomain === domain ? "active" : ""} onClick={() => setSourceDomain(domain)}>{humanize(domain)}</button>)}</div>
              <div className="source-grid">{filteredSources.map(({ domain, name }) => {
                const demo = demoAvailable.has(name);
                const connected = connectedDemoSources.includes(name) || context.evidence_sources.some((source) => source.name.toLowerCase().includes(name.toLowerCase()));
                return <article key={`${domain}-${name}`}><div className={`source-logo source-${domain}`}><Database /></div><div><strong>{name}</strong><span>{humanize(domain)} evidence</span></div><Badge variant="outline" className={connected ? "mint-badge" : demo ? "demo-badge" : "coming-badge"}>{connected ? "Connected" : demo ? "Demo" : "Coming soon"}</Badge><button type="button" disabled={!demo || connected} onClick={() => setConnectedDemoSources((items) => [...items, name])}>{connected ? <Check /> : demo ? <PlugZap /> : <LockKeyhole />}</button></article>;
              })}</div>
            </article>
          </section>
        )}

        {step === "history" && <section className="forensics-stage"><div className="stage-title"><div><span>02 · Reconstruct history</span><h2>Build the trajectory before explaining a change.</h2><p>Metrics, releases, campaigns, pricing, suppliers, platforms, customer events, and external events share one evidence-linked timeline.</p></div><Badge variant="outline">Chart + table</Badge></div><HistoryTimeline context={context} onInvestigate={selectTimelineInvestigation} /></section>}

        {step === "model" && (
          <section className="forensics-stage">
            <div className="stage-title"><div><span>03 · Classify and confirm</span><h2>A hybrid business model, supported by evidence.</h2><p>Gemini proposes the most reliable interpretation. You approve material claims and conflicts.</p></div><Badge variant="outline" className={context.classification.founder_confirmed ? "mint-badge" : "demo-badge"}>{context.classification.founder_confirmed ? "Founder confirmed" : "Review required"}</Badge></div>
            <div className="classification-grid"><article><span>Primary model</span><h3>{humanize(context.classification.primary_model)}</h3><p>{context.value_proposition}</p></article><article><span>Secondary models</span><h3>{context.classification.secondary_models.map(humanize).join(" · ") || "None confirmed"}</h3><p>Hybrid classifications remain editable.</p></article><article><span>Revenue models</span><h3>{context.classification.revenue_models.map(humanize).join(" · ") || "Unknown"}</h3><p>Stage: {humanize(context.classification.stage)}</p></article></div>
            <article className="claim-review"><div className="card-heading-row"><div><span className="section-kicker">Material inference review</span><h2>{pendingClaims.length ? `${pendingClaims.length} claims need your decision` : "All material claims are resolved"}</h2></div>{pendingClaims.length > 0 && <Button onClick={() => void applyClaimReview()} disabled={busy || Object.keys(claimDecisions).length < pendingClaims.length}>Apply review <ArrowRight /></Button>}</div>{pendingClaims.length ? pendingClaims.map((claim) => <section key={claim.claim_id}><div><Badge variant="outline">{humanize(claim.domain)}</Badge><strong>{claim.claim}</strong><span>{claim.source_locator} · {humanize(claim.reliability)} reliability</span></div><div><button type="button" className={claimDecisions[claim.claim_id] === "confirmed" ? "confirm active" : "confirm"} onClick={() => setClaimDecisions((items) => ({ ...items, [claim.claim_id]: "confirmed" }))}><Check /> Confirm</button><button type="button" className={claimDecisions[claim.claim_id] === "rejected" ? "reject active" : "reject"} onClick={() => setClaimDecisions((items) => ({ ...items, [claim.claim_id]: "rejected" }))}><X /> Reject</button></div></section>) : context.claims.map((claim) => <section key={claim.claim_id}><div><Badge variant="outline" className="mint-badge"><Check /> Confirmed</Badge><strong>{claim.claim}</strong><span>{claim.source_locator} · Sources {claim.source_ids.join(", ")}</span></div></section>)}</article>
            {context.conflicts.map((conflict) => <article className="conflict-card" key={conflict.conflict_id}><div><CircleAlert /><span>Conflicting evidence · founder approval required</span></div><section><article><em>Gemini’s provisional selection</em><strong>{conflict.preferred_claim}</strong><span>{conflict.preferred_source_ids.join(", ")}</span></article><article><em>Alternative claim</em><strong>{conflict.alternative_claim}</strong><span>{conflict.alternative_source_ids.join(", ")}</span></article></section><p>{conflict.selection_reason}</p></article>)}
          </section>
        )}

        {step === "engine" && (
          <section className="forensics-stage"><div className="stage-title"><div><span>04 · Map value and economics</span><h2>How value becomes revenue—and where it can break.</h2><p>Templates seed the map; evidence determines the actual stages and frameworks.</p></div><Badge variant="outline">{humanize(context.classification.primary_model)}</Badge></div><article className="engine-builder"><div className="engine-flow">{context.economic_engine.map((stage, index) => <div key={stage.order}><article><span>{stage.order}</span><strong>{stage.name}</strong><p>{stage.description}</p><em>{stage.metric_ids.length ? stage.metric_ids.map(humanize).join(" · ") : "Metric not mapped"}</em></article>{index < context.economic_engine.length - 1 && <ArrowRight />}</div>)}</div></article><article className="framework-router"><div className="card-heading-row"><div><span className="section-kicker">Framework Router</span><h2>Evidence selects the lens</h2></div><Badge variant="outline"><Sparkles /> {context.selected_frameworks.length} selected</Badge></div>{context.selected_frameworks.map((framework) => <section key={framework.framework}><div><Layers3 /><strong>{framework.framework}</strong></div><p>{framework.purpose}</p><span>Triggered by {framework.trigger_evidence_ids.join(" · ")}</span><em>{framework.excluded_alternatives.join(" · ")}</em></section>)}</article></section>
        )}

        {step === "operations" && <section className="forensics-stage"><div className="stage-title"><div><span>05 · Map the operating system</span><h2>The symptom and root problem may live in different places.</h2><p>Processes, tools, owners, and dependencies are mapped behind the economic engine.</p></div><Badge variant="outline">{context.external_dependencies.length} dependencies</Badge></div><div className="operations-grid">{context.operating_system.map((area) => <article key={area.area}><div><span className={`source-logo source-${area.area === "revenue" ? "revenue" : area.area === "customer" ? "customers" : area.area === "acquisition" ? "growth" : area.area === "product" ? "product" : "operations"}`}><BriefcaseBusiness /></span><div><strong>{humanize(area.area)}</strong><em>{area.systems.join(" · ")}</em></div></div><p>{area.process_summary}</p><span>Dependencies</span><strong>{area.dependencies.join(" · ") || "No external dependency recorded"}</strong></article>)}</div></section>}

        {step === "baselines" && <section className="forensics-stage"><div className="stage-title"><div><span>06 · Establish standards</span><h2>Expected values with an explicit basis.</h2><p>History and founder targets come first. External benchmarks remain separately labelled context.</p></div><Badge variant="outline">No silent benchmarks</Badge></div><div className="baseline-grid">{context.metrics.map((metric) => <article key={metric.metric_id}><div><span>{metric.label}</span><strong>{formatMetric(metric)}</strong><Badge variant="outline">Level {metric.baseline_level}</Badge></div><p>{metric.expected_low == null ? "Expected range unknown" : `Expected ${metric.expected_low}–${metric.expected_high} ${metric.unit}`}</p><section><em>Basis</em><strong>{humanize(metric.standard_type)} · {metric.standard_basis}</strong><em>Evidence strength</em><strong>{humanize(metric.evidence_strength)}</strong><em>Volatility</em><strong>{metric.volatility}</strong><em>Seasonality</em><strong>{metric.seasonality}</strong></section></article>)}</div></section>}

        {step === "readiness" && <section className="forensics-stage"><div className="stage-title"><div><span>07 · Business Context Gate</span><h2>Ready where evidence is sufficient—not everywhere.</h2><p>The gate blocks only scopes that cannot yet distinguish normal behavior from an anomaly.</p></div><Badge variant="outline" className={context.readiness.status === "green" ? "mint-badge" : "coral-badge"}>{humanize(context.readiness.status)} · {context.readiness.score}%</Badge></div><div className="readiness-layout"><article className="readiness-summary"><div className="readiness-ring large" style={{ "--readiness": `${context.readiness.score * 3.6}deg` } as React.CSSProperties}><span>{context.readiness.score}%</span></div><h3>{context.readiness.reason}</h3><p>Next best question: {context.readiness.next_best_question}</p><Button onClick={() => setChatValue(context.readiness.next_best_question)}>Answer in chat <MessageCircleMore /></Button></article><article className="readiness-checks">{context.readiness.areas.map((area) => <section key={area.area}><span className={area.status}><Check /></span><div><strong>{humanize(area.area)}</strong><p>{area.reason}</p>{area.missing_evidence.map((missing) => <em key={missing}>{missing}</em>)}</div></section>)}</article></div><div className="scope-gates"><article><span>Ready scopes</span>{context.readiness.ready_scopes.map((scope) => <em key={scope}><Check /> {humanize(scope)}</em>)}</article><article><span>Blocked scopes</span>{context.readiness.blocked_scopes.map((scope) => <em key={scope}><LockKeyhole /> {humanize(scope)}</em>)}</article></div><div className="readiness-actions"><Button variant="outline" onClick={onOpenPreparedIncident}>Open prepared incident</Button><Button disabled={context.readiness.status !== "green"} onClick={() => void routeContextInvestigation("Investigate the highest-priority anomaly in this business context.")}>Route a new investigation <ArrowRight /></Button></div></section>}

        <div className="journey-footer"><Button variant="outline" disabled={activeStepIndex === 0} onClick={() => setStep(journey[Math.max(0, activeStepIndex - 1)].id)}><ChevronLeft /> Previous</Button><span>{activeStepIndex + 1} of {journey.length}</span><Button disabled={activeStepIndex === journey.length - 1} onClick={() => setStep(journey[Math.min(journey.length - 1, activeStepIndex + 1)].id)}>Continue <ChevronRight /></Button></div>
      </section>
      {assistant}
    </main>
  );
}
