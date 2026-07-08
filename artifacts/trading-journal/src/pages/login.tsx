import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, KeyRound, Loader2, AlertCircle } from "lucide-react";
import { login } from "@/lib/auth-api";
import { AUTH_QUERY_KEY } from "@/hooks/use-auth";

export function LoginPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setError(null);
    setIsPending(true);

    try {
      const me = await login(code);
      // Seed the auth query cache so the app re-renders as authenticated
      // without an extra round-trip
      queryClient.setQueryData(AUTH_QUERY_KEY, { userId: me.userId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid access code.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center font-sans selection:bg-primary/30 px-4">
      {/* Background glows matching the main layout */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_18px_rgba(var(--primary),0.35)]">
            <Activity className="w-4.5 h-4.5 text-primary" />
          </div>
          <span className="font-semibold tracking-tight text-xl">
            Trade<span className="text-primary">Ops</span>
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-1">
            <KeyRound className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-lg font-semibold tracking-tight">Enter your access code</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-7 pl-8">
            Your private journal is protected by a personal access code.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <input
                id="code"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="e.g. A1B2C3D4E5F6"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isPending}
                className="w-full rounded-lg border border-border/60 bg-background/60 px-4 py-2.5 text-sm font-mono tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !code.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Unlock Journal"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Code is case-insensitive — spaces are ignored automatically.
        </p>
      </div>
    </div>
  );
}
