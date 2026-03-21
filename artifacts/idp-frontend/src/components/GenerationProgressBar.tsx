import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGE_SAYINGS: Record<string, string[]> = {
  architect: [
    "Designing the system architecture...",
    "Mapping data models and relationships...",
    "Planning API routes and endpoints...",
    "Choosing the right patterns for your app...",
    "Structuring the database schema...",
    "Laying the foundation for your project...",
    "Analyzing requirements and constraints...",
    "Blueprinting the full-stack structure...",
  ],
  backend: [
    "Writing server-side logic...",
    "Generating API handlers and middleware...",
    "Wiring up database queries with Drizzle...",
    "Building authentication flows...",
    "Crafting validation schemas...",
    "Setting up Express routes...",
    "Connecting the data layer...",
    "Implementing business logic...",
  ],
  frontend: [
    "Crafting the user interface...",
    "Building React components...",
    "Styling with Tailwind CSS...",
    "Wiring up API client hooks...",
    "Creating forms and interactions...",
    "Designing responsive layouts...",
    "Adding client-side routing...",
    "Polishing the user experience...",
  ],
  security: [
    "Auditing for Golden Path compliance...",
    "Scanning for security vulnerabilities...",
    "Validating dependency integrity...",
    "Checking import patterns...",
    "Enforcing coding standards...",
    "Running static analysis...",
  ],
  verification: [
    "Compiling TypeScript — moment of truth...",
    "Running the build verification gate...",
    "Checking for type errors...",
    "Validating the full project build...",
    "Almost there — verifying everything compiles...",
    "Testing dependency resolution...",
  ],
  fixer: [
    "Diagnosing build errors...",
    "Applying targeted fixes...",
    "Self-healing in progress...",
    "Patching type mismatches...",
    "Rewriting problematic imports...",
    "Correcting the code autonomously...",
  ],
  default: [
    "Generating your application...",
    "AI agents are hard at work...",
    "Building something great...",
    "Assembling your full-stack app...",
    "Transforming your idea into code...",
    "Creating production-ready code...",
  ],
};

const STAGE_WEIGHTS: Record<string, number> = {
  architect: 15,
  backend: 30,
  frontend: 30,
  security: 10,
  verification: 15,
};

function computeProgress(
  stages: Array<{ role: string; status: string }>,
  currentStage: string | null,
): number {
  let progress = 0;
  const orderedRoles = ["architect", "backend", "frontend", "security", "verification"];

  for (const role of orderedRoles) {
    const stage = stages.find(s => s.role === role);
    const weight = STAGE_WEIGHTS[role] || 10;

    if (stage?.status === "completed") {
      progress += weight;
    } else if (stage?.status === "running" || role === currentStage) {
      progress += weight * 0.4;
      break;
    } else {
      break;
    }
  }

  return Math.min(Math.round(progress), 100);
}

interface GenerationProgressBarProps {
  stages: Array<{
    role: string;
    status: string;
  }>;
  currentStage: string | null;
  selfHealingAttempts: number;
  isConnected: boolean;
}

export function GenerationProgressBar({
  stages,
  currentStage,
  selfHealingAttempts,
  isConnected,
}: GenerationProgressBarProps) {
  const [sayingIndex, setSayingIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progress = computeProgress(stages, currentStage);

  const activeStage = currentStage || "default";
  const sayings = STAGE_SAYINGS[activeStage] || STAGE_SAYINGS.default;

  useEffect(() => {
    setSayingIndex(0);
  }, [activeStage]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setSayingIndex(prev => (prev + 1) % sayings.length);
    }, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sayings.length]);

  const currentSaying = sayings[sayingIndex % sayings.length];

  return (
    <div className="w-full mb-4 px-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles className={cn(
            "w-3.5 h-3.5 flex-shrink-0 transition-colors",
            isConnected ? "text-primary" : "text-zinc-600",
          )} />
          <AnimatePresence mode="wait">
            <motion.span
              key={currentSaying}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-xs font-medium text-zinc-300 truncate"
            >
              {currentSaying}
            </motion.span>
          </AnimatePresence>
        </div>
        <span className="text-xs font-mono font-semibold text-zinc-400 flex-shrink-0 ml-3">
          {progress}%
        </span>
      </div>

      <div className="relative w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden ring-1 ring-white/[0.04]">
        <motion.div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            selfHealingAttempts > 0
              ? "bg-gradient-to-r from-orange-500 to-orange-400"
              : "bg-gradient-to-r from-primary/80 to-primary",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />

        {progress > 0 && progress < 100 && (
          <motion.div
            className="absolute inset-y-0 rounded-full bg-white/10"
            style={{ left: `${Math.max(progress - 15, 0)}%`, width: "15%" }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      {selfHealingAttempts > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-1.5 text-[10px] font-mono text-orange-400/80"
        >
          Self-healing attempt {selfHealingAttempts}/3 — fixing build errors automatically
        </motion.div>
      )}
    </div>
  );
}
