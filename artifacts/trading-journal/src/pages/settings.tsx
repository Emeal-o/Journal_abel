import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight, ChevronDown,
  SlidersHorizontal, Info, LogOut, HelpCircle, Bug,
  Home, BarChart3, Type, Zap, Palette, Check, User, Calculator,
} from "lucide-react";
import { ManageSetupTypesModal } from "@/components/manage-setup-types-modal";
import { useSetupTypes } from "@/lib/setup-types-api";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import {
  useDisplayPrefs,
  type LandingPage, type StatDisplay, type FontSizePref, type ThemePref,
} from "@/hooks/use-display-prefs";
import { APP_SETTINGS_QUERY_KEY, getAppSettings } from "@/lib/app-settings-api";
import {
  PROFILE_QUERY_KEY,
  getProfile,
  updateProfile,
} from "@/lib/profile-api";

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

function ProfileRow({ nickname, onSaved }: { nickname: string | null; onSaved: (nickname: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(nickname ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setValue(nickname ?? "");
  }, [nickname, open]);

  const saveMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => {
      onSaved(profile.nickname);
      setValue(profile.nickname ?? "");
      setError(null);
      setOpen(false);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save nickname.");
    },
  });

  function handleSave() {
    saveMutation.mutate(value);
  }

  return (
    <>
      <ChevronRow
        icon={<User className="w-5 h-5" />}
        label="Nickname"
        valueParts={
          <span className="text-xs text-muted-foreground/50 font-mono">
            {nickname || "Not set"}
          </span>
        }
        onClick={() => {
          setError(null);
          setOpen((current) => !current);
        }}
        isOpen={open}
        last={!open}
      />
      {open && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              aria-label="Nickname"
              maxLength={40}
              autoFocus
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSave();
              }}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              disabled={saveMutation.isPending}
              placeholder="Enter a nickname"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <p className="mt-2 text-[10px] font-mono text-muted-foreground/50">Up to 40 characters. Leave blank to clear.</p>
        </div>
      )}
    </>
  );
}

// ── About expanded panel ───────────────────────────────────────────────────────

function AboutPanel({ settings, isLoading, isError }: {
  settings?: Awaited<ReturnType<typeof getAppSettings>>;
  isLoading: boolean;
  isError: boolean;
}) {
  const creditLine = settings?.credit_line;

  return (
    <div className="px-4 pb-5 pt-3 space-y-3 font-mono border-t border-white/[0.06]">
      {/* Gradient accent bar — blue-to-teal, matching PWA icon sparkline mark */}
      <div className="h-[2px] w-16 rounded-full bg-gradient-to-r from-blue-500 to-teal-400" />

      {isLoading && (
        <p className="text-xs text-muted-foreground animate-pulse">Loading About…</p>
      )}

      {isError && (
        <p className="text-xs text-destructive">Failed to load About content.</p>
      )}

      {settings && (
        <>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white tracking-tight">TradeOps</p>
            <p className="text-xs text-muted-foreground">Version {settings.version}</p>
          </div>

          <p className="text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-line">
            {settings.tagline}
          </p>
          <p className="text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-line">
            {settings.description}
          </p>
          <p className="text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-line">
            {settings.honesty_note}
          </p>
        </>
      )}

      {creditLine && (
        <p className="text-xs text-muted-foreground/50 pt-1">{creditLine}</p>
      )}
    </div>
  );
}

function PrivacyPolicyPanel({ settings, isLoading, isError }: {
  settings?: Awaited<ReturnType<typeof getAppSettings>>;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <div className="border-t border-white/[0.06] px-4 pb-5 pt-3 font-mono">
      <div className="h-[2px] w-16 rounded-full bg-gradient-to-r from-blue-500 to-teal-400 mb-3" />
      {isLoading && <p className="text-xs text-muted-foreground animate-pulse">Loading Privacy Policy…</p>}
      {isError && <p className="text-xs text-destructive">Failed to load Privacy Policy.</p>}
      {settings && (
        <p className="text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-line">
          {settings.privacy_policy}
        </p>
      )}
    </div>
  );
}

const FAQ_ITEMS = [
  {
    question: "Why am I rate-limited?",
    answer:
      "TradeOps uses a burst guard of 5 trades or weeks per 60 seconds and daily soft caps of 150 trades and 30 weeks per 24 hours. These limits help prevent accidental spam while still allowing legitimate bulk backfilling.",
  },
  {
    question: "Why does RRR show a positive number even on losses?",
    answer:
      "RRR always reflects the planned setup risk-reward ratio, not the outcome. A losing trade still had a real planned ratio when you entered it.",
  },
  {
    question: "What do the win rate colors mean?",
    answer:
      "The six-tier scale runs from red for the lowest win rates to cyan for the highest. A 40–50% win rate can be a legitimate profitable baseline for high-R:R strategies, so it is not automatically a bad result.",
  },
  {
    question: "Why do some stats show “<3” instead of a percentage?",
    answer:
      "It means there are fewer than 3 trades in that category. The sample is too small for a meaningful percentage.",
  },
  {
    question: "Why can’t I edit or delete archived trades/weeks?",
    answer:
      "Archived data is intentionally immutable to preserve an honest historical record. Genuine corrections are handled manually by the admin.",
  },
] as const;

