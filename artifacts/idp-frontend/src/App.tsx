import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HealthIndicator } from "@/components/HealthIndicator";
import { Dashboard } from "@/pages/Dashboard";
import { Home } from "@/pages/Home";
import { ProjectView } from "@/pages/ProjectView";
import NotFound from "@/pages/not-found";
import { Terminal, LayoutDashboard } from "lucide-react";

const queryClient = new QueryClient();

function NavHeader() {
  const [location, navigate] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center space-x-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center space-x-2 text-primary font-mono font-bold text-sm hover:opacity-80 transition-opacity"
          >
            <Terminal className="w-5 h-5" />
            <span>IDP.CORE</span>
          </button>
          <nav className="flex items-center space-x-1">
            <button
              onClick={() => navigate("/")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                location === "/" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 inline mr-1.5" />
              DASHBOARD
            </button>
            <button
              onClick={() => navigate("/new")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                location === "/new" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 inline mr-1.5" />
              GENERATE
            </button>
          </nav>
        </div>
        <HealthIndicator />
      </div>
    </header>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new" component={Home} />
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
