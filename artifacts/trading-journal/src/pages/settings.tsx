import { useState } from "react";
import {
  ChevronRight, ChevronDown,
  SlidersHorizontal, Info, LogOut,
  Home, BarChart3, Type, Zap, Check,
} from "lucide-react";
import { ManageSetupTypesModal } from "@/components/manage-setup-types-modal";
import { useSetupTypes } from "@/lib/setup-types-api";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import {
  useDisplayPrefs,
  type LandingPage, type StatDisplay, type FontSizePref,
} from "@/hooks/use-display-prefs";

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

// ── Standard chevron row (nav to modal or inline expand) ───────────────────────

interface ChevronRowProps {
  icon: React.ReactNode;
  label: string;
  valueParts?: React.ReactNode;
  onClick: () => void;
  isOpen?: boolean;
  last?: boolean;
}

function ChevronRow({ icon, label, valueParts, onClick, isOpen, last }: ChevronRowProps) {
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
      <span className="flex-shrink-0 text-muted-foreground/40">{icon}</span>
      <span className="flex-1 min-w-0">{label}</span>
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

// ── Select row — expands inline to show options ────────────────────────────────

interface SelectRowProps<T extends string> {
  icon: React.ReactNode;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
  displayLabel: string;   // shown as value preview (already computed by caller)
  last?: boolean;
}

function SelectRow<T extends string>({
  icon, label, value, options, onSelect, displayLabel, last,
}: SelectRowProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ChevronRow
        icon={icon}
        label={label}
        isOpen={open}
        last={!open && last}
        valueParts={
          <span className="text-xs text-muted-foreground/50 font-mono">{displayLabel}</span>
        }
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className={["border-t border-white/[0.06]", !last ? "border-b border-white/[0.06]" : ""].join(" ")}>
          {options.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => { onSelect(opt.value); setOpen(false); }}
              className={[
                "w-full flex items-center justify-between gap-3 min-h-[44px] px-6 py-3",
                "font-mono text-sm transition-colors motion-reduce:transition-none",
                "hover:bg-white/[0.03]",
                opt.value === value ? "text-white" : "text-muted-foreground/60",
                i < options.length - 1 ? "border-b border-white/[0.04]" : "",
              ].join(" ")}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── Toggle row — switch on the right ──────────────────────────────────────────

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  last?: boolean;
}

function ToggleRow({ icon, label, checked, onCheckedChange, last }: ToggleRowProps) {
  return (
    <div
      className={[
        "w-full flex items-center gap-3 min-h-[44px] px-4 py-3",
        "font-mono text-sm text-foreground/80",
        !last ? "border-b border-white/[0.06]" : "",
      ].join(" ")}
    >
      <span className="flex-shrink-0 text-muted-foreground/40">{icon}</span>
      <span className="flex-1 min-w-0">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

// ── About expanded panel ───────────────────────────────────────────────────────

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
  const [aboutOpen, setAboutOpen]           = useState(false);

  const { data: setupTypes = [] } = useSetupTypes();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const prefs = useDisplayPrefs();

  async function handleLogout() {
    await logout();
    queryClient.clear();
  }

  const active       = setupTypes.filter((s) => s.active);
  const activeColors = active.map((s) => s.color);

  const landingOptions: { value: LandingPage; label: string }[] = [
    { value: "journal",  label: "Journal"  },
    { value: "analysis", label: "Analysis" },
  ];
  const statOptions: { value: StatDisplay; label: string }[] = [
    { value: "rrr",  label: "RRR"  },
    { value: "pips", label: "Pips" },
  ];
  const fontOptions: { value: FontSizePref; label: string }[] = [
    { value: "small",   label: "Small"   },
    { value: "default", label: "Default" },
    { value: "large",   label: "Large"   },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Settings</h1>

      {/* ── Preferences ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader>Preferences</SectionHeader>
        <SettingsCard>
          <ChevronRow
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

      {/* ── Display ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader>Display</SectionHeader>
        <SettingsCard>
          <SelectRow
            icon={<Home className="w-5 h-5" />}
            label="Default Landing Page"
            value={prefs.defaultLanding}
            options={landingOptions}
            onSelect={prefs.setDefaultLanding}
            displayLabel={landingOptions.find((o) => o.value === prefs.defaultLanding)!.label}
          />
          <SelectRow
            icon={<BarChart3 className="w-5 h-5" />}
            label="Default Stat Display"
            value={prefs.defaultStatDisplay}
            options={statOptions}
            onSelect={prefs.setDefaultStatDisplay}
            displayLabel={statOptions.find((o) => o.value === prefs.defaultStatDisplay)!.label}
          />
          <SelectRow
            icon={<Type className="w-5 h-5" />}
            label="Font Size"
            value={prefs.fontSize}
            options={fontOptions}
            onSelect={prefs.setFontSize}
            displayLabel={fontOptions.find((o) => o.value === prefs.fontSize)!.label}
          />
          <ToggleRow
            last
            icon={<Zap className="w-5 h-5" />}
            label="Reduce Motion"
            checked={prefs.reduceMotion}
            onCheckedChange={prefs.setReduceMotion}
          />
        </SettingsCard>
      </div>

      {/* ── Information ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader>Information</SectionHeader>
        <SettingsCard>
          <ChevronRow
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