function FaqPanel() {
  return (
    <div className="border-t border-white/[0.06] px-4 pb-5 pt-2 font-mono">
      <div className="divide-y divide-white/[0.06]">
        {FAQ_ITEMS.map((item) => (
          <div key={item.question} className="py-3 first:pt-2 last:pb-0">
            <p className="text-xs font-semibold text-white/90">{item.question}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/80">
              {item.answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportBugRow({ email, isLoading }: { email?: string; isLoading: boolean }) {
  const subject = encodeURIComponent("TradeOps Bug Report");
  const body = encodeURIComponent(
    "Describe what happened:\n\nSteps to reproduce:\n\n",
  );
  const href = email ? `mailto:${email}?subject=${subject}&body=${body}` : undefined;

  return (
    <a
      href={href}
      aria-disabled={!href}
      onClick={(event) => {
        if (!href) event.preventDefault();
      }}
      className={[
        "w-full flex items-center gap-3 min-h-[44px] px-4 py-3",
        "font-mono text-sm text-foreground/80 hover:text-white transition-colors",
        !href ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      <span className="flex-shrink-0 text-muted-foreground/40">
        <Bug className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">Report a Bug</span>
      <span className="text-xs text-muted-foreground/50">
        {isLoading ? "Loading…" : email ? "Email" : "Unavailable"}
      </span>
    </a>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [setupTypesOpen, setSetupTypesOpen] = useState(false);
  const [aboutOpen, setAboutOpen]           = useState(false);
  const [faqOpen, setFaqOpen]               = useState(false);
  const [privacyOpen, setPrivacyOpen]       = useState(false);

  const { data: setupTypes = [] } = useSetupTypes();
  const aboutQuery = useQuery({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: getAppSettings,
  });
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const prefs = useDisplayPrefs();
  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: getProfile,
  });

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
  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: "current", label: "Current" },
    { value: "amoled",  label: "AMOLED"  },
    { value: "dim",     label: "Dim"     },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Settings</h1>

      {/* ── Profile ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader>Profile</SectionHeader>
        <SettingsCard>
          {profileQuery.isLoading ? (
            <div className="min-h-[44px] px-4 py-3 text-sm font-mono text-muted-foreground/50">Loading…</div>
          ) : profileQuery.isError ? (
            <div className="min-h-[44px] px-4 py-3 text-sm font-mono text-destructive">Failed to load profile.</div>
          ) : (
            <ProfileRow
              nickname={profileQuery.data?.nickname ?? null}
              onSaved={(nickname) => {
                queryClient.setQueryData(PROFILE_QUERY_KEY, {
                  id: profileQuery.data?.id ?? 0,
                  nickname,
                });
              }}
            />
          )}
        </SettingsCard>
      </div>

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
          <SelectRow
            icon={<Palette className="w-5 h-5" />}
            label="Theme"
            value={prefs.theme}
            options={themeOptions}
            onSelect={prefs.setTheme}
            displayLabel={themeOptions.find((o) => o.value === prefs.theme)!.label}
          />
          <ToggleRow
            icon={<Calculator className="w-5 h-5" />}
            label="Show RR Calculator"
            checked={prefs.showRRCalculator}
            onCheckedChange={prefs.setShowRRCalculator}
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
          {aboutOpen && (
            <AboutPanel
              settings={aboutQuery.data}
              isLoading={aboutQuery.isLoading}
              isError={aboutQuery.isError}
            />
          )}
          <ChevronRow
            last={!privacyOpen}
            icon={<Info className="w-5 h-5" />}
            label="Privacy Policy"
            onClick={() => setPrivacyOpen((v) => !v)}
            isOpen={privacyOpen}
          />
          {privacyOpen && (
            <PrivacyPolicyPanel
              settings={aboutQuery.data}
              isLoading={aboutQuery.isLoading}
              isError={aboutQuery.isError}
            />
          )}
        </SettingsCard>
      </div>

      {/* ── Help ──────────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader>Help</SectionHeader>
        <SettingsCard>
          <ChevronRow
            last={!faqOpen}
            icon={<HelpCircle className="w-5 h-5" />}
            label="FAQ"
            onClick={() => setFaqOpen((v) => !v)}
            isOpen={faqOpen}
          />
          {faqOpen && <FaqPanel />}
          <ReportBugRow email={aboutQuery.data?.bug_report_email} isLoading={aboutQuery.isLoading} />
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
