"use client";

import { useEffect, useState } from "react";
import {
  BookOpenCheck,
  BrainCircuit,
  ChevronDown,
  GitBranch,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  firebaseConfigured,
  signInToProofLoop,
  signOutOfProofLoop,
  watchProofLoopUser,
  type User,
} from "@/lib/firebase";

export type ProductView = "overview" | "forensics" | "investigations" | "ledger";

const items: Array<{
  id: ProductView;
  label: string;
  number: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", number: "⌂", icon: LayoutDashboard },
  { id: "forensics", label: "Business Forensics", number: "01", icon: ScanSearch },
  { id: "investigations", label: "Investigations", number: "02", icon: BrainCircuit },
  { id: "ledger", label: "Proof Ledger", number: "03", icon: BookOpenCheck },
];

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
  const [user, setUser] = useState<User | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => watchProofLoopUser(setUser), []);

  async function signIn() {
    setAuthError(null);
    try {
      await signInToProofLoop();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in could not start.");
    }
  }

  async function signOut() {
    setAccountOpen(false);
    await signOutOfProofLoop();
  }

  const activeLabel = items.find((item) => item.id === active)?.label ?? "Overview";
  const accountName = user?.displayName ?? user?.email ?? "Google account";
  const accountInitial = accountName.slice(0, 1).toUpperCase();

  return (
    <>
      <aside className="product-left-rail">
        <button className="product-brand" type="button" onClick={() => onNavigate("overview")}>
          <span className="product-brand-mark"><GitBranch /></span>
          <span><strong>ProofLoop</strong><em>Business diagnostic OS</em></span>
        </button>

        <button type="button" className="rail-workspace-card" onClick={() => onNavigate("overview")}>
          <span className="rail-workspace-status"><i /> Active workspace</span>
          <strong>Northstar Studio</strong>
          <em>{userLabel}</em>
        </button>

        <nav aria-label="Primary navigation">
          <span className="product-rail-kicker">Workspace</span>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={active === item.id ? "active" : ""}
                onClick={() => onNavigate(item.id)}
              >
                <span>{item.number}</span>
                <Icon />
                <strong>{item.label}</strong>
                {active === item.id && <i />}
              </button>
            );
          })}
        </nav>

        <div className="product-rail-footer">
          <span><ShieldCheck /> Read-only evidence access</span>
          <span><Sparkles /> Gemini + ADK</span>
        </div>
      </aside>

      <header className="product-nav">
        <div className="product-section-title">
          <span>Business workspace</span>
          <strong>{activeLabel}</strong>
        </div>

        <div className="product-nav-actions">
          <span className="model-chip"><Sparkles /> Gemini + ADK</span>
          <Button variant="outline" onClick={onAddBusiness}><Plus /> Add my business</Button>
          <div className="account-menu-wrap">
            {user ? (
              <>
                <button
                  type="button"
                  className="google-account-button"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((open) => !open)}
                >
                  <span>{accountInitial}</span>
                  <div><strong>{accountName}</strong><em>Google account</em></div>
                  <ChevronDown />
                </button>
                {accountOpen && (
                  <div className="account-popover">
                    <span>Signed in with Google</span>
                    <strong>{accountName}</strong>
                    <button type="button" onClick={() => void signOut()}><LogOut /> Sign out</button>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                className="google-signin-button"
                disabled={!firebaseConfigured}
                onClick={() => void signIn()}
              >
                <span>G</span><strong>Continue with Google</strong><LogIn />
              </button>
            )}
          </div>
        </div>
        {authError && <div className="product-auth-error" role="alert">{authError}</div>}
      </header>
    </>
  );
}
