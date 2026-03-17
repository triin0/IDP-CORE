import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRefineProject } from "@workspace/api-client-react";
import type { ProjectRefinement, RefineProjectResponse } from "@workspace/api-client-react";
import { Send, Loader2, ChevronDown, ChevronUp, FileCode2, CheckCircle2, Clock, GitCompare, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { DiffViewer, type DiffFile } from "./DiffViewer";
import { useCredits } from "@/hooks/useCredits";

interface ExtendedRefineResponse extends RefineProjectResponse {
  previousFiles?: Array<{ path: string; content: string }>;
  files?: Array<{ path: string; content: string }>;
}

interface RefinementChatProps {
  projectId: string;
  refinements: ProjectRefinement[];
  projectFiles: Array<{ path: string; content: string }>;
}

export function RefinementChat({ projectId, refinements, projectFiles }: RefinementChatProps) {
  const [prompt, setPrompt] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [diffFiles, setDiffFiles] = useState<DiffFile[] | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { balance, costs, refetch: refetchCredits } = useCredits();

  const canAffordRefinement = balance >= costs.refinement;

  const refineMut = useRefineProject();
  const isRefining = refineMut.isPending;

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || isRefining) return;

    refineMut.mutate(
      { id: projectId, data: { prompt: trimmed } },
      {
        onSuccess: (rawData) => {
          setPrompt("");
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
          refetchCredits();

          const data = rawData as ExtendedRefineResponse;
          const previousFilesData = data.previousFiles ?? [];
          const filesChanged = data.filesChanged ?? [];

          if (previousFilesData.length > 0 && filesChanged.length > 0) {
            const newFiles = data.files ?? projectFiles;
            const diffs: DiffFile[] = filesChanged.map((changedPath) => {
              const prev = previousFilesData.find((f) => f.path === changedPath);
              const current = newFiles.find((f) => f.path === changedPath);

              return {
                path: changedPath,
                oldContent: prev?.content ?? "",
                newContent: current?.content ?? "",
              };
            }).filter((d) => d.oldContent !== d.newContent || !d.oldContent);

            if (diffs.length > 0) {
              setDiffFiles(diffs);
            }
          }
        },
      },
    );
  };

  const showDiffFromHistory = useCallback((refinement: ProjectRefinement) => {
    const prevFiles = (refinement as unknown as Record<string, unknown>).previousFiles as
      Array<{ path: string; content: string }> | undefined;

    if (!prevFiles || prevFiles.length === 0) return;

    const diffs: DiffFile[] = refinement.filesChanged.map((changedPath) => {
      const prev = prevFiles.find((f) => f.path === changedPath);
      const current = projectFiles.find((f) => f.path === changedPath);
      return {
        path: changedPath,
        oldContent: prev?.content ?? "",
        newContent: current?.content ?? "",
      };
    });

    setDiffFiles(diffs);
  }, [projectFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (!isRefining && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRefining]);

  if (diffFiles) {
    return (
      <div className="border-t border-border" style={{ height: "50vh" }}>
        <DiffViewer files={diffFiles} onClose={() => setDiffFiles(null)} />
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card">
      {refinements.length > 0 && (
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        >
          <span>Refinement History ({refinements.length})</span>
          {showHistory ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
        </button>
      )}

      <AnimatePresence>
        {showHistory && refinements.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto border-t border-border/50 scrollbar-thin">
              {refinements.map((r, i) => (
                <div
                  key={i}
                  className="px-4 py-2 border-b border-border/30 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 p-1 rounded bg-primary/10">
                      <FileCode2 className="w-3 h-3 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-300 font-mono truncate">
                        {r.prompt}
                      </p>
                      {r.response && (
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">
                          {"\u2192"} {r.response}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(r.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                          <FileCode2 className="w-2.5 h-2.5" />
                          {r.filesChanged.length} files
                        </span>
                        {r.goldenPathScore && (
                          <span className="flex items-center gap-1 text-[10px] text-success">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {r.goldenPathScore}
                          </span>
                        )}
                        {Boolean((r as unknown as Record<string, unknown>).previousFiles) && (
                          <button
                            onClick={() => showDiffFromHistory(r)}
                            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                          >
                            <GitCompare className="w-2.5 h-2.5" />
                            View Diff
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isRefining && (
        <div className="px-4 py-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs font-mono text-primary animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Refining project...</span>
          </div>
          {refineMut.variables && (
            <p className="mt-1 text-[10px] text-zinc-600 font-mono truncate pl-5">
              &quot;{(refineMut.variables as { data: { prompt: string } }).data.prompt}&quot;
            </p>
          )}
        </div>
      )}

      {refineMut.isError && (
        <div className="px-4 py-2 border-t border-destructive/30 bg-destructive/5">
          <p className="text-[10px] font-mono text-destructive">
            Refinement failed: {refineMut.error?.message || "Unknown error"}
          </p>
        </div>
      )}

      <div className="p-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRefining || !canAffordRefinement}
          placeholder={canAffordRefinement
            ? "Refine: \"add authentication\", \"switch to MongoDB\", \"add dark mode\"..."
            : `Insufficient credits (need ${costs.refinement}, have ${balance})`
          }
          rows={1}
          className={cn(
            "flex-1 bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all",
            (isRefining || !canAffordRefinement) && "opacity-50 cursor-not-allowed",
          )}
          style={{ minHeight: "36px", maxHeight: "80px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "36px";
            target.style.height = `${Math.min(target.scrollHeight, 80)}px`;
          }}
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-zinc-500">
            <Zap className="w-2.5 h-2.5" />{costs.refinement}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isRefining || !canAffordRefinement}
            className={cn(
              "p-2 rounded-lg transition-all",
              prompt.trim() && !isRefining && canAffordRefinement
                ? "bg-primary text-primary-foreground hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed",
            )}
            title={!canAffordRefinement ? `Requires ${costs.refinement} credits` : undefined}
          >
            {isRefining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
