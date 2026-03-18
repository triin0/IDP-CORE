import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRefineProject } from "@workspace/api-client-react";
import type { ProjectRefinement, RefineProjectResponse } from "@workspace/api-client-react";
import {
  Send, Loader2, FileCode2, CheckCircle2, GitCompare, Zap,
  Bot, MessageSquare, Sparkles, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { DiffViewer, type DiffFile } from "./DiffViewer";
import { useCredits } from "@/hooks/useCredits";

interface ExtendedRefineResponse extends RefineProjectResponse {
  previousFiles?: Array<{ path: string; content: string }>;
  files?: Array<{ path: string; content: string }>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  filesChanged?: string[];
  goldenPathScore?: string;
  diffs?: DiffFile[];
  isError?: boolean;
}

interface RefinementChatProps {
  projectId: string;
  refinements: ProjectRefinement[];
  projectFiles: Array<{ path: string; content: string }>;
}

const SUGGESTION_CHIPS = [
  { label: "Change the colors", icon: "🎨", prompt: "Change the color scheme to feel more warm and inviting" },
  { label: "Add a new page", icon: "📄", prompt: "Add a new 'About Us' page with a team section and company mission statement" },
  { label: "Make it mobile-friendly", icon: "📱", prompt: "Improve the responsive design so it looks great on mobile phones" },
  { label: "Add dark mode", icon: "🌙", prompt: "Add a dark mode toggle that lets users switch between light and dark themes" },
  { label: "Improve the header", icon: "✨", prompt: "Make the header navigation more professional with a logo area and better spacing" },
  { label: "Add search", icon: "🔍", prompt: "Add a search bar that lets users find content quickly" },
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary/60"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

function FileChangeBadge({ files, onViewDiff }: { files: string[]; onViewDiff?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2 rounded-lg border border-primary/10 bg-primary/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-mono text-primary/70 hover:text-primary transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <FileCode2 className="w-3 h-3" />
          {files.length} file{files.length !== 1 ? "s" : ""} updated
        </span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 space-y-0.5">
              {files.map((f) => (
                <div key={f} className="text-[10px] font-mono text-zinc-500 truncate">{f}</div>
              ))}
              {onViewDiff && (
                <button
                  type="button"
                  onClick={onViewDiff}
                  className="flex items-center gap-1 mt-1 text-[10px] font-mono text-primary hover:text-primary/80 transition-colors"
                >
                  <GitCompare className="w-3 h-3" />
                  View what changed
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RefinementChat({ projectId, refinements, projectFiles }: RefinementChatProps) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [diffFiles, setDiffFiles] = useState<DiffFile[] | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { balance, costs, refetch: refetchCredits } = useCredits();

  const canAffordRefinement = balance >= costs.refinement;

  const refineMut = useRefineProject();
  const isRefining = refineMut.isPending;

  useEffect(() => {
    setMessages([]);
    setPrompt("");
    setDiffFiles(null);
    setIsExpanded(false);
  }, [projectId]);

  useEffect(() => {
    if (refinements.length > 0 && messages.length === 0) {
      const historical: ChatMessage[] = [];
      refinements.forEach((r, i) => {
        historical.push({
          id: `hist-user-${i}`,
          role: "user",
          content: r.prompt,
          timestamp: new Date(r.timestamp),
        });

        const prevFiles = (r as unknown as Record<string, unknown>).previousFiles as
          Array<{ path: string; content: string }> | undefined;
        let diffs: DiffFile[] | undefined;
        if (prevFiles && prevFiles.length > 0) {
          diffs = r.filesChanged.map((changedPath) => {
            const prev = prevFiles.find((f) => f.path === changedPath);
            const current = projectFiles.find((f) => f.path === changedPath);
            return {
              path: changedPath,
              oldContent: prev?.content ?? "",
              newContent: current?.content ?? "",
            };
          });
        }

        historical.push({
          id: `hist-ai-${i}`,
          role: "assistant",
          content: r.response || `Done! I updated ${r.filesChanged.length} file${r.filesChanged.length !== 1 ? "s" : ""}.`,
          timestamp: new Date(r.timestamp),
          filesChanged: r.filesChanged,
          goldenPathScore: r.goldenPathScore ?? undefined,
          diffs,
        });
      });
      setMessages(historical);
    }
  }, [refinements, projectFiles]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRefining]);

  const handleSubmit = (overridePrompt?: string) => {
    const trimmed = (overridePrompt || prompt).trim();
    if (!trimmed || isRefining) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");

    refineMut.mutate(
      { id: projectId, data: { prompt: trimmed } },
      {
        onSuccess: (rawData) => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
          refetchCredits();

          const data = rawData as ExtendedRefineResponse;
          const previousFilesData = data.previousFiles ?? [];
          const filesChanged = data.filesChanged ?? [];

          let diffs: DiffFile[] | undefined;
          if (previousFilesData.length > 0 && filesChanged.length > 0) {
            const newFiles = data.files ?? projectFiles;
            diffs = filesChanged
              .map((changedPath) => {
                const prev = previousFilesData.find((f) => f.path === changedPath);
                const current = newFiles.find((f) => f.path === changedPath);
                return {
                  path: changedPath,
                  oldContent: prev?.content ?? "",
                  newContent: current?.content ?? "",
                };
              })
              .filter((d) => d.oldContent !== d.newContent || !d.oldContent);
          }

          const responseText = data.refinement?.response
            || `Done! I updated ${filesChanged.length} file${filesChanged.length !== 1 ? "s" : ""}. Everything passed verification.`;

          const aiMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content: responseText,
            timestamp: new Date(),
            filesChanged: filesChanged.length > 0 ? filesChanged : undefined,
            diffs: diffs && diffs.length > 0 ? diffs : undefined,
          };
          setMessages((prev) => [...prev, aiMsg]);
        },
        onError: (err) => {
          const errorMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `I ran into a problem: ${err.message || "Something went wrong"}. Want to try again or try a different approach?`,
            timestamp: new Date(),
            isError: true,
          };
          setMessages((prev) => [...prev, errorMsg]);
        },
      },
    );
  };

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

  const hasMessages = messages.length > 0;
  const showSuggestions = !hasMessages && !isRefining;

  return (
    <div className="border-t border-border bg-card flex flex-col">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-primary/10">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-mono text-zinc-300">
            Tell me what to change
          </span>
          {messages.length > 0 && (
            <span className="text-[9px] font-mono text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
              {messages.filter((m) => m.role === "user").length} edit{messages.filter((m) => m.role === "user").length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-zinc-600">
            <Zap className="w-2.5 h-2.5" />{costs.refinement} per edit
          </span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-500 transition-transform", isExpanded && "rotate-180")} />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50">
              {(hasMessages || isRefining) && (
                <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-2",
                        msg.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className={cn(
                          "shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
                          msg.isError ? "bg-destructive/10" : "bg-primary/10",
                        )}>
                          <Bot className={cn("w-3.5 h-3.5", msg.isError ? "text-destructive" : "text-primary")} />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-xl px-3 py-2",
                          msg.role === "user"
                            ? "bg-primary/10 border border-primary/20 text-zinc-200"
                            : msg.isError
                              ? "bg-destructive/5 border border-destructive/20 text-zinc-300"
                              : "bg-zinc-800/50 border border-zinc-700/50 text-zinc-300",
                        )}
                      >
                        <p className="text-xs leading-relaxed">{msg.content}</p>

                        {msg.filesChanged && msg.filesChanged.length > 0 && (
                          <FileChangeBadge
                            files={msg.filesChanged}
                            onViewDiff={msg.diffs ? () => setDiffFiles(msg.diffs!) : undefined}
                          />
                        )}

                        {msg.goldenPathScore && (
                          <div className="flex items-center gap-1 mt-2 text-[10px] font-mono text-success/70">
                            <CheckCircle2 className="w-3 h-3" />
                            Golden Path: {msg.goldenPathScore}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {isRefining && (
                    <div className="flex gap-2 justify-start">
                      <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-primary/10 mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-3 py-2">
                        <TypingIndicator />
                        <p className="text-[10px] text-zinc-500 font-mono mt-1">Working on it...</p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}

              {showSuggestions && (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3 h-3 text-primary/50" />
                    <span className="text-[10px] font-mono text-zinc-600">QUICK EDITS</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => {
                          setPrompt(chip.prompt);
                          inputRef.current?.focus();
                        }}
                        disabled={!canAffordRefinement}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all",
                          canAffordRefinement
                            ? "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-primary/30 hover:text-zinc-200 hover:bg-primary/5"
                            : "bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed",
                        )}
                      >
                        <span>{chip.icon}</span>
                        <span>{chip.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-3 pb-3 pt-1 flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isRefining || !canAffordRefinement}
                  placeholder={
                    !canAffordRefinement
                      ? `Need ${costs.refinement} credits (have ${balance})`
                      : "Tell me what to change..."
                  }
                  rows={1}
                  className={cn(
                    "flex-1 bg-zinc-900 border border-border rounded-xl px-3 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all",
                    (isRefining || !canAffordRefinement) && "opacity-50 cursor-not-allowed",
                  )}
                  style={{ minHeight: "40px", maxHeight: "100px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "40px";
                    target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
                  }}
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={!prompt.trim() || isRefining || !canAffordRefinement}
                  className={cn(
                    "p-2.5 rounded-xl transition-all",
                    prompt.trim() && !isRefining && canAffordRefinement
                      ? "bg-primary text-primary-foreground hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                      : "bg-zinc-800 text-zinc-600 cursor-not-allowed",
                  )}
                  title={!canAffordRefinement ? `Requires ${costs.refinement} credits` : "Send"}
                >
                  {isRefining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
