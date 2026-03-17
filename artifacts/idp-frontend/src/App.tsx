import { Switch, Route, Router as WouterRouter, useLocation, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HealthIndicator } from "@/components/HealthIndicator";
import { Dashboard } from "@/pages/Dashboard";
import { Home } from "@/pages/Home";
import { ProjectView } from "@/pages/ProjectView";
import { Settings } from "@/pages/Settings";
import { Preview } from "@/pages/Preview";
import NotFound from "@/pages/not-found";
import { Terminal, Plus, LayoutGrid, Settings2, LogIn, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";

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

          <nav className="hidden sm:flex items-center space-x-1">
            <Link
              href="/"
              className={cn(
                "flex items-center px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                location === "/"
                  ? "bg-primary/10 text-primary"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
              PROJECTS
            </Link>
            <Link
              href="/new"
              className={cn(
                "flex items-center px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                location === "/new"
                  ? "bg-primary/10 text-primary"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              NEW
            </Link>
            <Link
              href="/settings"
              className={cn(
                "flex items-center px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                location === "/settings"
                  ? "bg-primary/10 text-primary"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <Settings2 className="w-3.5 h-3.5 mr-1.5" />
              SETTINGS
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <HealthIndicator />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}

function AuthButton() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />;
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={login}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        LOGIN
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user?.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt={user.firstName || "User"}
          className="w-7 h-7 rounded-full border border-border"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
        {user?.firstName || user?.email || "User"}
      </span>
      <button
        onClick={logout}
        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        title="Logout"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new" component={Home} />
      <Route path="/settings" component={Settings} />
      <Route path="/project/:id" component={ProjectView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();

  if (location.startsWith("/preview/")) {
    return (
      <Switch>
        <Route path="/preview/:id" component={Preview} />
      </Switch>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <NavHeader />
      <AppRouter />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppContent />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
