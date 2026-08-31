"use client";

import { useEffect } from "react";

const WEBSITE_CONNECTED_KEY = "proofloop-website-source-connected";
let websiteReviewPending = false;
let assistantMessageCountAtReview = 0;

function sourceName(card: HTMLElement) {
  return card.querySelector<HTMLElement>(":scope > div:nth-child(2) > strong")?.textContent?.trim()
    ?? card.querySelector<HTMLElement>("strong")?.textContent?.trim()
    ?? "";
}

function sourceDomain(card: HTMLElement) {
  const label = card.querySelector<HTMLElement>(":scope > div:nth-child(2) > span")?.textContent?.trim().toLowerCase() ?? "";
  return label.replace(/\s+evidence$/, "");
}

function websiteIsConnected() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WEBSITE_CONNECTED_KEY) === "true";
}

function setWebsiteConnected() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEBSITE_CONNECTED_KEY, "true");
}

function successfulWebsiteReviewCompleted() {
  if (!websiteReviewPending) return false;

  const assistantMessages = Array.from(document.querySelectorAll<HTMLElement>(".chat-bubble.assistant"));
  if (assistantMessages.length <= assistantMessageCountAtReview) return false;

  const newest = assistantMessages.at(-1);
  const meta = newest?.querySelector<HTMLElement>("em")?.textContent?.trim() ?? "";
  const text = newest?.querySelector<HTMLElement>("p")?.textContent?.trim() ?? "";
  const hasContextResult = /^Context v\d+/i.test(meta) || /reconstruct|reviewed|business context/i.test(text);
  const hasVisibleError = Boolean(document.querySelector(".request-error"));

  if (hasContextResult && !hasVisibleError) {
    websiteReviewPending = false;
    setWebsiteConnected();
    return true;
  }

  return false;
}

function reorderPrioritySources(grid: HTMLElement) {
  const cards = Array.from(grid.querySelectorAll<HTMLElement>(":scope > article"));
  const byName = (name: string) => cards.find((card) => sourceName(card).toLowerCase() === name.toLowerCase());
  const strategy = byName("Strategy documents");
  const googleAds = byName("Google Ads");
  const ga4 = byName("GA4");

  if (strategy && googleAds && ga4) {
    strategy.after(googleAds, ga4);
  }
}

function syncSourceLibrary() {
  successfulWebsiteReviewCompleted();

  const grid = document.querySelector<HTMLElement>(".source-grid");
  if (!grid) return;

  const uploadInput = document.querySelector<HTMLInputElement>(".drop-zone input[type='file']");
  const websiteInput = document.querySelector<HTMLInputElement>(".website-card input");
  const websiteReviewButton = document.querySelector<HTMLButtonElement>(".website-card button");

  if (websiteReviewButton && !websiteReviewButton.dataset.proofloopWebsiteReview) {
    websiteReviewButton.dataset.proofloopWebsiteReview = "true";
    websiteReviewButton.addEventListener("click", () => {
      if (!websiteInput?.value.trim()) return;
      websiteReviewPending = true;
      assistantMessageCountAtReview = document.querySelectorAll(".chat-bubble.assistant").length;
    }, true);
  }

  grid.querySelectorAll<HTMLElement>(":scope > article").forEach((card) => {
    const name = sourceName(card);
    const domain = sourceDomain(card);
    const isWebsite = name.toLowerCase() === "website";
    const badge = card.querySelector<HTMLElement>("[data-slot='badge']");

    if (badge) {
      if (isWebsite && websiteIsConnected()) {
        badge.style.display = "inline-flex";
        badge.textContent = "Connected";
        badge.classList.add("mint-badge");
      } else {
        badge.style.display = "none";
      }
    }

    const action = card.querySelector<HTMLButtonElement>(":scope > button");
    if (!action) return;

    action.disabled = false;
    action.classList.add("source-action-button");
    action.setAttribute("aria-label", domain === "business" ? `Upload ${name}` : `Connect ${name}`);

    if (domain === "business") {
      action.textContent = "Upload";
      if (!action.dataset.proofloopUploadAction) {
        action.dataset.proofloopUploadAction = "true";
        action.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          uploadInput?.click();
        }, true);
      }
    } else {
      action.textContent = "Connect";
    }
  });

  reorderPrioritySources(grid);
}

export function SourceLibraryEnhancements() {
  useEffect(() => {
    syncSourceLibrary();
    const observer = new MutationObserver(syncSourceLibrary);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
