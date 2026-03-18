import { useState, useEffect, useRef } from "react";
import { useCreateProject } from "@workspace/api-client-react";
import { Terminal, Sparkles, ArrowRight, Loader2, Cpu, Shield, Boxes } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PromptFormProps {
  onProjectCreated: (id: string) => void;
  initialPrompt?: string | null;
  designPersona?: string;
}

export function PromptForm({ onProjectCreated, initialPrompt, designPersona }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [initialPrompt]);
  const createProject = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || createProject.isPending) return;

    createProject.mutate(
      { data: { prompt, ...(designPersona ? { designPersona: designPersona as "cupertino" | "terminal" | "startup" | "editorial" | "brutalist" } : {}) } },
      {
        onSuccess: (data) => {
          onProjectCreated(data.id);
        },
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div className="text-center mb-14">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="inline-flex items-center justify-center p-4 rounded-2xl bg-primary/8 mb-8 ring-1 ring-primary/15 shadow-[0_0_60px_rgba(34,211,238,0.1)]"
        >
          <Terminal className="w-10 h-10 text-primary" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-semibold mb-4 tracking-tight text-white">
          Describe Your App
        </h1>
        <p className="text-zinc-500 text-base max-w-md mx-auto font-light">
          One prompt. Production-grade code. Enterprise-compliant.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />

        <div className="relative glass-panel rounded-2xl overflow-hidden focus-within:border-primary/30 transition-all duration-300 shadow-2xl shadow-black/40">
          <div className="flex items-center px-5 py-3 border-b border-white/[0.04]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700/80" />
            </div>
            <div className="mx-auto flex items-center gap-2 text-[11px] font-mono text-zinc-600">
              <Sparkles className="w-3 h-3 text-primary/50" />
              SYSTEM_PROMPT.EXE
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Build a task management app with user auth, real-time updates, and a dashboard..."
            className="w-full h-44 p-6 bg-transparent resize-none outline-none font-mono text-sm leading-relaxed placeholder:text-zinc-700 focus:ring-0 text-zinc-200"
            disabled={createProject.isPending}
            autoFocus
          />

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.04] bg-white/[0.01]">
            <div className="text-[11px] font-mono text-zinc-600 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-primary/80 inline-block animate-cursor-blink rounded-[1px]" />
              {createProject.isPending ? "GENERATING" : "AWAITING_INPUT"}
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || createProject.isPending}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-sm font-medium transition-all duration-300",
                !prompt.trim() || createProject.isPending
                  ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                  : "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              {createProject.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  INITIATING...
                </>
              ) : (
                <>
                  GENERATE <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {createProject.isError && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 glass-panel border-destructive/20 rounded-xl text-sm font-mono text-destructive flex items-start"
        >
          <div className="mr-3 mt-0.5 font-bold">ERR:</div>
          <div>Failed to initialize generation sequence. Please try again.</div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="mt-12 flex items-center justify-center gap-8 text-[11px] font-mono text-zinc-600"
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-primary/40" />
          <span>5-Agent Pipeline</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-zinc-800" />
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-primary/40" />
          <span>Golden Path Compliance</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-zinc-800" />
        <div className="flex items-center gap-2">
          <Boxes className="w-3.5 h-3.5 text-primary/40" />
          <span>Live Sandbox Deploy</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
