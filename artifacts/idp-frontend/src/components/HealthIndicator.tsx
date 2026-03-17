import { useHealthCheck, getHealthCheckQueryOptions } from "@workspace/api-client-react";
import { Activity, Server, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthDataWithLlm {
  status: string;
  llm?: {
    configured: boolean;
    reachable: boolean;
  };
}

function StatusDot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <div className="relative flex h-2 w-2">
      {pulse && (
        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-60", color)} />
      )}
      <span className={cn("relative inline-flex rounded-full h-2 w-2", color)} />
    </div>
  );
}

export function HealthIndicator() {
  const queryOptions = getHealthCheckQueryOptions();
  const { data, isError } = useHealthCheck({
    query: { ...queryOptions, refetchInterval: 30000 },
  });

  const healthData = data as HealthDataWithLlm | undefined;
  const status = isError ? "error" : healthData?.status || "unknown";

  return (
    <div className="flex items-center gap-2">
      <div className="hud-badge">
        {status === "ok" ? (
          <>
            <StatusDot color="bg-success" pulse />
            <span className="text-zinc-400">SYS</span>
            <span className="text-success">READY</span>
          </>
        ) : status === "degraded" ? (
          <>
            <StatusDot color="bg-warning" />
            <span className="text-zinc-400">SYS</span>
            <span className="text-warning">DEGRADED</span>
          </>
        ) : status === "unhealthy" || status === "error" ? (
          <>
            <StatusDot color="bg-destructive" />
            <span className="text-zinc-400">SYS</span>
            <span className="text-destructive">FAULT</span>
          </>
        ) : (
          <>
            <Server className="w-3 h-3 text-zinc-500 animate-pulse" />
            <span className="text-zinc-500">CONNECTING</span>
          </>
        )}
      </div>

      {healthData?.llm && (
        <div className={cn(
          "hud-badge",
          healthData.llm.reachable
            ? "border-primary/20"
            : "border-destructive/20"
        )}>
          <Activity className={cn(
            "w-3 h-3",
            healthData.llm.reachable ? "text-primary animate-hud-pulse" : "text-destructive"
          )} />
          <span className="text-zinc-400">LLM</span>
          <span className={healthData.llm.reachable ? "text-primary" : "text-destructive"}>
            {healthData.llm.reachable ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      )}

      <div className="hud-badge border-zinc-800/50">
        <Cloud className="w-3 h-3 text-zinc-500" />
        <span className="text-zinc-400">SANDBOX</span>
        <span className="text-zinc-500">IDLE</span>
      </div>
    </div>
  );
}
