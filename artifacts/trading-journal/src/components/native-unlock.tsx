import { useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Activity, ArrowLeft, Delete, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { MeResponse } from "@/lib/auth-api";
import { login } from "@/lib/auth-api";
import {
  getNativeBiometricEnabled,
  getNativeUnlockMethod,
  hasSeenNativeUnlockOffer,
  markNativeUnlockOfferSeen,
  saveNativePassword,
  saveNativePin,
  setNativeBiometricEnabled,
  verifyNativePassword,
  verifyNativePin,
} from "@/lib/native-unlock";
import {
  isNativeBiometricAvailable,
  requestNativeBiometricUnlock,
} from "@/lib/native-biometric";

type SetupChoice = "pin" | "password" | "skip";
type SetupScreen = "choice" | "pin" | "password" | "biometric";

function NativeShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={`native-entry-shell min-h-[100dvh] w-full overflow-x-hidden bg-background text-foreground ${className}`}
    >
      {children}
    </main>
  );
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`native-brand-lockup ${compact ? "native-brand-lockup-compact" : ""}`}>
      <span className="native-brand-mark" aria-hidden="true">
        <Activity className="h-4 w-4 text-primary" strokeWidth={2} />
      </span>
      <span className="font-semibold tracking-tight">
        Trade<span className="text-primary">Ops</span>
      </span>
    </div>
  );
}

function MaskedLedgerInput({
  value,
  onChange,
  placeholder = "••••••••",
  autoFocus = false,
  ariaLabel,
  type = "text",
  onKeyDown,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel: string;
  type?: "text" | "password";
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
}) {
  return (
    <div className="native-ledger-input-wrap">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={placeholder}
        className="native-ledger-input"
      />
    </div>
  );
}

function PrimaryActionButton({
  children,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="native-primary-button w-full"
    >
      {children}
    </Button>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="native-screen-header">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="native-icon-button"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <span className="sr-only">{title}</span>
      <BrandLockup compact />
    </header>
  );
}

export function NativeAccessCodeScreen({ onAuthenticated }: { onAuthenticated: (me: MeResponse) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim() || pending) return;
    setError(null);
    setPending(true);
    try {
      const me = await login(code);
      const seen = await hasSeenNativeUnlockOffer();
      onAuthenticated({ ...me, ...(seen ? {} : { __showUnlockSetupOffer: true }) } as MeResponse & { __showUnlockSetupOffer?: boolean });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid access code.");
    } finally {
      setPending(false);
    }
  }

  return (
    <NativeShell className="native-auth-shell">
      <div className="native-auth-content">
        <BrandLockup />
        <p className="native-instruction">Enter your access code to open your journal.</p>
        <form onSubmit={handleSubmit} className="native-auth-form">
          <MaskedLedgerInput
            value={code}
            onChange={(value) => { setCode(value); setError(null); }}
            ariaLabel="Access code"
            placeholder="Enter access code"
            autoFocus
          />
          <PrimaryActionButton type="submit" disabled={pending || !code.trim()}>
            {pending ? "Opening…" : "Open journal"}
          </PrimaryActionButton>
          {error && <p className="native-inline-message" role="alert">{error}</p>}
        </form>
      </div>
      <p className="native-private-copy">Private access only</p>
    </NativeShell>
  );
}

export function NativeUnlockSetupOffer({
  onChoose,
  onBack,
  showBack = false,
}: {
  onChoose: (choice: SetupChoice) => void;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <NativeShell className="native-auth-shell">
      {showBack && onBack && <BackHeader title="Quick unlock" onBack={onBack} />}
      <div className={`native-auth-content native-flow-content ${showBack ? "native-flow-content-with-header" : ""}`}>
        {!showBack && <BrandLockup />}
        <p className="native-instruction">
          Add a PIN or password for quick unlock on this device? Your admin code will always still work.
        </p>
        <div className="native-action-stack">
          <PrimaryActionButton onClick={() => onChoose("pin")}>Set a PIN</PrimaryActionButton>
          <PrimaryActionButton onClick={() => onChoose("password")}>Set a password</PrimaryActionButton>
          <button type="button" className="native-muted-link" onClick={() => onChoose("skip")}>
            Skip for now
          </button>
        </div>
      </div>
    </NativeShell>
  );
}

