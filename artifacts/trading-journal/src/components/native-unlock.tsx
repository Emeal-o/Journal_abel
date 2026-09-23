import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Delete, Fingerprint } from "lucide-react";
import type { MeResponse } from "@/lib/auth-api";
import { login } from "@/lib/auth-api";
import {
  hasSeenNativeUnlockOffer,
  markNativeUnlockOfferSeen,
  saveNativePassword,
  saveNativePin,
  verifyNativePassword,
  verifyNativePin,
} from "@/lib/native-unlock";

const LEDGER = {
  background: "#EDE7D8",
  ink: "#211D18",
  muted: "#8A8375",
  rule: "#A9B7C6",
  accent: "#10B981",
} as const;

type SetupChoice = "pin" | "password" | "skip";
type SetupScreen = "choice" | "pin" | "password";

function NativeShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={`native-entry-shell min-h-[100dvh] w-full overflow-x-hidden ${className}`}
      style={{ backgroundColor: LEDGER.background, color: LEDGER.ink }}
    >
      {children}
    </main>
  );
}

function Wordmark({ small = false, centered = false }: { small?: boolean; centered?: boolean }) {
  return (
    <div
      className={`font-mono font-semibold tracking-[-0.07em] ${small ? "text-2xl" : "text-5xl"} ${centered ? "text-center" : ""}`}
      style={{ color: LEDGER.ink }}
    >
      TradeOps
    </div>
  );
}

function LedgerCursor() {
  return <span className="native-ledger-cursor" aria-hidden="true" style={{ backgroundColor: LEDGER.accent }} />;
}

function MaskedLedgerInput({
  value,
  onChange,
  placeholder = "••••••••",
  autoFocus = false,
  ariaLabel,
  type = "text",
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel: string;
  type?: "text" | "password";
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="native-ledger-input-wrap">
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="native-ledger-input"
      />
      <span className="native-ledger-mask" aria-hidden="true">
        {value ? "— ".repeat(value.length).trimEnd() : placeholder}
        <LedgerCursor />
      </span>
    </div>
  );
}

function OutlinedButton({
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
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="native-outlined-button w-full disabled:cursor-not-allowed disabled:opacity-45"
      style={{ borderColor: LEDGER.ink, color: LEDGER.ink }}
    >
      {children}
    </button>
  );
}

