import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { JournalPage } from "@/pages/journal";
import { StatsPage } from "@/pages/stats";
import { LoginPage } from "@/pages/login";
import { AdminPage } from "@/pages/admin";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";

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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  // Force dark mode
  if (typeof window !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
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
    </QueryClientProvider>
  );
}

export default App;