export function NativePinSetupScreen({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [phase, setPhase] = useState<"initial" | "confirm">("initial");
  const [digits, setDigits] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const savingRef = useRef(false);

  function pressDigit(digit: string) {
    if (savingRef.current || digits.length >= 6) return;
    setMessage(null);
    const next = `${digits}${digit}`;
    setDigits(next);
    if (next.length !== 6) return;
    if (phase === "initial") {
      setFirstPin(next);
      setDigits("");
      setPhase("confirm");
      return;
    }
    if (next !== firstPin) {
      setDigits("");
      setMessage("That PIN did not match. Enter it again.");
      return;
    }
    savingRef.current = true;
    void saveNativePin(next).then(onSaved).catch(() => {
      setMessage("Could not save the PIN. Please try again.");
      savingRef.current = false;
      setDigits("");
    });
  }

  function backspace() {
    if (savingRef.current) return;
    setMessage(null);
    setDigits((value) => value.slice(0, -1));
  }

  return (
    <NativeShell className="native-auth-shell">
      <BackHeader title="Set your PIN" onBack={onBack} />
      <div className="native-auth-content native-flow-content native-flow-content-with-header">
        <p className="native-instruction">
          Set a 6-digit PIN to unlock TradeOps quickly.
        </p>
        <p className="native-step-copy">{phase === "initial" ? "Choose 6 digits" : "Confirm your 6 digits"}</p>
        <PinProgress length={digits.length} />
        <div className="native-keypad" aria-label="PIN keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((key, index) => (
            key === "" ? <span key={index} className="native-keypad-empty" aria-hidden="true" /> :
            key === "back" ? (
              <button key={key} type="button" onClick={backspace} className="native-keypad-key" aria-label="Delete last digit">
                <Delete className="h-5 w-5" strokeWidth={1.5} />
              </button>
            ) : (
              <button key={key} type="button" onClick={() => pressDigit(key)} className="native-keypad-key">{key}</button>
            )
          ))}
        </div>
        {message && <p className="native-inline-message text-center" role="status">{message}</p>}
      </div>
    </NativeShell>
  );
}

function PinProgress({ length }: { length: number }) {
  return (
    <div className="native-pin-progress" aria-label={`${length} of 6 digits entered`}>
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className={`native-pin-dot ${index < length ? "native-pin-dot-filled" : ""}`}
        />
      ))}
    </div>
  );
}

