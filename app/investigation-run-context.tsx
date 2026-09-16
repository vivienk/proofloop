"use client";

import { createContext, useContext, type ReactNode } from "react";

export type PendingEvidence = {
  id: string;
  claim: string;
  suggested_source: string;
  relevant_hypotheses: string[];
};

export type InvestigationRunSnapshot = {
  apiUrl: string;
  runId: string | null;
  incidentId: string;
  /** Envelope status after Python's proof gate: awaiting_approval | needs_evidence. */
  status: string | null;
  terminationState: string | null;
  isRunning: boolean;
  evidenceIndex: Record<string, { source: string; claim: string }>;
  hypotheses: Array<{ text: string; status: string }>;
  pendingEvidence: PendingEvidence[];
  addPendingEvidence: (item: Omit<PendingEvidence, "id">) => void;
  removePendingEvidence: (id: string) => void;
};

const InvestigationRunContext = createContext<InvestigationRunSnapshot | null>(null);

export function InvestigationRunProvider({
  value,
  children,
}: {
  value: InvestigationRunSnapshot;
  children: ReactNode;
}) {
  return <InvestigationRunContext.Provider value={value}>{children}</InvestigationRunContext.Provider>;
}

export function useInvestigationRun() {
  return useContext(InvestigationRunContext);
}
