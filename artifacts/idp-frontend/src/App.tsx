import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HealthIndicator } from "@/components/HealthIndicator";
import { Home } from "@/pages/Home";
import { ProjectView } from "@/pages/ProjectView";
import NotFound from "@/pages/not-found";
import { Terminal } from "lucide-react";

const queryClient = new QueryClient();

function NavHeader() {
  const [, navigate] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-3">
        <button
          onClick={() => navigate("/")}
          className="flex items-center space-x-2 text-primary font-mono font-bold text-sm hover:opacity-80 transition-opacity"
        >
          <Terminal className="w-5 h-5" />
          <span>IDP.CORE</span>
        </button>
        <HealthIndicator />
      </div>
    </header>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/project/:id" component={ProjectView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <NavHeader />
            <Router />
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
