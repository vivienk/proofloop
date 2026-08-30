"use client";

import { BrainCircuit, ChevronDown, GitBranch, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ProductView = "overview" | "forensics" | "investigations" | "ledger";

export function ProductNav({
  active,
  onNavigate,
  onAddBusiness,
  userLabel = "Demo workspace",
}: {
  active: ProductView;
  onNavigate: (view: ProductView) => void;
  onAddBusiness: () => void;
  userLabel?: string;
}) {
  const items: Array<{ id: ProductView; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "forensics", label: "Business Forensics" },
    { id: "investigations", label: "Investigations" },
    { id: "ledger", label: "Proof Ledger" },
  ];

  return (
    <header className="product-nav">
      <button className="product-brand" type="button" onClick={() => onNavigate("overview")}>
        <span className="product-brand-mark"><GitBranch /></span>
        <span>ProofLoop</span>
        <em>AI</em>
      </button>

      <nav aria-label="Primary navigation">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? "active" : ""}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="product-nav-actions">
        <span className="model-chip"><Sparkles /> Gemini + ADK</span>
        <Button variant="outline" onClick={onAddBusiness}><Plus /> Add my business</Button>
        <button type="button" className="workspace-identity" onClick={() => onNavigate("overview")}>
          <span><BrainCircuit /></span>
          <div><strong>Northstar Studio</strong><em>{userLabel}</em></div>
          <ChevronDown />
        </button>
      </div>
    </header>
  );
}
