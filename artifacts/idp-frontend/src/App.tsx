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
import { Terminal, Plus, LayoutGrid, Settings2, LogIn, LogOut, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";

const queryClient = new QueryClient();

function NavHeader() {
  const [location, navigate] = useLocation();

  return (
    <header className="sticky top-0 z-50 glass-panel-strong">
      <div className="flex items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-primary font-mono font-bold text-sm hover:opacity-80 transition-opacity group"
          >
            <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors ring-1 ring-primary/20">
              <Terminal className="w-4 h-4" />
            </div>
            <span className="tracking-wide">IDP.CORE</span>
          </button>

          <div className="h-5 w-px bg-zinc-800 hidden sm:block" />

          <nav className="hidden sm:flex items-center gap-0.5">
            {[
              { href: "/", label: "PROJECTS", Icon: LayoutGrid, match: (l: string) => l === "/" },
              { href: "/new", label: "NEW", Icon: Plus, match: (l: string) => l === "/new" },
              { href: "/settings", label: "SETTINGS", Icon: Settings2, match: (l: string) => l === "/settings" },
            ].map(({ href, label, Icon, match }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium transition-all duration-200",
                  match(location)
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <HealthIndicator />
          <ComputeWallet />
          <div className="h-5 w-px bg-zinc-800 hidden sm:block" />
          <AuthButton />
        </div>
      </div>
      <div className="glow-line" />
    </header>
  );
}

function ComputeWallet() {
  return (
    <div className="hud-badge border-primary/10 hidden sm:inline-flex">
      <Zap className="w-3 h-3 text-primary" />
      <span className="text-primary font-semibold">12,450</span>
      <span className="text-zinc-500">Cycles</span>
    </div>
  );
}

function AuthButton() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-zinc-800/50 animate-pulse" />;
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={login}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all duration-200"
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
          className="w-7 h-7 rounded-full ring-1 ring-white/10"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
        {user?.firstName || user?.email || "User"}
      </span>
      <button
        onClick={logout}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all duration-200"
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
    <div className="min-h-screen flex flex-col">
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
