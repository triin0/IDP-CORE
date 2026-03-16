import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HealthIndicator } from "@/components/HealthIndicator";
import { Home } from "@/pages/Home";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-6 max-w-[1600px] mx-auto w-full justify-between">
        <div className="flex items-center gap-2 font-mono font-bold tracking-tighter text-lg">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(34,211,238,0.5)]">
            <span className="text-primary-foreground leading-none text-sm">&gt;_</span>
          </div>
          <span>IDP<span className="text-primary">.CORE</span></span>
        </div>
        <HealthIndicator />
      </div>
    </header>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary/30 selection:text-primary">
      <Header />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
