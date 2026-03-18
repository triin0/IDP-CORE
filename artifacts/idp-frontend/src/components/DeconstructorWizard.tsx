import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Puzzle,
  Loader2,
  ArrowRight,
  Check,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Zap,
  CircleDot,
  Triangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Feature {
  name: string;
  description: string;
  complexity: "low" | "medium" | "high";
  defaultOn: boolean;
  enabled: boolean;
  custom?: boolean;
}

interface Category {
  name: string;
  icon: string;
  features: Feature[];
  expanded: boolean;
}

interface DeconstructResult {
  appName: string;
  tagline: string;
  categories: Array<{
    name: string;
    icon: string;
    features: Array<{
      name: string;
      description: string;
      complexity: "low" | "medium" | "high";
      defaultOn: boolean;
    }>;
  }>;
}

interface DeconstructorWizardProps {
  onBuildPrompt: (enrichedPrompt: string) => void;
}

const COMPLEXITY_CONFIG = {
  low: { label: "Simple", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: CircleDot },
  medium: { label: "Moderate", color: "text-amber-400", bg: "bg-amber-400/10", icon: Zap },
  high: { label: "Complex", color: "text-rose-400", bg: "bg-rose-400/10", icon: Triangle },
};

export function DeconstructorWizard({ onBuildPrompt }: DeconstructorWizardProps) {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeconstructResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addingToCategory, setAddingToCategory] = useState<number | null>(null);
  const [newFeatureName, setNewFeatureName] = useState("");

  const deconstruct = useCallback(async () => {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/deconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data: DeconstructResult = await res.json();
      setResult(data);
      setCategories(
        data.categories.map((cat) => ({
          ...cat,
          expanded: true,
          features: cat.features.map((f) => ({ ...f, enabled: f.defaultOn })),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [idea, loading]);

  const toggleFeature = (catIdx: number, featIdx: number) => {
    setCategories((prev) =>
      prev.map((cat, ci) =>
        ci === catIdx
          ? {
              ...cat,
              features: cat.features.map((f, fi) =>
                fi === featIdx ? { ...f, enabled: !f.enabled } : f
              ),
            }
          : cat
      )
    );
  };

  const toggleCategory = (catIdx: number) => {
    setCategories((prev) =>
      prev.map((cat, ci) => (ci === catIdx ? { ...cat, expanded: !cat.expanded } : cat))
    );
  };

  const removeFeature = (catIdx: number, featIdx: number) => {
    setCategories((prev) =>
      prev.map((cat, ci) =>
        ci === catIdx
          ? { ...cat, features: cat.features.filter((_, fi) => fi !== featIdx) }
          : cat
      )
    );
  };

  const addCustomFeature = (catIdx: number) => {
    if (!newFeatureName.trim()) return;
    setCategories((prev) =>
      prev.map((cat, ci) =>
        ci === catIdx
          ? {
              ...cat,
              features: [
                ...cat.features,
                {
                  name: newFeatureName.trim(),
                  description: "Custom feature added by you",
                  complexity: "medium" as const,
                  defaultOn: true,
                  enabled: true,
                  custom: true,
                },
              ],
            }
          : cat
      )
    );
    setNewFeatureName("");
    setAddingToCategory(null);
  };

  const buildEnrichedPrompt = () => {
    if (!result) return;

    const enabledFeatures = categories
      .flatMap((cat) =>
        cat.features
          .filter((f) => f.enabled)
          .map((f) => `- ${cat.name}: ${f.name} — ${f.description}`)
      )
      .join("\n");

    const prompt = `Build "${result.appName}" — ${result.tagline}

Original idea: ${idea}

Required features:
${enabledFeatures}

Build this as a full-stack web application following all Golden Path standards.`;

    onBuildPrompt(prompt);
  };

  const totalFeatures = categories.reduce((sum, cat) => sum + cat.features.length, 0);
  const enabledCount = categories.reduce(
    (sum, cat) => sum + cat.features.filter((f) => f.enabled).length,
    0
  );

  if (!result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        <div className="w-full text-left group cursor-default">
          <div className="glass-panel rounded-2xl p-6 border border-white/[0.04] hover:border-primary/20 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/8 ring-1 ring-primary/15">
                <Puzzle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">App Deconstructor</h3>
                <p className="text-[11px] text-zinc-600 font-mono">
                  Break your idea into building blocks before committing credits
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                id="deconstructor-input"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    deconstruct();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder='e.g. "Something like Airbnb but for power tools"'
                className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm font-mono text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-primary/30 transition-colors"
                disabled={loading}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deconstruct();
                }}
                disabled={!idea.trim() || loading}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-medium transition-all duration-300 whitespace-nowrap",
                  !idea.trim() || loading
                    ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                    : "bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ANALYZING
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    DECONSTRUCT
                  </>
                )}
              </button>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-xs font-mono text-destructive"
              >
                ERR: {error}
              </motion.p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.04]">
        <div className="px-6 py-5 border-b border-white/[0.04] bg-white/[0.01]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Puzzle className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-semibold text-white">{result.appName}</h2>
              </div>
              <p className="text-sm text-zinc-500">{result.tagline}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[11px] font-mono text-zinc-600">MODULES</div>
                <div className="text-sm font-mono text-primary">
                  {enabledCount}/{totalFeatures}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setCategories([]);
                }}
                className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {categories.map((cat, catIdx) => (
            <div key={cat.name} className="border-b border-white/[0.03] last:border-b-0">
              <button
                type="button"
                onClick={() => toggleCategory(catIdx)}
                className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
              >
                <span className="text-base">{cat.icon}</span>
                <span className="text-sm font-medium text-zinc-300 flex-1">{cat.name}</span>
                <span className="text-[10px] font-mono text-zinc-600">
                  {cat.features.filter((f) => f.enabled).length}/{cat.features.length}
                </span>
                {cat.expanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </button>

              <AnimatePresence>
                {cat.expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-3 space-y-1">
                      {cat.features.map((feat, featIdx) => {
                        const complexity = COMPLEXITY_CONFIG[feat.complexity];
                        const ComplexityIcon = complexity.icon;
                        return (
                          <div
                            key={feat.name}
                            className={cn(
                              "flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                              feat.enabled
                                ? "bg-white/[0.03]"
                                : "bg-transparent opacity-50"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => toggleFeature(catIdx, featIdx)}
                              className={cn(
                                "mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all",
                                feat.enabled
                                  ? "bg-primary/20 border-primary/40 text-primary"
                                  : "border-zinc-700 text-transparent hover:border-zinc-500"
                              )}
                            >
                              {feat.enabled && <Check className="w-2.5 h-2.5" />}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-zinc-200">{feat.name}</span>
                                {feat.custom && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                    CUSTOM
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1",
                                    complexity.bg,
                                    complexity.color
                                  )}
                                >
                                  <ComplexityIcon className="w-2 h-2" />
                                  {complexity.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                                {feat.description}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFeature(catIdx, featIdx)}
                              className="mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/5 text-zinc-700 hover:text-zinc-400 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}

                      {addingToCategory === catIdx ? (
                        <div className="flex items-center gap-2 px-3 py-2">
                          <input
                            value={newFeatureName}
                            onChange={(e) => setNewFeatureName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addCustomFeature(catIdx);
                              if (e.key === "Escape") setAddingToCategory(null);
                            }}
                            placeholder="Feature name..."
                            className="flex-1 bg-white/[0.03] border border-primary/20 rounded-lg px-3 py-1.5 text-sm font-mono text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-primary/40"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => addCustomFeature(catIdx)}
                            disabled={!newFeatureName.trim()}
                            className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-30"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingToCategory(null);
                              setNewFeatureName("");
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingToCategory(catIdx)}
                          className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-zinc-600 hover:text-primary transition-colors w-full rounded-lg hover:bg-white/[0.02]"
                        >
                          <Plus className="w-3 h-3" />
                          Add feature
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
          <div className="text-[11px] font-mono text-zinc-600">
            {enabledCount} feature{enabledCount !== 1 ? "s" : ""} selected
          </div>
          <button
            type="button"
            onClick={buildEnrichedPrompt}
            disabled={enabledCount === 0}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-sm font-medium transition-all duration-300",
              enabledCount === 0
                ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                : "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:-translate-y-0.5 active:translate-y-0"
            )}
          >
            BUILD THIS <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
