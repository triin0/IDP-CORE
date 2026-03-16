import { useState } from "react";
import { useCreateProject } from "@workspace/api-client-react";
import { Terminal, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PromptFormProps {
  onProjectCreated: (id: string) => void;
}

export function PromptForm({ onProjectCreated }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");
  const createProject = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || createProject.isPending) return;

    createProject.mutate(
      { data: { prompt } },
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
      className="w-full max-w-3xl mx-auto mt-24 px-4"
    >
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-6 shadow-[0_0_30px_rgba(34,211,238,0.15)] ring-1 ring-primary/20">
          <Terminal className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold mb-4 tracking-tight text-zinc-100">
          AI-Native <span className="text-primary font-mono tracking-normal text-3xl md:text-4xl">{"<IDP />"}</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Production-grade apps from a single prompt
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-primary/10 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
        <div className="relative flex flex-col bg-card rounded-2xl border border-border/60 shadow-xl overflow-hidden focus-within:border-primary/50 transition-colors">
          <div className="flex items-center px-4 py-3 border-b border-border/50 bg-secondary/30">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
              <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
              <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
            </div>
            <div className="mx-auto text-xs font-mono text-muted-foreground/70 flex items-center">
              <Sparkles className="w-3 h-3 mr-2 text-primary/70" />
              SYSTEM_PROMPT.EXE
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the app you want to build..."
            className="w-full h-40 p-6 bg-transparent resize-none outline-none font-mono text-sm leading-relaxed placeholder:text-zinc-600 focus:ring-0"
            disabled={createProject.isPending}
            autoFocus
          />

          <div className="flex items-center justify-between p-4 bg-secondary/20 border-t border-border/50">
            <div className="text-xs font-mono text-muted-foreground flex items-center">
              <span className="w-2 h-4 bg-primary inline-block mr-2 animate-cursor-blink"></span>
              AWAITING_INPUT
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || createProject.isPending}
              className={cn(
                "flex items-center px-6 py-2.5 rounded-lg font-mono text-sm font-medium transition-all duration-300",
                !prompt.trim() || createProject.isPending
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              {createProject.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  INITIATING...
                </>
              ) : (
                <>
                  GENERATE <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {createProject.isError && (
        <div className="mt-4 p-4 border border-destructive/50 bg-destructive/10 rounded-xl text-sm font-mono text-destructive flex items-start">
          <div className="mr-3 mt-0.5 text-destructive font-bold">ERR:</div>
          <div>Failed to initialize generation sequence. Please try again.</div>
        </div>
      )}
    </motion.div>
  );
}
