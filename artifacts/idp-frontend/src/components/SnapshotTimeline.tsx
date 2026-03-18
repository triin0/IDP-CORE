import { useState } from "react";
import type { ProjectDetails } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock, GitBranch, RotateCcw, Check, AlertCircle,
  ChevronRight, Loader2, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-base";

interface Refinement {
  prompt: string;
  response: string;
  timestamp: string;
  filesChanged: string[];
  goldenPathScore?: string;
}

interface SnapshotTimelineProps {
  project: ProjectDetails;
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return ts;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function SnapshotTimeline({ project }: SnapshotTimelineProps) {
  const refinements = (project.refinements ?? []) as Refinement[];
  const queryClient = useQueryClient();
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  const rollbackMutation = useMutation({
    mutationFn: async (refinementIndex: number) => {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refinementIndex }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Rollback failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      setConfirmIndex(null);
    },
  });

  if (refinements.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-200">Timeline</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <GitBranch className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs font-mono text-zinc-600">No changes yet</p>
            <p className="text-[10px] text-zinc-700 mt-1">Use the chat to refine your app</p>
          </div>
        </div>
      </div>
    );
  }

  const versions = [
    { label: "Initial Build", prompt: project.prompt, time: project.createdAt, index: -1, filesChanged: [] as string[] },
    ...refinements.map((r, i) => ({
      label: `v${i + 2}`,
      prompt: r.prompt,
      time: r.timestamp,
      index: i,
      filesChanged: r.filesChanged ?? [],
    })),
  ];

  const currentIndex = refinements.length - 1;

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-zinc-200">Timeline</h3>
        <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">
          {versions.length} versions
        </span>
      </div>

      <div className="overflow-x-auto scrollbar-thin pb-2">
        <div className="flex gap-1 min-w-max">
          {versions.map((v, vi) => {
            const isCurrent = vi === versions.length - 1;
            const isRollbackTarget = confirmIndex !== null && vi === confirmIndex + 1;
            const canRollback = !isCurrent && vi > 0;

            return (
              <div key={vi} className="flex items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: vi * 0.03 }}
                  className={cn(
                    "relative flex flex-col items-center p-2 rounded-lg border transition-all min-w-[100px] max-w-[140px]",
                    isCurrent
                      ? "border-primary/30 bg-primary/5"
                      : isRollbackTarget
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700/50",
                  )}
                >
                  <div className={cn(
                    "w-3 h-3 rounded-full mb-1.5 shrink-0",
                    isCurrent ? "bg-primary" : vi === 0 ? "bg-violet-500" : "bg-zinc-600",
                  )} />

                  <span className={cn(
                    "text-[10px] font-mono font-bold uppercase tracking-wider mb-0.5",
                    isCurrent ? "text-primary" : "text-zinc-500",
                  )}>
                    {vi === 0 ? "v1" : v.label}
                    {isCurrent && (
                      <span className="ml-1 text-[8px] text-primary/60">NOW</span>
                    )}
                  </span>

                  <p className="text-[10px] text-zinc-400 text-center leading-tight mb-1 line-clamp-2">
                    {truncate(v.prompt, 50)}
                  </p>

                  <span className="text-[9px] text-zinc-600 font-mono">
                    {formatTime(v.time)}
                  </span>

                  {v.filesChanged.length > 0 && (
                    <span className="text-[8px] text-zinc-600 font-mono mt-0.5">
                      {v.filesChanged.length} file{v.filesChanged.length !== 1 ? "s" : ""}
                    </span>
                  )}

                  {canRollback && (
                    <button
                      type="button"
                      onClick={() => setConfirmIndex(v.index)}
                      disabled={rollbackMutation.isPending}
                      className="mt-1.5 flex items-center gap-0.5 text-[9px] font-mono text-zinc-600 hover:text-amber-400 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Restore
                    </button>
                  )}
                </motion.div>

                {vi < versions.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-zinc-700 mx-0.5 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {confirmIndex !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-zinc-300">
                    Restore to <strong>v{confirmIndex + 2}</strong>? This will undo {refinements.length - confirmIndex - 1} change{refinements.length - confirmIndex - 1 !== 1 ? "s" : ""}.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => rollbackMutation.mutate(confirmIndex)}
                      disabled={rollbackMutation.isPending}
                      className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                    >
                      {rollbackMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmIndex(null)}
                      disabled={rollbackMutation.isPending}
                      className="text-[10px] font-mono px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {rollbackMutation.isError && (
                    <p className="text-[10px] text-red-400 mt-1.5">
                      {(rollbackMutation.error as Error)?.message || "Rollback failed"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {rollbackMutation.isSuccess && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono text-emerald-400">
            Restored successfully — your project is back to the selected version
          </span>
        </motion.div>
      )}
    </div>
  );
}
