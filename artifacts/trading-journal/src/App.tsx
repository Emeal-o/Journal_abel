import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { JournalPage } from "@/pages/journal";
import { StatsPage } from "@/pages/stats";
import { ArchivePage } from "@/pages/archive";
import { AnalysisPage } from "@/pages/analysis";
import { LoginPage } from "@/pages/login";
import { AdminPage } from "@/pages/admin";
import { SettingsPage } from "@/pages/settings";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { DisplayPrefsProvider, useDisplayPrefs } from "@/hooks/use-display-prefs";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // Blank screen while we check the session — avoids a flash of the login page
    return null;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={JournalPage} />
        <Route path="/stats" component={StatsPage} />
        <Route path="/archive" component={ArchivePage} />
        <Route path="/analysis" component={AnalysisPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function InitialLandingRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const { defaultLanding } = useDisplayPrefs();
  const [location, navigate] = useLocation();
  const initialLocation = useRef(location);
  const handledInitialLanding = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || handledInitialLanding.current) return;

    handledInitialLanding.current = true;
    if (initialLocation.current === "/" && defaultLanding === "analysis") {
      navigate("/analysis", { replace: true });
    }
  }, [defaultLanding, isAuthenticated, isLoading, navigate]);

  return null;
}

function App() {
  // Force dark mode
  if (typeof window !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DisplayPrefsProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <InitialLandingRedirect />
            {/* /admin has its own independent auth (admin password), so it must
                sit outside AuthGate — otherwise a signed-out browser would be
                redirected to the regular journal login page instead. */}
            <Switch>
              <Route path="/admin" component={AdminPage} />
              <Route>
                <AuthGate />
              </Route>
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </DisplayPrefsProvider>
    </QueryClientProvider>
  );
}

export default App;
