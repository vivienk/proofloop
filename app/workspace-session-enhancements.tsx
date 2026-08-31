"use client";

import { useEffect, useRef } from "react";

const PENDING_CLASS = "proofloop-pending-business-session";
const PRIOR_BUBBLE_CLASS = "prior-business-session";
const PENDING_ROW_CLASS = "pending-business-row";
const ACTIVE_SESSION_KEY = "proofloop-active-business-session";

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

function createWorkspaceId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `business-session-${Date.now()}-${random}`;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function ensureSessionWelcome() {
  const stream = document.querySelector<HTMLElement>(".chat-stream");
  if (!stream || stream.querySelector(".new-business-session-welcome")) return;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble assistant new-business-session-welcome";

  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✦";

  const copy = document.createElement("div");
  const message = document.createElement("p");
  message.textContent = "New business session started. Add a website, upload evidence, or tell me what exists today.";
  const meta = document.createElement("em");
  meta.textContent = "Fresh Business Forensics session";
  copy.append(message, meta);
  bubble.append(icon, copy);
  stream.prepend(bubble);
}

export function WorkspaceSessionEnhancements() {
  const pending = useRef(false);
  const priorNames = useRef<Set<string>>(new Set());
  const activeWorkspaceId = useRef<string | null>(null);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const workspaceId = activeWorkspaceId.current;
      if (!workspaceId) return originalFetch(input, init);

      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      let nextInput: RequestInfo | URL = input;
      let nextInit = init;

      if (/\/v1\/business-contexts\/reconstruct(?:\?|$)/.test(requestUrl) && init?.body instanceof FormData) {
        const body = init.body;
        body.set("workspace_id", workspaceId);
        nextInit = { ...init, body };
      }

      if (/\/v1\/business-contexts\/[^/]+\/confirm(?:\?|$)/.test(requestUrl)) {
        const rewritten = requestUrl.replace(/\/v1\/business-contexts\/[^/]+\/confirm/, `/v1/business-contexts/${workspaceId}/confirm`);
        nextInput = typeof input === "string" ? rewritten : new URL(rewritten);
      }

      if (/\/v1\/diagnose(?:\?|$)/.test(requestUrl) && typeof init?.body === "string") {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          body.workspace_id = workspaceId;
          nextInit = { ...init, body: JSON.stringify(body) };
        } catch {
          // Preserve the original diagnostic request if the body is not JSON.
        }
      }

      return originalFetch(nextInput, nextInit);
    };

    const startSession = () => {
      const workspaceId = createWorkspaceId();
      activeWorkspaceId.current = workspaceId;
      window.sessionStorage.setItem(ACTIVE_SESSION_KEY, workspaceId);
      pending.current = true;
      priorNames.current = railBusinessNames();
      document.body.classList.add(PENDING_CLASS);

      document.querySelectorAll<HTMLElement>(".chat-bubble").forEach((bubble) => {
        bubble.classList.add(PRIOR_BUBBLE_CLASS);
      });

      const websiteInput = document.querySelector<HTMLInputElement>(".website-card input");
      if (websiteInput) setNativeInputValue(websiteInput, "");

      const fileInput = document.querySelector<HTMLInputElement>(".drop-zone input[type='file']");
      if (fileInput) fileInput.value = "";

      window.dispatchEvent(new CustomEvent("proofloop-new-business-session", {
        detail: { workspaceId },
      }));
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
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    sync();

    return () => {
      window.fetch = originalFetch;
      document.removeEventListener("click", handleClick, true);
      observer.disconnect();
      document.body.classList.remove(PENDING_CLASS);
    };
  }, []);

  return null;
}