export function NativePasswordSetupScreen({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!password || password.length < 4) {
      setMessage("Use at least 4 characters.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }
    setMessage(null);
    setPending(true);
    try {
      await saveNativePassword(password);
      onSaved();
    } catch {
      setMessage("Could not save the password. Please try again.");
      setPending(false);
    }
  }

  return (
    <NativeShell className="native-auth-shell">
      <BackHeader title="Set your password" onBack={onBack} />
      <form className="native-auth-content native-flow-content native-flow-content-with-header" onSubmit={handleSubmit}>
        <p className="native-instruction">
          Set a password to unlock TradeOps quickly.
        </p>
        <label className="native-field-label" htmlFor="native-password">Password</label>
        <MaskedLedgerInput
          id="native-password"
          value={password}
          onChange={(value) => { setPassword(value); setMessage(null); }}
          ariaLabel="Password"
          type="password"
          autoFocus
        />
        <label className="native-field-label mt-8" htmlFor="native-password-confirm">Confirm password</label>
        <MaskedLedgerInput
          id="native-password-confirm"
          value={confirmation}
          onChange={(value) => { setConfirmation(value); setMessage(null); }}
          ariaLabel="Confirm password"
          type="password"
        />
        <div className="mt-10">
          <PrimaryActionButton type="submit" disabled={pending || !password || !confirmation}>
            {pending ? "Saving…" : "Save password"}
          </PrimaryActionButton>
        </div>
        {message && <p className="native-inline-message" role="alert">{message}</p>}
      </form>
    </NativeShell>
  );
}

function useNativeBiometricAvailability() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      isNativeBiometricAvailable(),
      getNativeBiometricEnabled(),
    ]).then(([deviceAvailable, enabled]) => {
      if (mounted) setAvailable(deviceAvailable && enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return available;
}

function NativeBiometricPreferenceScreen({ onComplete }: { onComplete: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (saving) return;
    setSaving(true);
    try {
      await setNativeBiometricEnabled(enabled);
      onComplete();
    } finally {
      setSaving(false);
    }
  }

  return (
    <NativeShell className="native-auth-shell">
      <div className="native-auth-content native-flow-content">
        <BrandLockup />
        <p className="native-instruction">Enable fingerprint unlock?</p>
        <p className="native-supporting-copy">
          Use your enrolled biometric as an alternative to your quick-unlock credential.
        </p>
        <div className="native-toggle-card">
          <div>
            <p className="font-medium">Fingerprint unlock</p>
            <p className="native-toggle-description">You can change this later in Settings.</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable fingerprint unlock"
          />
        </div>
        <div className="native-flow-action">
          <PrimaryActionButton onClick={() => void handleContinue()} disabled={saving}>
            {saving ? "Saving…" : "Continue"}
          </PrimaryActionButton>
        </div>
      </div>
    </NativeShell>
  );
}

export function DailyUnlockPin({
  onUnlocked,
  onForgot,
}: {
  onUnlocked: () => void;
  onForgot: () => void;
}) {
  const [digits, setDigits] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const biometricsAvailable = useNativeBiometricAvailability();

  async function handleBiometricUnlock() {
    setMessage(null);
    if (await requestNativeBiometricUnlock()) onUnlocked();
  }

  function pressDigit(digit: string) {
    if (digits.length >= 6) return;
    setMessage(null);
    const next = `${digits}${digit}`;
    setDigits(next);
    if (next.length === 6) {
      void verifyNativePin(next).then((valid) => {
        if (valid) onUnlocked();
        else {
          setDigits("");
          setMessage("That PIN was not recognised.");
        }
      });
    }
  }

  return (
    <NativeShell className="native-auth-shell native-daily-screen">
      <div className="native-daily-content">
        <BrandLockup />
        <p className="native-instruction">Enter your PIN to unlock your journal.</p>
        <PinProgress length={digits.length} />
        <div className="native-keypad" aria-label="PIN keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "fingerprint", "0", "back"].map((key, index) =>
            key === "" ? <span key={index} className="native-keypad-empty" aria-hidden="true" /> :
            key === "fingerprint" ? (
              biometricsAvailable ? (
                <button
                  key={key}
                  type="button"
                  onClick={() => void handleBiometricUnlock()}
                  className="native-keypad-key"
                  aria-label="Use fingerprint"
                >
                  <Fingerprint className="h-5 w-5" strokeWidth={1.5} />
                </button>
              ) : <span key={key} aria-hidden="true" /> 
            ) :
            key === "back" ? (
              <button key={key} type="button" onClick={() => setDigits((value) => value.slice(0, -1))} className="native-keypad-key" aria-label="Delete last digit">
                <Delete className="h-5 w-5" strokeWidth={1.5} />
              </button>
            ) : (
              <button key={key} type="button" onClick={() => pressDigit(key)} className="native-keypad-key">{key}</button>
            )
          )}
        </div>
        {message && <p className="native-inline-message text-center" role="status">{message}</p>}
        <button type="button" onClick={onForgot} className="native-muted-link native-daily-link">Forgot PIN?</button>
      </div>
    </NativeShell>
  );
}

export function DailyUnlockPassword({
  onUnlocked,
  onForgot,
}: {
  onUnlocked: () => void;
  onForgot: () => void;
}) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const biometricsAvailable = useNativeBiometricAvailability();

  async function handleBiometricUnlock() {
    setMessage(null);
    if (await requestNativeBiometricUnlock()) onUnlocked();
  }

  async function handleUnlock() {
    if (!password || pending) return;
    setPending(true);
    setMessage(null);
    const valid = await verifyNativePassword(password);
    if (valid) onUnlocked();
    else {
      setMessage("That password was not recognised.");
      setPassword("");
      setPending(false);
    }
  }

  return (
    <NativeShell className="native-auth-shell native-daily-screen">
      <div className="native-daily-content native-password-daily-content">
        <BrandLockup />
        <p className="native-instruction">Enter your password to unlock your journal.</p>
        <div className="native-daily-password-field">
          <MaskedLedgerInput
            value={password}
            onChange={(value) => { setPassword(value); setMessage(null); }}
            onKeyDown={(event) => { if (event.key === "Enter") void handleUnlock(); }}
            ariaLabel="Password"
            type="password"
            autoFocus
          />
        </div>
        {biometricsAvailable && (
          <button
            type="button"
            className="native-biometric-link"
            onClick={() => void handleBiometricUnlock()}
          >
            <Fingerprint className="h-4 w-4" strokeWidth={1.5} />
            Use fingerprint instead
          </button>
        )}
        <div className="native-flow-action">
          <PrimaryActionButton onClick={() => void handleUnlock()} disabled={pending || !password}>
            {pending ? "Unlocking…" : "Unlock"}
          </PrimaryActionButton>
        </div>
        {message && <p className="native-inline-message text-center" role="status">{message}</p>}
        <button type="button" onClick={onForgot} className="native-muted-link native-daily-link">Forgot password?</button>
      </div>
    </NativeShell>
  );
}

