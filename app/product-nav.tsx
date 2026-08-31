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
  Moon,
  Plus,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  firebaseConfigured,
  signInToProofLoop,
  signOutOfProofLoop,
  watchProofLoopUser,
  type User,
} from "@/lib/firebase";

export type ProductView = "overview" | "forensics" | "investigations" | "ledger";

type RailBusiness = {
  name: string;
  addedAt: number;
};

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

const RAIL_BUSINESSES_KEY = "proofloop-rail-businesses";

function loadRailBusinesses(): RailBusiness[] {
  if (typeof window === "undefined") return [{ name: "Northstar Studio", addedAt: 0 }];
  try {
    const raw = window.localStorage.getItem(RAIL_BUSINESSES_KEY);
    if (raw === null) return [{ name: "Northstar Studio", addedAt: 0 }];
    const stored = JSON.parse(raw) as RailBusiness[];
    return stored.filter((item) => typeof item?.name === "string" && item.name.trim());
  } catch {
    return [{ name: "Northstar Studio", addedAt: 0 }];
  }
}

function extractBusinessNameFromPage(): string | null {
  if (typeof document === "undefined") return null;

  const heading = document.querySelector<HTMLElement>(".overview-heading h1")?.textContent?.trim();
  if (heading && heading !== "Your business, reconstructed." && heading !== "Proof Ledger") return heading;

  const messages = Array.from(document.querySelectorAll(".chat-bubble.assistant p"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean)
    .reverse();

  for (const text of messages) {
    const reconstructed = text.match(/^I reconstructed (.+?)(?: from |\.|,)/i)?.[1]?.trim();
    if (reconstructed) return reconstructed;

    const remains = text.match(/^(.+?) remains (?:a|an) /i)?.[1]?.trim();
    if (remains && remains.length < 80) return remains;
  }

  return null;
}

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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [businesses, setBusinesses] = useState<RailBusiness[]>([{ name: "Northstar Studio", addedAt: 0 }]);
  const [activeBusiness, setActiveBusiness] = useState("Northstar Studio");
  const [businessToRemove, setBusinessToRemove] = useState<string | null>(null);

  useEffect(() => watchProofLoopUser(setUser), []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("proofloop-theme");
    const preferredTheme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = preferredTheme;
    setTheme(preferredTheme);
  }, []);

  useEffect(() => {
    setBusinesses(loadRailBusinesses());
    onNavigate("forensics");
  // The demo intentionally starts at Business Forensics once when the persistent nav mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sync = () => {
      const businessName = extractBusinessNameFromPage();
      if (!businessName || businessName === "My business") return;
      setActiveBusiness(businessName);
      setBusinesses((current) => {
        const alreadyKnown = current.some((item) => item.name.toLowerCase() === businessName.toLowerCase());
        const next = alreadyKnown
          ? current
          : [...current, { name: businessName, addedAt: Date.now() }];
        window.localStorage.setItem(RAIL_BUSINESSES_KEY, JSON.stringify(next));
        return next;
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("proofloop-business-reconstructed", sync as EventListener);
    return () => {
      observer.disconnect();
      window.removeEventListener("proofloop-business-reconstructed", sync as EventListener);
    };
  }, []);

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

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("proofloop-theme", nextTheme);
    setTheme(nextTheme);
  }

  function removeBusiness(name: string) {
    setBusinesses((current) => {
      const next = current.filter((item) => item.name.toLowerCase() !== name.toLowerCase());
      window.localStorage.setItem(RAIL_BUSINESSES_KEY, JSON.stringify(next));
      if (activeBusiness.toLowerCase() === name.toLowerCase()) {
        const fallback = next.at(-1)?.name ?? "";
        setActiveBusiness(fallback);
        onNavigate(fallback ? "overview" : "forensics");
      }
      return next;
    });
    setBusinessToRemove(null);
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

        <div className="rail-workspace-stack">
          {businesses.map((business) => {
            const isActive = business.name.toLowerCase() === activeBusiness.toLowerCase();
            return (
              <div className="rail-workspace-row" key={business.name}>
                <button
                  type="button"
                  className={`rail-workspace-card ${isActive ? "is-active-business" : "is-history-business"}`}
                  onClick={() => isActive && onNavigate("overview")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="rail-workspace-status"><i /> {isActive ? "Active" : "Previous"}</span>
                  <strong>{business.name}</strong>
                </button>
                <button
                  type="button"
                  className="rail-workspace-remove"
                  aria-label={`Remove ${business.name}`}
                  title={`Remove ${business.name}`}
                  onClick={() => setBusinessToRemove(business.name)}
                >
                  <Trash2 />
                </button>
              </div>
            );
          })}
          <button type="button" className="rail-add-business" onClick={onAddBusiness} aria-label="Add a business">
            <Plus /><strong>Add a business</strong>
          </button>
        </div>

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

        <div className="product-rail-bottom">
          <div className="account-menu-wrap rail-account-menu">
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
            {authError && <div className="product-auth-error" role="alert">{authError}</div>}
          </div>
          <div className="product-rail-footer">
            <span><ShieldCheck /> Read-only evidence access</span>
            <span><Sparkles /> Gemini + ADK</span>
          </div>
        </div>
      </aside>

      <header className="product-nav">
        <div className="product-section-title">
          <span>Business workspace</span>
          <strong>{activeLabel}</strong>
        </div>

        <div className="product-nav-actions">
          <span className="model-chip"><Sparkles /> Gemini + ADK</span>
          <button
            type="button"
            className="theme-toggle"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={theme === "dark"}
            onClick={toggleTheme}
          >
            <Sun />
            <span><i /></span>
            <Moon />
          </button>
        </div>
      </header>

      <AlertDialog open={Boolean(businessToRemove)} onOpenChange={(open) => !open && setBusinessToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><Trash2 /></AlertDialogMedia>
            <AlertDialogTitle>Remove this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              {businessToRemove ? `Remove ${businessToRemove} from the workspace list? This removes the saved rail entry from this browser.` : "Remove this workspace?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => businessToRemove && removeBusiness(businessToRemove)}>Remove workspace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
