"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { BrainCircuit, History, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Send, Sparkles } from "lucide-react";

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

  const contextMessage = useMemo(() => {
    if (mode === "proofloop") return null;
    return {
      role: "assistant" as const,
      text: "Context view shows the high-level reasoning contract: what evidence was considered, what was ruled in or out, and which decision gate comes next.",
      meta: "Inspectable rationale · not private chain-of-thought",
    };
  }, [mode]);

  function sendMessage() {
    const message = value.trim();
    if (!message) return;
    setMessages((current) => [
      ...current,
      { role: "user", text: message },
      {
        role: "assistant",
        text: "I’ve added that as investigation context. Run or re-run the AI diagnosis to have Gemini incorporate it into the structured evidence record.",
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

  if (panelMode === "collapsed") {
    return (
      <aside className="investigation-agent is-collapsed" aria-label="ProofLoop investigation agent">
        <button type="button" aria-label="Open investigation agent" onClick={() => setPanelMode("docked")}>
          <PanelRightOpen />
          <span>Agent</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className={`investigation-agent is-${panelMode}`} aria-label="ProofLoop investigation agent">
      <div className="investigation-agent-bar">
        <div><span><Sparkles /></span><strong>ProofLoop agent</strong></div>
        <div>
          <button
            type="button"
            aria-label={panelMode === "expanded" ? "Restore agent width" : "Expand agent"}
            onClick={() => setPanelMode((current) => current === "expanded" ? "docked" : "expanded")}
          >
            {panelMode === "expanded" ? <Minimize2 /> : <Maximize2 />}
          </button>
          <button type="button" aria-label="Collapse agent" onClick={() => setPanelMode("collapsed")}><PanelRightClose /></button>
        </div>
      </div>

      <div className="investigation-agent-content">
        <div className="investigation-agent-hero">
          <span>Investigation copilot</span>
          <h2>What should we investigate next?</h2>
          <p>Challenge the diagnosis, add evidence, or inspect why ProofLoop selected a lens.</p>
        </div>

        <div className="investigation-agent-tabs" role="group" aria-label="Agent view">
          <button type="button" className={mode === "proofloop" ? "active" : ""} onClick={() => setMode("proofloop")}><BrainCircuit /> ProofLoop</button>
          <button type="button" className={mode === "context" ? "active" : ""} onClick={() => setMode("context")}><History /> Context</button>
        </div>

        <div className="investigation-chat-stream">
          {(contextMessage ? [...messages, contextMessage] : messages).map((message, index) => (
            <div key={`${message.role}-${index}-${message.text.slice(0, 16)}`} className={`investigation-chat-bubble ${message.role}`}>
              <span>{message.role === "assistant" ? <Sparkles /> : <strong>Y</strong>}</span>
              <div><p>{message.text}</p>{message.meta && <em>{message.meta}</em>}</div>
            </div>
          ))}
        </div>

        <div className="investigation-composer">
          <textarea
            ref={composerRef}
            value={value}
            rows={1}
            placeholder="Ask about evidence, hypotheses, or next action…"
            onChange={(event) => {
              setValue(event.target.value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={handleKeyDown}
          />
          <button type="button" aria-label="Send message" disabled={!value.trim()} onClick={sendMessage}><Send /></button>
        </div>

        <div className="investigation-agent-trust">Evidence selects the lens · Gemini + Google ADK</div>
      </div>
    </aside>
  );
}
