import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Clock, Bot } from "lucide-react";

interface PipelineStage {
  role: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string | null;
  completedAt?: string | null;
  fileCount?: number | null;
  error?: string | null;
}

interface PipelineStatus {
  stages: PipelineStage[];
  currentAgent?: string | null;
}

interface StatusTerminalProps {
  status: string;
  pipelineStatus?: PipelineStatus;
}

const AGENT_ICONS: Record<string, string> = {
  architect: "🏗️",
  backend: "⚙️",
  frontend: "🎨",
  security: "🔒",
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  architect: "Designing project skeleton, schemas, and configuration...",
  backend: "Implementing API routes, middleware, and business logic...",
  frontend: "Building UI components, pages, hooks, and styles...",
  security: "Reviewing code for vulnerabilities and hardening output...",
};

function formatDuration(startedAt?: string | null, completedAt?: string | null): string {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.round((end - start) / 1000);
  return `${seconds}s`;
}

function StageRow({ stage, index }: { stage: PipelineStage; index: number }) {
  const icon = AGENT_ICONS[stage.role] || "🤖";
  const description = AGENT_DESCRIPTIONS[stage.role] || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
        stage.status === "running"
          ? "bg-primary/5 border-primary/30"
          : stage.status === "completed"
          ? "bg-green-500/5 border-green-500/20"
          : stage.status === "failed"
          ? "bg-red-500/5 border-red-500/20"
          : "bg-zinc-900/50 border-zinc-800/50"
      }`}
    >
      <div className="text-lg mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-zinc-200">
            {stage.label}
          </span>
          {stage.status === "running" && (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          )}
          {stage.status === "completed" && (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          )}
          {stage.status === "failed" && (
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          )}
          {stage.status === "pending" && (
            <Clock className="w-3.5 h-3.5 text-zinc-600" />
          )}
        </div>
        <div className="text-xs text-zinc-500 mt-0.5">
          {stage.status === "running" && description}
          {stage.status === "completed" && (
            <span className="text-green-400/80">
              Completed — {stage.fileCount ?? 0} files generated
              {stage.startedAt && ` (${formatDuration(stage.startedAt, stage.completedAt)})`}
            </span>
          )}
          {stage.status === "failed" && (
            <span className="text-red-400/80">
              {stage.error || "Agent failed"}
            </span>
          )}
          {stage.status === "pending" && "Waiting..."}
        </div>
      </div>
    </motion.div>
  );
}

export function StatusTerminal({ status, pipelineStatus }: StatusTerminalProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "generating") return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const hasPipeline = pipelineStatus && pipelineStatus.stages.length > 0;
  const completedStages = pipelineStatus?.stages.filter((s) => s.status === "completed").length ?? 0;
  const totalStages = pipelineStatus?.stages.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-3xl mx-auto mt-12 overflow-hidden rounded-xl bg-card border border-border shadow-2xl"
    >
      <div className="flex items-center px-4 py-3 border-b border-border/50 bg-secondary/50">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
          <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
          <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
        </div>
        <div className="mx-auto text-xs font-mono text-muted-foreground flex items-center gap-2">
          <Bot className="w-3.5 h-3.5" />
          MULTI_AGENT_PIPELINE
          {hasPipeline && (
            <span className="text-primary">
              [{completedStages}/{totalStages}]
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-zinc-600">
          {elapsed > 0 && `${elapsed}s`}
        </div>
      </div>

      <div className="p-4 font-mono text-sm bg-zinc-950">
        <div className="text-primary mb-4 flex items-center text-xs">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          <span>[PIPELINE] Multi-agent code generation in progress...</span>
        </div>

        {hasPipeline ? (
          <div className="space-y-2">
            <AnimatePresence>
              {pipelineStatus.stages.map((stage, i) => (
                <StageRow key={stage.role} stage={stage} index={i} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-zinc-500 flex animate-pulse">
              <span className="text-zinc-600 mr-4">01:</span>
              <span>Initializing agent pipeline...</span>
            </div>
          </div>
        )}

        {status === "generating" && (
          <div className="mt-4 pt-3 border-t border-zinc-800">
            <div className="text-zinc-500 flex items-center text-xs">
              <span className="flex items-center">
                Processing
                <span className="animate-cursor-blink bg-zinc-500 w-2 h-4 ml-1 inline-block"></span>
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
