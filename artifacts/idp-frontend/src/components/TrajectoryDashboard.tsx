import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Clock, Bot, Wrench, ShieldCheck, Terminal, Activity } from "lucide-react";
import type { PipelineEvent, VerificationGate } from "@/hooks/usePipelineStream";
import { cn } from "@/lib/utils";

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

const AGENT_ICONS: Record<string, typeof Bot> = {
  architect: Bot,
  backend: Terminal,
  frontend: Activity,
  security: ShieldCheck,
  verification: ShieldCheck,
  fixer: Wrench,
};

const AGENT_COLORS: Record<string, string> = {
  architect: "text-violet-400 border-violet-400/30 bg-violet-400/5",
  backend: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  frontend: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
  security: "text-amber-400 border-amber-400/30 bg-amber-400/5",
  verification: "text-cyan-400 border-cyan-400/30 bg-cyan-400/5",
  fixer: "text-orange-400 border-orange-400/30 bg-orange-400/5",
};

function formatDuration(startedAt?: string | null, completedAt?: string | null): string {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.round((end - start) / 1000);
  return `${seconds}s`;
}

function StageCard({ stage }: { stage: PipelineStage }) {
  const Icon = AGENT_ICONS[stage.role] || Bot;
  const colorClass = AGENT_COLORS[stage.role] || "text-zinc-400 border-zinc-700 bg-zinc-900";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
        stage.status === "running" && colorClass,
        stage.status === "completed" && "border-green-500/20 bg-green-500/5",
        stage.status === "failed" && "border-red-500/20 bg-red-500/5",
        stage.status === "pending" && "border-zinc-800 bg-zinc-900/30",
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
        stage.status === "running" && "bg-primary/10",
        stage.status === "completed" && "bg-green-500/10",
        stage.status === "failed" && "bg-red-500/10",
        stage.status === "pending" && "bg-zinc-800",
      )}>
        {stage.status === "running" ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : stage.status === "completed" ? (
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        ) : stage.status === "failed" ? (
          <XCircle className="w-4 h-4 text-red-400" />
        ) : (
          <Clock className="w-4 h-4 text-zinc-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="w-3 h-3 text-zinc-500" />
          <span className="font-mono text-xs font-semibold text-zinc-200 truncate">
            {stage.label}
          </span>
        </div>
        <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
          {stage.status === "running" && "Processing..."}
          {stage.status === "completed" && (
            <span className="text-green-400/70">
              {stage.fileCount ?? 0} files
              {stage.startedAt && ` · ${formatDuration(stage.startedAt, stage.completedAt)}`}
            </span>
          )}
          {stage.status === "failed" && (
            <span className="text-red-400/70 truncate block">
              {stage.error || "Error"}
            </span>
          )}
          {stage.status === "pending" && "Queued"}
        </div>
      </div>
    </motion.div>
  );
}

function SelfHealingIndicator({ attempts, maxAttempts }: { attempts: number; maxAttempts: number }) {
  if (attempts === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="px-3 py-2 rounded-lg border border-orange-500/30 bg-orange-500/5"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Wrench className="w-3.5 h-3.5 text-orange-400" />
        <span className="font-mono text-xs font-semibold text-orange-400">
          SELF-HEALING LOOP
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: maxAttempts }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all",
              i < attempts ? "bg-orange-400" : "bg-zinc-800",
            )}
          />
        ))}
      </div>
      <div className="text-[10px] font-mono text-orange-400/60 mt-1">
        Attempt {attempts}/{maxAttempts}
      </div>
    </motion.div>
  );
}

function VerificationGateDisplay({ gates }: { gates: VerificationGate[] }) {
  if (gates.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-1"
    >
      <div className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider px-1">
        Verification Gates
      </div>
      {gates.map((gate) => (
        <div
          key={gate.name}
          className={cn(
            "flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono",
            gate.passed ? "text-green-400/80" : "text-red-400/80",
          )}
        >
          {gate.passed ? (
            <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
          )}
          <span>{gate.name}</span>
        </div>
      ))}
    </motion.div>
  );
}

interface TrajectoryDashboardProps {
  pipelineStatus?: PipelineStatus;
  events: PipelineEvent[];
  selfHealingAttempts: number;
  verificationGates: VerificationGate[];
  currentStage: string | null;
  isConnected: boolean;
}

export function TrajectoryDashboard({
  pipelineStatus,
  events,
  selfHealingAttempts,
  verificationGates,
  currentStage,
  isConnected,
}: TrajectoryDashboardProps) {
  const stages = pipelineStatus?.stages || [];
  const completedCount = stages.filter(s => s.status === "completed").length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs font-mono font-semibold text-zinc-500 border-b border-white/[0.04] uppercase tracking-wider flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" />
          Agent Trajectory
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="flex items-center gap-1 text-[10px] text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          )}
          {stages.length > 0 && (
            <span className="text-[10px] text-zinc-600">
              {completedCount}/{stages.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {stages.map((stage) => (
            <StageCard key={stage.role} stage={stage} />
          ))}
        </AnimatePresence>

        {currentStage === "fixer" && (
          <StageCard
            stage={{
              role: "fixer",
              label: "Fixer Agent",
              status: "running",
            }}
          />
        )}

        <SelfHealingIndicator attempts={selfHealingAttempts} maxAttempts={3} />
        <VerificationGateDisplay gates={verificationGates} />
      </div>
    </div>
  );
}
