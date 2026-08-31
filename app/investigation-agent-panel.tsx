"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Bot,
  History,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";

type InvestigationChatMessage = {
  role: "assistant" | "user";
  text: string;
  meta?: string;
};

export function InvestigationAgentPanel() {
  const [mode, setMode] = useState<"proofloop" | "context">("proofloop");
  const [panelMode, setPanelMode] = useState<"docked" | "expanded" | "collapsed">("docked");
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<InvestigationChatMessage[]>([
    {
      role: "assistant",
      text: "I’m investigating this incident with evidence gates before recommending an action.",
      meta: "Detect → Investigate → Define → Act → Measure → Learn",
    },
    {
      role: "assistant",
      text: "Ask me to explain the current evidence, challenge a hypothesis, or tell me what additional signal I should consider.",
    },
  ]);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const visibleMessages = useMemo(() => {
    if (mode === "proofloop") return messages;
    return [
      ...messages,
      {
        role: "assistant" as const,
        text: "Context view shows the inspectable reasoning contract: which evidence was considered, which explanations were ruled in or out, and which decision gate comes next.",
        meta: "Inspectable rationale · not private chain-of-thought",
      },
    ];
  }, [messages, mode]);

  function sendMessage() {
    const message = value.trim();
    if (!message) return;
    setMessages((current) => [
      ...current,
      { role: "user", text: message },
      {
        role: "assistant",
        text: "I’ve added that as investigation context. Re-run the diagnosis when you want Gemini to incorporate it into the structured evidence record.",
        meta: "Founder-provided investigation context",
      },
    ]);
    setValue("");
    if (composerRef.current) composerRef.current.style.height = "auto";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
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
                onClick={() => setPanelMode((current) => current === "expanded" ? "docked" : "expanded")}
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
          <div className="assistant-hero">
            <span>Investigation agent</span>
            <h2>What should we investigate next?</h2>
            <p>Challenge the diagnosis, add evidence, or inspect why ProofLoop selected a lens.</p>
          </div>

          <div className="assistant-tabs">
            <button className={mode === "proofloop" ? "active" : ""} type="button" onClick={() => setMode("proofloop")}><Bot /> ProofLoop</button>
            <button className={mode === "context" ? "active" : ""} type="button" onClick={() => setMode("context")}><History /> Context</button>
          </div>

          <div className="chat-stream">
            {visibleMessages.map((message, index) => (
              <div key={`${message.role}-${index}-${message.text.slice(0, 18)}`} className={`chat-bubble ${message.role}`}>
                <span>{message.role === "assistant" ? <Sparkles /> : <UserRoundCheck />}</span>
                <div><p>{message.text}</p>{message.meta && <em>{message.meta}</em>}</div>
              </div>
            ))}
          </div>

          <div className="chat-composer">
            <textarea
              ref={composerRef}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 168)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about evidence, hypotheses, or next action…"
              rows={1}
            />
            <div>
              <button type="button" aria-label="Attach evidence"><Paperclip /></button>
              <button type="button" className="send" aria-label="Send message" disabled={!value.trim()} onClick={sendMessage}><Send /></button>
            </div>
          </div>
          <div className="assistant-trust"><ShieldCheck /> Evidence selects the lens · Gemini + Google ADK</div>
        </div>
      )}
    </aside>
  );
}