export function NativeSetupFlow({
  onComplete,
  onBack,
  showBack = false,
}: {
  onComplete: () => void;
  onBack?: () => void;
  showBack?: boolean;
}) {
  const [screen, setScreen] = useState<SetupScreen>("choice");

  async function handleCredentialSaved() {
    if (await isNativeBiometricAvailable()) {
      setScreen("biometric");
      return;
    }
    onComplete();
  }

  if (screen === "pin") {
    return <NativePinSetupScreen onBack={() => setScreen("choice")} onSaved={() => void handleCredentialSaved()} />;
  }
  if (screen === "password") {
    return <NativePasswordSetupScreen onBack={() => setScreen("choice")} onSaved={() => void handleCredentialSaved()} />;
  }
  if (screen === "biometric") {
    return <NativeBiometricPreferenceScreen onComplete={onComplete} />;
  }
  return (
    <NativeUnlockSetupOffer
      showBack={showBack}
      onBack={onBack}
      onChoose={(choice) => {
        if (choice === "pin") setScreen("pin");
        else if (choice === "password") setScreen("password");
        else onComplete();
      }}
    />
  );
}

export function NativeEntryFlow({ onAuthenticated }: { onAuthenticated: (me: MeResponse) => void }) {
  const [setupRequested, setSetupRequested] = useState(false);
  const [pendingMe, setPendingMe] = useState<MeResponse | null>(null);

  if (setupRequested && pendingMe) {
    return (
      <NativeSetupFlow
        onComplete={() => onAuthenticated(pendingMe)}
      />
    );
  }

  return (
    <NativeAccessCodeScreen
      onAuthenticated={(me) => {
        const showOffer = Boolean((me as MeResponse & { __showUnlockSetupOffer?: boolean }).__showUnlockSetupOffer);
        if (!showOffer) {
          onAuthenticated(me);
          return;
        }
        void markNativeUnlockOfferSeen().then(() => {
          setPendingMe(me);
          setSetupRequested(true);
        });
      }}
    />
  );
}

export const UNLOCK_GRACE_MS = 3 * 60 * 1000;

function NativeGateSurface() {
  return (
    <main
      className="native-entry-shell min-h-[100dvh] w-full"
      aria-busy="true"
    />
  );
}

export function NativeSessionGate({
  children,
  onReauthenticated,
}: {
  children: React.ReactNode;
  onReauthenticated: (me: MeResponse) => void;
}) {
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [unlockMethod, setUnlockMethod] = useState<"pin" | "password" | null>(null);
  const [recovering, setRecovering] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const applyLockIfConfigured = async () => {
      let method: "pin" | "password" | null = null;
      try {
        method = await getNativeUnlockMethod();
      } catch {
        // If local preferences cannot be read, do not interrupt the existing
        // server session with a screen that cannot be completed.
      }
      if (!mounted) return;
      setUnlockMethod(method);
      lockedRef.current = Boolean(method);
      setLocked(Boolean(method));
      setChecking(false);
    };

    void applyLockIfConfigured();

    const listenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        backgroundedAt.current = Date.now();
        return;
      }

      const backgrounded = backgroundedAt.current;
      backgroundedAt.current = null;
      if (
        backgrounded === null
        || Date.now() - backgrounded <= UNLOCK_GRACE_MS
        || lockedRef.current
      ) {
        return;
      }

      void getNativeUnlockMethod().then((method) => {
        if (!mounted || !method || lockedRef.current) return;
        setUnlockMethod(method);
        lockedRef.current = true;
        setLocked(true);
      }).catch(() => {
        // A preference read failure should leave the current session usable.
      });
    });

    return () => {
      mounted = false;
      void listenerPromise.then((listener) => listener.remove());
    };
  }, []);

  if (recovering) {
    return (
      <NativeAccessCodeScreen
        onAuthenticated={(me) => {
          setRecovering(false);
          lockedRef.current = false;
          setLocked(false);
          onReauthenticated(me);
        }}
      />
    );
  }

  if (checking) return <NativeGateSurface />;
  if (!locked || !unlockMethod) return <>{children}</>;

  const unlock = () => {
    lockedRef.current = false;
    setLocked(false);
  };
  const forgot = () => setRecovering(true);

  return unlockMethod === "pin" ? (
    <DailyUnlockPin onUnlocked={unlock} onForgot={forgot} />
  ) : (
    <DailyUnlockPassword onUnlocked={unlock} onForgot={forgot} />
  );
}