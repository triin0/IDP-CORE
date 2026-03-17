import { motion } from "framer-motion";
import { Bot, Terminal, Activity, ShieldCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentStatus = "pending" | "running" | "completed" | "failed";

interface AgentNode {
  role: string;
  label: string;
  status: AgentStatus;
}

const AGENT_DEFS: { role: string; label: string; Icon: typeof Bot }[] = [
  { role: "architect", label: "Architect", Icon: Bot },
  { role: "backend", label: "Backend", Icon: Terminal },
  { role: "frontend", label: "Frontend", Icon: Activity },
  { role: "security", label: "Security", Icon: ShieldCheck },
  { role: "verification", label: "Verify", Icon: ShieldCheck },
];

const FIXER_DEF = { role: "fixer", label: "Fixer", Icon: Wrench };

interface AgentPipelineBarProps {
  stages: Array<{
    role: string;
    label: string;
    status: AgentStatus;
    startedAt?: string | null;
    completedAt?: string | null;
    fileCount?: number | null;
    error?: string | null;
  }>;
  currentStage: string | null;
  selfHealingAttempts: number;
  isConnected: boolean;
}

function NodeConnector({ active }: { active: boolean }) {
  return (
    <div className="flex items-center mx-0.5">
      <div
        className={cn(
          "h-0.5 w-6 rounded-full transition-all duration-500",
          active ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "bg-zinc-700",
        )}
      />
    </div>
  );
}

function AgentNodeChip({ node, Icon }: { node: AgentNode; Icon: typeof Bot }) {
  const isRunning = node.status === "running";
  const isCompleted = node.status === "completed";
  const isFailed = node.status === "failed";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border transition-all duration-300 min-w-[72px]",
        isRunning && "border-green-400 bg-green-400/10 shadow-[0_0_16px_rgba(74,222,128,0.15)]",
        isCompleted && "border-green-500/30 bg-green-500/5",
        isFailed && "border-red-500/30 bg-red-500/5",
        !isRunning && !isCompleted && !isFailed && "border-zinc-700/50 bg-zinc-900/40",
      )}
    >
      {isRunning && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
        </span>
      )}

      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
          isRunning && "bg-green-400/20",
          isCompleted && "bg-green-500/10",
          isFailed && "bg-red-500/10",
          !isRunning && !isCompleted && !isFailed && "bg-zinc-800/60",
        )}
      >
        <Icon
          className={cn(
            "w-4 h-4 transition-all duration-300",
            isRunning && "text-green-400",
            isCompleted && "text-green-500/70",
            isFailed && "text-red-400",
            !isRunning && !isCompleted && !isFailed && "text-zinc-600",
          )}
        />
      </div>

      <span
        className={cn(
          "text-[10px] font-mono font-semibold uppercase tracking-wider transition-all duration-300",
          isRunning && "text-green-400",
          isCompleted && "text-green-500/60",
          isFailed && "text-red-400/80",
          !isRunning && !isCompleted && !isFailed && "text-zinc-600",
        )}
      >
        {node.label}
      </span>

      {isRunning && (
        <motion.div
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-green-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.div>
  );
}

export function AgentPipelineBar({
  stages,
  currentStage,
  selfHealingAttempts,
  isConnected,
}: AgentPipelineBarProps) {
  const stageMap = new Map(stages.map((s) => [s.role, s]));

  const nodes: AgentNode[] = AGENT_DEFS.map((def) => {
    const stage = stageMap.get(def.role);
    return {
      role: def.role,
      label: def.label,
      status: stage?.status ?? "pending",
    };
  });

  const showFixer = selfHealingAttempts > 0 || currentStage === "fixer";
  if (showFixer) {
    nodes.push({
      role: "fixer",
      label: FIXER_DEF.label,
      status: currentStage === "fixer" ? "running" : "pending",
    });
  }

  const allDefs = showFixer ? [...AGENT_DEFS, FIXER_DEF] : AGENT_DEFS;

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-0 glass-panel rounded-2xl px-4 py-3">
        {isConnected && (
          <div className="flex items-center gap-1.5 mr-4 pr-4 border-r border-zinc-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-green-400/80 uppercase tracking-wider">
              Live
            </span>
          </div>
        )}

        {nodes.map((node, i) => {
          const def = allDefs.find((d) => d.role === node.role)!;
          const prevCompleted = i > 0 && (nodes[i - 1].status === "completed" || nodes[i - 1].status === "running");
          return (
            <div key={node.role} className="flex items-center">
              {i > 0 && <NodeConnector active={prevCompleted} />}
              <AgentNodeChip node={node} Icon={def.Icon} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
