import { useHealthCheck, getHealthCheckQueryOptions } from "@workspace/api-client-react";
import { Activity, Server } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthDataWithLlm {
  status: string;
  llm?: {
    configured: boolean;
    reachable: boolean;
  };
}

export function HealthIndicator() {
  const queryOptions = getHealthCheckQueryOptions();
  const { data, isError } = useHealthCheck({
    query: { ...queryOptions, refetchInterval: 30000 },
  });

  const healthData = data as HealthDataWithLlm | undefined;
  const status = isError ? "error" : healthData?.status || "unknown";

  return (
    <div className="flex items-center space-x-2 text-xs font-mono">
      <div className="flex items-center space-x-2 bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50 backdrop-blur-sm">
        {status === "ok" ? (
          <>
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </div>
            <span className="text-muted-foreground">SYSTEM.READY</span>
          </>
        ) : status === "degraded" ? (
          <>
            <div className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </div>
            <span className="text-yellow-500/80">SYSTEM.DEGRADED</span>
          </>
        ) : status === "unhealthy" || status === "error" ? (
          <>
            <div className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
            </div>
            <span className="text-destructive/80">SYSTEM.FAULT</span>
          </>
        ) : (
          <>
            <Server className="w-3 h-3 text-muted-foreground animate-pulse" />
            <span className="text-muted-foreground">CONNECTING...</span>
          </>
        )}
      </div>
      {healthData?.llm && (
        <div className={cn(
          "px-2 py-1.5 rounded-full border text-[10px] uppercase tracking-wider flex items-center gap-1",
          healthData.llm.reachable 
            ? "bg-primary/10 border-primary/20 text-primary" 
            : "bg-destructive/10 border-destructive/20 text-destructive"
        )}>
          <Activity className="w-3 h-3" />
          LLM: {healthData.llm.reachable ? "ONLINE" : "OFFLINE"}
        </div>
      )}
    </div>
  );
}
