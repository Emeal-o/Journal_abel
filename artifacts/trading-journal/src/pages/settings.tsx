import { useState } from "react";
import { ChevronRight, ChevronDown, SlidersHorizontal, Info, LogOut } from "lucide-react";
import { ManageSetupTypesModal } from "@/components/manage-setup-types-modal";
import { useSetupTypes } from "@/lib/setup-types-api";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

// ── Section label ──────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-2 text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-muted-foreground/50 select-none">
      {children}
    </p>
  );
}

// ── Grouped card container ─────────────────────────────────────────────────────

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {children}
    </div>
  );
}

// ── Individual row ─────────────────────────────────────────────────────────────

interface RowProps {
  icon: React.ReactNode;
  label: string;
  valueParts?: React.ReactNode;   // optional right-side preview before the chevron
  onClick: () => void;
  isOpen?: boolean;
  last?: boolean;                 // suppress bottom divider on the last row in a card
}

function SettingsRow({ icon, label, valueParts, onClick, isOpen, last }: RowProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "group w-full flex items-center gap-3 min-h-[44px] px-4 py-3 text-left",
        "font-mono text-sm text-foreground/80 hover:text-white",
        "transition-colors motion-reduce:transition-none",
        !last ? "border-b border-white/[0.06]" : "",
      ].join(" ")}
    >
      {/* Left icon */}
      <span className="flex-shrink-0 text-muted-foreground/40">{icon}</span>

      {/* Label */}
      <span className="flex-1 min-w-0">{label}</span>

      {/* Right: value preview + chevron */}
      <span className="flex items-center gap-2 flex-shrink-0">
        {valueParts}
        {isOpen
          ? <ChevronDown className="w-4 h-4 text-muted-foreground/30" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
        }
      </span>
    </button>
  );
}

// ── About expanded panel (lives inside the Information card) ───────────────────

function AboutPanel() {
  return (
    <div className="px-4 pb-5 pt-3 space-y-3 font-mono border-t border-white/[0.06]">
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
        Track weekly performance, break down results by setup and direction, and see your long-term
        stats — win rate, R:R, drawdown, and more.
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

  const active = setupTypes.filter((s) => s.active);
  const activeColors = active.map((s) => s.color);

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Settings</h1>

      {/* ── Preferences ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader>Preferences</SectionHeader>
        <SettingsCard>
          <SettingsRow
            last
            icon={<SlidersHorizontal className="w-5 h-5" />}
            label="Manage Setup Types"
            valueParts={
              <>
                {activeColors.length > 0 && (
                  <span className="flex items-center gap-0.5" aria-hidden>
                    {activeColors.slice(0, 5).map((color, i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                )}
                {active.length > 0 && (
                  <span className="text-xs text-muted-foreground/50 font-mono">
                    {active.length} active
                  </span>
                )}
              </>
            }
            onClick={() => setSetupTypesOpen(true)}
          />
        </SettingsCard>
      </div>

      {/* ── Information ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader>Information</SectionHeader>
        <SettingsCard>
          <SettingsRow
            last={!aboutOpen}
            icon={<Info className="w-5 h-5" />}
            label="About"
            onClick={() => setAboutOpen((v) => !v)}
            isOpen={aboutOpen}
          />
          {aboutOpen && <AboutPanel />}
        </SettingsCard>
      </div>

      {/* ── Sign out — separated far below so it can't be tapped by accident ── */}
      <div className="mt-20">
        <button
          onClick={handleLogout}
          className={[
            "w-full flex items-center gap-3 min-h-[44px] px-1 py-3",
            "font-mono text-sm text-destructive hover:text-destructive/80",
            "transition-colors motion-reduce:transition-none",
          ].join(" ")}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          Sign out
        </button>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      <ManageSetupTypesModal
        open={setupTypesOpen}
        onOpenChange={setSetupTypesOpen}
      />
    </div>
  );
}