function BackHeader({ title, dashed = false, onBack }: { title: string; dashed?: boolean; onBack: () => void }) {
  return (
    <header className={`native-screen-header ${dashed ? "native-screen-header-dashed" : ""}`} style={{ borderColor: LEDGER.rule }}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="native-icon-button"
        style={{ color: LEDGER.ink }}
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <h1 className="font-mono text-base font-semibold" style={{ color: LEDGER.ink }}>{title}</h1>
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
    <NativeShell className="flex flex-col">
      <div className="native-access-layout">
        <div className="native-access-wordmark">
          <Wordmark />
          <div className="native-rule-draw" style={{ backgroundColor: LEDGER.rule }} />
        </div>

        <div className="native-access-content">
          <p className="native-serif-copy">Enter your access code to open your journal.</p>
          <form onSubmit={handleSubmit} className="mt-10">
            <MaskedLedgerInput
              value={code}
              onChange={(value) => { setCode(value); setError(null); }}
              ariaLabel="Access code"
              placeholder="Enter access code"
              autoFocus
            />
            <OutlinedButton type="submit" disabled={pending || !code.trim()}>
              {pending ? "Opening…" : "Open journal"}
            </OutlinedButton>
            {error && <p className="native-inline-message" role="alert">{error}</p>}
          </form>
        </div>
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
    <NativeShell className="native-centered-screen">
      {showBack && onBack && <BackHeader title="Quick unlock" onBack={onBack} />}
      <div className="native-choice-content">
        <Wordmark />
        <div className="native-choice-rule" style={{ backgroundColor: LEDGER.rule }} />
        <p className="native-serif-copy mt-8">
          Add a PIN or password for quick unlock on this device? Your admin code will always still work.
        </p>
        <div className="mt-10 space-y-3">
          <OutlinedButton onClick={() => onChoose("pin")}>Set a PIN</OutlinedButton>
          <OutlinedButton onClick={() => onChoose("password")}>Set a password</OutlinedButton>
          <button type="button" className="native-muted-link mt-4" onClick={() => onChoose("skip")}>
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
    <NativeShell>
      <BackHeader title="Set your PIN" onBack={onBack} />
      <div className="native-setup-content">
        <p className="native-serif-copy">
          Set a PIN to unlock TradeOps quickly. Your admin code still always works.
        </p>
        <p className="native-step-copy">{phase === "initial" ? "Choose 6 digits" : "Confirm your 6 digits"}</p>
        <PinProgress length={digits.length} />
        <div className="native-keypad" aria-label="PIN keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((key, index) => (
            key === "" ? <span key={index} aria-hidden="true" /> :
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
          className="native-pin-square"
          style={{
            backgroundColor: index < length ? LEDGER.ink : "transparent",
            borderColor: index < length ? LEDGER.ink : LEDGER.rule,
          }}
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
    <NativeShell>
      <BackHeader title="Set your password" dashed onBack={onBack} />
      <form className="native-setup-content" onSubmit={handleSubmit}>
        <p className="native-serif-copy">
          Set a password to unlock TradeOps quickly. Your admin code still always works.
        </p>
        <label className="native-field-label" htmlFor="native-password">Password</label>
        <MaskedLedgerInput
          value={password}
          onChange={(value) => { setPassword(value); setMessage(null); }}
          ariaLabel="Password"
          type="password"
          autoFocus
        />
        <label className="native-field-label mt-8" htmlFor="native-password-confirm">Confirm password</label>
        <MaskedLedgerInput
          value={confirmation}
          onChange={(value) => { setConfirmation(value); setMessage(null); }}
          ariaLabel="Confirm password"
          type="password"
        />
        <div className="mt-10">
          <OutlinedButton type="submit" disabled={pending || !password || !confirmation}>
            {pending ? "Saving…" : "Save password"}
          </OutlinedButton>
        </div>
        {message && <p className="native-inline-message" role="alert">{message}</p>}
      </form>
    </NativeShell>
  );
}

export function DailyUnlockPin({
  onUnlocked,
  onForgot,
  biometricsAvailable = false,
}: {
  onUnlocked: () => void;
  onForgot: () => void;
  biometricsAvailable?: boolean;
}) {
  const [digits, setDigits] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
    <NativeShell className="native-daily-screen">
      <div className="native-daily-content">
        <Wordmark small centered />
        <PinProgress length={digits.length} />
        <div className="native-keypad" aria-label="PIN keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "fingerprint", "0", "back"].map((key, index) =>
            key === "" ? <span key={index} aria-hidden="true" /> :
            key === "fingerprint" ? (
              biometricsAvailable ? (
                <button key={key} type="button" className="native-keypad-key" aria-label="Use fingerprint">
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
  biometricsAvailable = false,
}: {
  onUnlocked: () => void;
  onForgot: () => void;
  biometricsAvailable?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
    <NativeShell className="native-daily-screen">
      <div className="native-daily-content native-password-daily-content">
        <Wordmark small centered />
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
          <button type="button" className="native-biometric-link">
            <Fingerprint className="h-4 w-4" strokeWidth={1.5} />
            Use fingerprint instead
          </button>
        )}
        <div className="mt-9 w-full">
          <OutlinedButton onClick={() => void handleUnlock()} disabled={pending || !password}>
            {pending ? "Unlocking…" : "Unlock"}
          </OutlinedButton>
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

  if (screen === "pin") {
    return <NativePinSetupScreen onBack={() => setScreen("choice")} onSaved={onComplete} />;
  }
  if (screen === "password") {
    return <NativePasswordSetupScreen onBack={() => setScreen("choice")} onSaved={onComplete} />;
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