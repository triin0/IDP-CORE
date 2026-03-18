import { useState, useEffect } from "react";
import type { ProjectDetails } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock, RotateCcw, Check, AlertCircle, Trash2,
  ChevronRight, Loader2, Sparkles, Camera, Database,
  Wrench, Code2, Eraser, Undo2, History,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-base";

interface Snapshot {
  id: string;
  trigger: string;
  label: string | null;
  fileCount: number;
  totalBytes: number;
  createdAt: string;
}

interface SnapshotTimelineProps {
  project: ProjectDetails;
  onRestoreComplete?: () => void;
}

const TRIGGER_META: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pre_generate: { icon: Code2, color: "text-violet-400", label: "Pre-Generate" },
  pre_refine: { icon: Wrench, color: "text-blue-400", label: "Pre-Refine" },
  pre_wipe: { icon: Eraser, color: "text-red-400", label: "Pre-Wipe" },
  pre_inject: { icon: Database, color: "text-amber-400", label: "Pre-Inject" },
  pre_restore: { icon: Undo2, color: "text-orange-400", label: "Pre-Restore" },
  manual: { icon: Camera, color: "text-emerald-400", label: "Manual" },
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function SnapshotTimeline({ project, onRestoreComplete }: SnapshotTimelineProps) {
  const queryClient = useQueryClient();
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const snapshotsQuery = useQuery<{ snapshots: Snapshot[] }>({
    queryKey: ["snapshots", project.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}/snapshots`);
      if (!res.ok) throw new Error("Failed to load snapshots");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const manualSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Manual snapshot" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create snapshot");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshots", project.id] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}/restore/${snapshotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to restore snapshot");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["snapshots", project.id] });
      setConfirmRestoreId(null);
      onRestoreComplete?.();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}/snapshots/${snapshotId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete snapshot");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshots", project.id] });
      setConfirmDeleteId(null);
    },
  });

  const snapshots = snapshotsQuery.data?.snapshots ?? [];

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-200">Time Travel</h3>
          {snapshots.length > 0 && (
            <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">
              {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => manualSnapshotMutation.mutate()}
          disabled={manualSnapshotMutation.isPending}
          className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {manualSnapshotMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Camera className="w-3 h-3" />
          )}
          Snapshot
        </button>
      </div>

      {snapshotsQuery.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <History className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs font-mono text-zinc-600">No snapshots yet</p>
            <p className="text-[10px] text-zinc-700 mt-1">
              Snapshots are created automatically before changes,
              <br />or click the button above to create one manually.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
          {snapshots.map((snap) => {
            const meta = TRIGGER_META[snap.trigger] ?? TRIGGER_META.manual;
            const Icon = meta.icon;
            const isRestoreTarget = confirmRestoreId === snap.id;
            const isDeleteTarget = confirmDeleteId === snap.id;

            return (
              <motion.div
                key={snap.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  isRestoreTarget
                    ? "border-amber-500/30 bg-amber-500/5"
                    : isDeleteTarget
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className={cn("mt-0.5 shrink-0", meta.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-[10px] font-mono font-bold uppercase tracking-wider", meta.color)}>
                          {meta.label}
                        </span>
                      </div>
                      {snap.label && (
                        <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                          {snap.label}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-zinc-600 font-mono">
                          {formatTime(snap.createdAt)}
                        </span>
                        <span className="text-[9px] text-zinc-700">·</span>
                        <span className="text-[9px] text-zinc-600 font-mono">
                          {snap.fileCount} file{snap.fileCount !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[9px] text-zinc-700">·</span>
                        <span className="text-[9px] text-zinc-600 font-mono">
                          {formatBytes(snap.totalBytes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(null);
                        setConfirmRestoreId(snap.id);
                      }}
                      disabled={restoreMutation.isPending || deleteMutation.isPending}
                      className="p-1 rounded text-zinc-600 hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
                      title="Restore to this snapshot"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmRestoreId(null);
                        setConfirmDeleteId(snap.id);
                      }}
                      disabled={restoreMutation.isPending || deleteMutation.isPending}
                      className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      title="Delete this snapshot"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isRestoreTarget && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 pt-2 border-t border-amber-500/10">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-[10px] text-zinc-300">
                              Restore your project to this snapshot? A pre-restore snapshot will be taken first so you can undo this.
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => restoreMutation.mutate(snap.id)}
                                disabled={restoreMutation.isPending}
                                className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                              >
                                {restoreMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreId(null)}
                                disabled={restoreMutation.isPending}
                                className="text-[10px] font-mono px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {isDeleteTarget && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 pt-2 border-t border-red-500/10">
                        <div className="flex items-start gap-2">
                          <Trash2 className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-[10px] text-zinc-300">
                              Permanently delete this snapshot? This cannot be undone.
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => deleteMutation.mutate(snap.id)}
                                disabled={deleteMutation.isPending}
                                className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={deleteMutation.isPending}
                                className="text-[10px] font-mono px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {restoreMutation.isSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-mono text-emerald-400">
              Restored — Sandpack is rebooting with the recovered files
            </span>
          </motion.div>
        )}

        {restoreMutation.isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 p-2 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center gap-2"
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-[10px] font-mono text-red-400">
              {(restoreMutation.error as Error)?.message || "Restore failed"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
