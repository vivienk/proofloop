"use client";

import { useEffect } from "react";

function sourceName(card: HTMLElement) {
  return card.querySelector<HTMLElement>(":scope > div:nth-child(2) > strong")?.textContent?.trim()
    ?? card.querySelector<HTMLElement>("strong")?.textContent?.trim()
    ?? "";
}

function sourceDomain(card: HTMLElement) {
  const label = card.querySelector<HTMLElement>(":scope > div:nth-child(2) > span")?.textContent?.trim().toLowerCase() ?? "";
  return label.replace(/\s+evidence$/, "");
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
  const grid = document.querySelector<HTMLElement>(".source-grid");
  if (!grid) return;

  const uploadInput = document.querySelector<HTMLInputElement>(".drop-zone input[type='file']");

  grid.querySelectorAll<HTMLElement>(":scope > article").forEach((card) => {
    const domain = sourceDomain(card);
    const badge = card.querySelector<HTMLElement>("[data-slot='badge']");
    if (badge) badge.style.display = "none";

    const action = card.querySelector<HTMLButtonElement>(":scope > button");
    if (!action) return;

    action.disabled = false;
    action.classList.add("source-action-button");
    action.setAttribute("aria-label", domain === "business" ? `Upload ${sourceName(card)}` : `Connect ${sourceName(card)}`);

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
