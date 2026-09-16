"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  CircleAlert,
  FilePlus2,
  LoaderCircle,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  X,
} from "lucide-react";

import { useInvestigationRun, type PendingEvidence } from "@/app/investigation-run-context";
import { getProofLoopIdToken } from "@/lib/firebase";

type ChatReply = {
  intent: "explain" | "challenge" | "falsify" | "new_evidence" | "out_of_scope";
  answer: string;
  cited_evidence_ids: string[];
  uncertainty: string;
  pending_evidence: Omit<PendingEvidence, "id"> | null;
  suggested_questions: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  reply?: ChatReply;
  grounding?: { status: "grounded" | "partially_grounded" | "ungrounded"; rejected_evidence_ids: string[] };
  /** Client-only states. */
  failed?: boolean;
};

type ChatResponse = { run_id: string; messages: ChatMessage[]; remaining_messages: number };

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shorten(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

async function readError(response: Response) {
  try {
    const payload = await response.json();
    return payload?.detail?.message ?? payload?.detail ?? "The agent could not answer.";
  } catch {
    return "The agent could not answer.";
  }
}

export function InvestigationAgentPanel() {
  const run = useInvestigationRun();
  const [panelMode, setPanelMode] = useState<"docked" | "expanded" | "collapsed">("docked");
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const runId = run?.runId ?? null;
  const apiUrl = run?.apiUrl ?? "";
  const canAsk = Boolean(run && runId && apiUrl && !run.isRunning && remaining !== 0);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const token = await getProofLoopIdToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }, []);

  // Each run has its own conversation. Reload it whenever the run changes.
  useEffect(() => {
    setMessages([]);
    setRemaining(null);
    setHistoryError(null);
    if (!runId || !apiUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${apiUrl}/v1/investigations/${runId}/chat`, { headers: await authHeaders() });
        if (!response.ok) throw new Error(await readError(response));
        const payload = (await response.json()) as ChatResponse;
        if (cancelled) return;
        setMessages(payload.messages);
        setRemaining(payload.remaining_messages);
      } catch (error) {
        if (!cancelled) setHistoryError(error instanceof Error ? error.message : "Chat history could not load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, apiUrl, authHeaders]);

  useEffect(() => {
    const stream = streamRef.current;
    if (stream) stream.scrollTop = stream.scrollHeight;
  }, [messages, sending, run?.pendingEvidence.length]);

  const starterQuestions = useMemo(() => {
    if (!run) return [];
    const leading = run.hypotheses.find((item) => item.status === "supported") ?? run.hypotheses[0];
    const ruledOut = run.hypotheses.find((item) => item.status === "disproved");
    const questions: string[] = [];
    if (ruledOut) questions.push(`Why was "${shorten(ruledOut.text)}" ruled out?`);
    if (leading) questions.push(`What result would falsify "${shorten(leading.text)}"?`);
    questions.push(
      run.status === "awaiting_approval"
        ? "What is the weakest link in this diagnosis?"
        : "What evidence would unblock this investigation?",
    );
    return questions;
  }, [run]);

  async function sendMessage(text: string, retryId?: string) {
    const message = text.trim();
    if (!message || !canAsk || sending || !runId) return;
    const optimisticId = retryId ?? `local-${Date.now()}`;
    setMessages((current) => {
      const withoutRetry = current.filter((item) => item.id !== optimisticId);
      return [...withoutRetry, { id: optimisticId, role: "user", text: message }];
    });
    setValue("");
    if (composerRef.current) composerRef.current.style.height = "auto";
    setSending(true);
    try {
      const response = await fetch(`${apiUrl}/v1/investigations/${runId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const payload = (await response.json()) as ChatResponse;
      setMessages((current) => [...current.filter((item) => item.id !== optimisticId), ...payload.messages]);
      setRemaining(payload.remaining_messages);
    } catch (error) {
      setMessages((current) =>
        current.map((item) => (item.id === optimisticId ? { ...item, failed: true } : item)),
      );
      setHistoryError(error instanceof Error ? error.message : "The agent could not answer.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(value);
    }
  }

  const latestAssistantId = [...messages].reverse().find((item) => item.role === "assistant")?.id;
  const queuedClaims = new Set(run?.pendingEvidence.map((item) => item.claim) ?? []);

  let emptyState: { title: string; body: string } | null = null;
  if (!run || !apiUrl) {
    emptyState = {
      title: "Agent not connected",
      body: "Connect the ProofLoop API to question an investigation.",
    };
  } else if (!runId) {
    emptyState = {
      title: "Nothing to question yet",
      body: "Run the diagnosis first. I answer only from a completed investigation record, so every answer can cite its evidence.",
    };
  }

  return (
    <aside className={`context-assistant investigation-context-assistant is-${panelMode}`} aria-label="ProofLoop investigation agent">
      <div className="assistant-panel-bar">
        <div className="assistant-panel-identity">
          <span className="assistant-orb"><Sparkles /></span>
          <strong>ProofLoop agent</strong>
        </div>
        <div className="assistant-panel-controls">
          {panelMode === "collapsed" ? (
            <button type="button" aria-label="Open agent" onClick={() => setPanelMode("docked")}><PanelRightOpen /></button>
          ) : (
            <>
              <button
                type="button"
                aria-label={panelMode === "expanded" ? "Restore agent width" : "Expand agent"}
                onClick={() => setPanelMode((current) => (current === "expanded" ? "docked" : "expanded"))}
              >
                {panelMode === "expanded" ? <Minimize2 /> : <Maximize2 />}
              </button>
              <button type="button" aria-label="Collapse agent" onClick={() => setPanelMode("collapsed")}><PanelRightClose /></button>
            </>
          )}
        </div>
      </div>

      {panelMode !== "collapsed" && (
        <div className="assistant-content">
          {run?.runId && (
            <div className={`inv-run-status is-${run.status === "awaiting_approval" ? "confirmed" : "open"}`}>
              <strong>{run.incidentId}</strong>
              <span>
                {run.status === "awaiting_approval"
                  ? "Proof gate passed"
                  : `No cause confirmed${run.terminationState ? `: ${humanize(run.terminationState).toLowerCase()}` : ""}`}
              </span>
            </div>
          )}

          <div className="inv-stream" ref={streamRef} aria-live="polite">
            {emptyState ? (
              <div className="inv-empty">
                <h2>{emptyState.title}</h2>
                <p>{emptyState.body}</p>
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="inv-empty">
                    <h2>Question this investigation</h2>
                    <p>
                      Ask why something was ruled out, challenge a conclusion, or tell me something the record is missing.
                      I can explain the diagnosis, but only a re-run can change it.
                    </p>
                    <div className="inv-suggestions">
                      {starterQuestions.map((question) => (
                        <button key={question} type="button" disabled={!canAsk || sending} onClick={() => void sendMessage(question)}>
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div key={message.id} className={`inv-msg is-${message.role}${message.failed ? " is-failed" : ""}`}>
                    <span className="inv-msg-icon" aria-hidden="true">
                      {message.role === "assistant" ? <Sparkles /> : <UserRoundCheck />}
                    </span>
                    <div className="inv-msg-body">
                      <p>{message.text}</p>

                      {message.failed && (
                        <button type="button" className="inv-retry" onClick={() => void sendMessage(message.text, message.id)} disabled={sending}>
                          <RotateCcw /> Not sent. Retry
                        </button>
                      )}

                      {message.reply && message.reply.cited_evidence_ids.length > 0 && (
                        <div className="inv-cites" aria-label="Cited evidence">
                          {message.reply.cited_evidence_ids.map((evidenceId) => {
                            const item = run?.evidenceIndex[evidenceId];
                            return (
                              <details key={evidenceId} className="inv-cite">
                                <summary>{evidenceId}</summary>
                                <p>{item ? `${humanize(item.source)}: ${item.claim}` : "Cited from the investigation graph."}</p>
                              </details>
                            );
                          })}
                        </div>
                      )}

                      {message.grounding && message.grounding.status !== "grounded" && (
                        <p className="inv-grounding">
                          <CircleAlert />
                          {message.grounding.status === "ungrounded"
                            ? "No evidence from this run supports this answer. Treat it as interpretation."
                            : `Removed ${message.grounding.rejected_evidence_ids.length} citation${message.grounding.rejected_evidence_ids.length === 1 ? "" : "s"} that ${message.grounding.rejected_evidence_ids.length === 1 ? "isn't" : "aren't"} in this run.`}
                        </p>
                      )}

                      {message.reply?.uncertainty && <em>{message.reply.uncertainty}</em>}

                      {message.reply?.pending_evidence && (
                        <div className="inv-lead">
                          <span>New lead, not in this run</span>
                          <strong>{message.reply.pending_evidence.claim}</strong>
                          {message.reply.pending_evidence.suggested_source && (
                            <small>Verify in {message.reply.pending_evidence.suggested_source}</small>
                          )}
                          {queuedClaims.has(message.reply.pending_evidence.claim) ? (
                            <button type="button" disabled><ShieldCheck /> Queued for next run</button>
                          ) : (
                            <button type="button" onClick={() => message.reply?.pending_evidence && run?.addPendingEvidence(message.reply.pending_evidence)}>
                              <FilePlus2 /> Add to next run
                            </button>
                          )}
                        </div>
                      )}

                      {message.id === latestAssistantId && !sending && (message.reply?.suggested_questions.length ?? 0) > 0 && (
                        <div className="inv-suggestions">
                          {message.reply?.suggested_questions.map((question) => (
                            <button key={question} type="button" disabled={!canAsk} onClick={() => void sendMessage(question)}>
                              {question}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="inv-msg is-assistant is-thinking">
                    <span className="inv-msg-icon" aria-hidden="true"><LoaderCircle /></span>
                    <div className="inv-msg-body"><p>Checking the investigation record…</p></div>
                  </div>
                )}
              </>
            )}
          </div>

          {historyError && (
            <p className="inv-error" role="alert">
              <CircleAlert /> {historyError}
              <button type="button" aria-label="Dismiss" onClick={() => setHistoryError(null)}><X /></button>
            </p>
          )}

          {run && run.pendingEvidence.length > 0 && (
            <div className="inv-queue">
              <span>
                {run.pendingEvidence.length} lead{run.pendingEvidence.length === 1 ? "" : "s"} queued for the next run.
                Leads can shape hypotheses but never count as corroboration.
              </span>
              <ul>
                {run.pendingEvidence.map((item) => (
                  <li key={item.id}>
                    <p>{item.claim}</p>
                    <button type="button" aria-label={`Remove lead: ${item.claim}`} onClick={() => run.removePendingEvidence(item.id)}><X /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run?.isRunning && runId && (
            <p className="inv-note">A new run is in progress. Questions reopen when it finishes.</p>
          )}
          {remaining !== null && remaining <= 10 && (
            <p className="inv-note">
              {remaining === 0 ? "Question limit reached for this run. Re-run to continue." : `${Math.floor(remaining / 2)} questions left for this run.`}
            </p>
          )}

          <div className="chat-composer">
            <textarea
              ref={composerRef}
              value={value}
              disabled={!canAsk}
              onChange={(event) => {
                setValue(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 168)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={canAsk ? "Ask about evidence, hypotheses, or next action…" : "Run the diagnosis to ask questions"}
              maxLength={2000}
              rows={1}
              aria-label="Ask the investigation agent"
            />
            <div>
              <span />
              <button type="button" className="send" aria-label="Send message" disabled={!canAsk || sending || !value.trim()} onClick={() => void sendMessage(value)}>
                <Send />
              </button>
            </div>
          </div>
          <div className="assistant-trust"><ShieldCheck /> Answers cite this run&apos;s evidence. Only a re-run changes the diagnosis.</div>
        </div>
      )}
    </aside>
  );
}
