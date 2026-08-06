import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { ManageSetupTypesModal } from "@/components/manage-setup-types-modal";
import { useSetupTypes } from "@/lib/setup-types-api";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

// ── Shared primitives ──────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-6 pb-1.5 text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-muted-foreground/50 select-none">
      {children}
    </p>
  );
}

interface RowProps {
  label: React.ReactNode;
  onClick: () => void;
  isOpen?: boolean;
  danger?: boolean;
  noChevron?: boolean;
}

function SettingsRow({ label, onClick, isOpen, danger, noChevron }: RowProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "group w-full flex items-center justify-between gap-3",
        "min-h-[44px] py-3 border-b border-border/20",
        "text-left font-mono text-sm transition-colors",
        "motion-reduce:transition-none",
        danger
          ? "text-destructive hover:text-destructive/80"
          : "text-foreground/80 hover:text-white",
      ].join(" ")}
    >
      <span className="flex items-center gap-3 min-w-0">{label}</span>
      {!noChevron && !danger && (
        isOpen
          ? <ChevronDown className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
      )}
    </button>
  );
}

// ── About panel ────────────────────────────────────────────────────────────────

function AboutPanel() {
  return (
    <div className="pb-4 pt-3 space-y-3 font-mono border-b border-border/20">
      {/* TODO: replace hardcoded content with GET /api/app-settings in Stage 1b */}

      {/* Gradient accent bar — blue-to-teal, matching PWA icon sparkline mark */}
      <div className="h-[2px] w-16 rounded-full bg-gradient-to-r from-blue-500 to-teal-400" />

      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-white tracking-tight">TradeOps</p>
        <p className="text-xs text-muted-foreground">Version 1.4</p>
      </div>

      <p className="text-xs text-muted-foreground/80 leading-relaxed">
        A private trading journal for logging, reviewing, and analyzing your trades over time.
      </p>
      <p className="text-xs text-muted-foreground/80 leading-relaxed">
        Track weekly performance, break down results by setup and direction, and see your long-term stats — win rate, R:R, drawdown, and more.
      </p>
      <p className="text-xs text-muted-foreground/80 leading-relaxed">
        This journal only works if it's honest — every entry relies on you logging your real trades.
      </p>
      <p className="text-xs text-muted-foreground/50 pt-1">Built by Emeal</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [setupTypesOpen, setSetupTypesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const { data: setupTypes = [] } = useSetupTypes();
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  async function handleLogout() {
    await logout();
    queryClient.clear();
  }

  const activeColors = setupTypes.filter((s) => s.active).map((s) => s.color);

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Settings</h1>

      {/* ── Preferences ─────────────────────────────────────────────────────── */}
      <SectionHeader>Preferences</SectionHeader>

      <SettingsRow
        label={
          <>
            {activeColors.length > 0 && (
              <span className="flex items-center gap-1 flex-shrink-0" aria-hidden>
                {activeColors.slice(0, 6).map((color, i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
            )}
            Manage Setup Types
          </>
        }
        onClick={() => setSetupTypesOpen(true)}
      />

      {/* ── Information ─────────────────────────────────────────────────────── */}
      <SectionHeader>Information</SectionHeader>

      <SettingsRow
        label="About"
        onClick={() => setAboutOpen((v) => !v)}
        isOpen={aboutOpen}
      />
      {aboutOpen && <AboutPanel />}

      {/* ── Danger zone — extra spacing so logout can't be tapped by accident ── */}
      <div className="mt-20">
        <SettingsRow
          label="Sign out"
          onClick={handleLogout}
          danger
          noChevron
        />
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      <ManageSetupTypesModal
        open={setupTypesOpen}
        onOpenChange={setSetupTypesOpen}
      />
    </div>
  );
}
