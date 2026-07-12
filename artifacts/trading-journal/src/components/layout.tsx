import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Activity, Archive, BookOpen, LineChart, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  async function handleLogout() {
    await logout();
    // Clear all cached query data so the next session starts fresh
    queryClient.clear();
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Trade<span className="text-primary">Ops</span></span>
          </div>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            <Link
              href="/"
              className={cn(
                "flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                location === "/"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Journal</span>
            </Link>
            <Link
              href="/stats"
              className={cn(
                "flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                location === "/stats"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <LineChart className="w-4 h-4" />
              <span className="hidden sm:inline">Stats</span>
            </Link>
            <Link
              href="/archive"
              className={cn(
                "flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                location === "/archive"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">Archive</span>
            </Link>

            {/* Divider */}
            <div className="w-px h-5 bg-border/50 mx-1" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-all duration-200"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 relative">
        {/* Decorative background glows */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

        {children}
      </main>
    </div>
  );
}
