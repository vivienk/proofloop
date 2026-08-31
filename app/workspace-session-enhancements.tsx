"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";

const PENDING_CLASS = "proofloop-pending-business-session";
const PRIOR_BUBBLE_CLASS = "prior-business-session";
const PENDING_ROW_CLASS = "pending-business-row";

function railBusinessNames() {
  return new Set(
    Array.from(document.querySelectorAll<HTMLElement>(".rail-workspace-card > strong"))
      .map((node) => node.textContent?.trim().toLowerCase() ?? "")
      .filter(Boolean),
  );
}

function activeForensicsStep() {
  return document.querySelector<HTMLElement>(".journey-stepper button.active em")?.textContent?.trim() ?? "";
}

function ensureSessionWelcome() {
  const stream = document.querySelector<HTMLElement>(".chat-stream");
  if (!stream || stream.querySelector(".new-business-session-welcome")) return;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble assistant new-business-session-welcome";
  bubble.innerHTML = `
    <span aria-hidden="true">✦</span>
    <div>
      <p>New business session started. Add a website, upload evidence, or tell me what exists today.</p>
      <em>Fresh Business Forensics session</em>
    </div>
  `;
  stream.prepend(bubble);
}

export function WorkspaceSessionEnhancements() {
  const pending = useRef(false);
  const priorNames = useRef<Set<string>>(new Set());

  useEffect(() => {
    const startSession = () => {
      pending.current = true;
      priorNames.current = railBusinessNames();
      document.body.classList.add(PENDING_CLASS);

      document.querySelectorAll<HTMLElement>(".chat-bubble").forEach((bubble) => {
        bubble.classList.add(PRIOR_BUBBLE_CLASS);
      });

      document.querySelectorAll<HTMLInputElement>(".website-card input").forEach((input) => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });

      window.setTimeout(ensureSessionWelcome, 0);
    };

    const sync = () => {
      if (!pending.current) return;

      ensureSessionWelcome();

      document.querySelectorAll<HTMLElement>(".rail-workspace-row").forEach((row) => {
        const name = row.querySelector<HTMLElement>(".rail-workspace-card > strong")?.textContent?.trim().toLowerCase() ?? "";
        if (name && !priorNames.current.has(name)) row.classList.add(PENDING_ROW_CLASS);
      });

      if (activeForensicsStep().toLowerCase() === "history") {
        document.querySelectorAll(`.${PENDING_ROW_CLASS}`).forEach((row) => row.classList.remove(PENDING_ROW_CLASS));
        document.querySelector(".new-business-session-welcome")?.remove();
        document.body.classList.remove(PENDING_CLASS);
        pending.current = false;
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".rail-add-business")) startSession();
    };

    document.addEventListener("click", handleClick, true);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    sync();

    return () => {
      document.removeEventListener("click", handleClick, true);
      observer.disconnect();
      document.body.classList.remove(PENDING_CLASS);
    };
  }, []);

  return null;
}
