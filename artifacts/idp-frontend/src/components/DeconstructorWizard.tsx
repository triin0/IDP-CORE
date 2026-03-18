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
  Eye,
  Coins,
  Paintbrush,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DesignPersonaId = "cupertino" | "terminal" | "startup" | "editorial" | "brutalist";

interface PersonaOption {
  id: DesignPersonaId;
  name: string;
  tagline: string;
  emoji: string;
  preview: {
    bg: string;
    accent: string;
    text: string;
    border: string;
  };
}

const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: "cupertino",
    name: "Cupertino",
    tagline: "Clean & elegant",
    emoji: "🍎",
    preview: { bg: "bg-white", accent: "bg-blue-500", text: "text-gray-900", border: "border-gray-200" },
  },
  {
    id: "terminal",
    name: "Terminal",
    tagline: "Dark & hacker",
    emoji: "💻",
    preview: { bg: "bg-[#0A0A0F]", accent: "bg-green-400", text: "text-green-400", border: "border-green-900" },
  },
  {
    id: "startup",
    name: "Startup",
    tagline: "Bold & vibrant",
    emoji: "🚀",
    preview: { bg: "bg-[#0F172A]", accent: "bg-gradient-to-r from-purple-500 to-pink-500", text: "text-white", border: "border-purple-500/30" },
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Refined & typographic",
    emoji: "📰",
    preview: { bg: "bg-[#FAF8F5]", accent: "bg-[#C45D3E]", text: "text-[#3D3D3D]", border: "border-[#E5E2DB]" },
  },
  {
    id: "brutalist",
    name: "Brutalist",
    tagline: "Raw & loud",
    emoji: "🏗️",
    preview: { bg: "bg-white", accent: "bg-black", text: "text-black", border: "border-black border-2" },
  },
];

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
  onBuildPrompt: (enrichedPrompt: string, designPersona?: DesignPersonaId) => void;
}

const COMPLEXITY_CONFIG = {
  low: { label: "Simple", color: "text-emerald-400", bars: 1, barColor: "bg-emerald-400" },
  medium: { label: "Moderate", color: "text-amber-400", bars: 2, barColor: "bg-amber-400" },
  high: { label: "Complex", color: "text-rose-400", bars: 3, barColor: "bg-rose-400" },
};

const BASE_CREDITS = 50;
const COMPLEX_FEATURE_COST = 3;

function ComplexityBars({ level }: { level: "low" | "medium" | "high" }) {
  const config = COMPLEXITY_CONFIG[level];
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "w-1 h-3 rounded-full transition-all",
            i <= config.bars ? config.barColor : "bg-zinc-800"
          )}
        />
      ))}
      <span className={cn("text-[9px] font-mono ml-1", config.color)}>
        {config.label}
      </span>
    </span>
  );
}

function GhostPreview({
  appName,
  tagline,
  features,
}: {
  appName: string;
  tagline: string;
  features: Array<{ category: string; name: string; description: string }>;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ghost-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, tagline, features }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || "Request failed");
      }
      const data = await res.json();
      setCode(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setLoading(false);
    }
  }, [appName, tagline, features]);

  if (!code && !loading) {
    return (
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/[0.08] hover:border-primary/30 bg-white/[0.01] hover:bg-primary/[0.03] transition-all duration-300 text-zinc-500 hover:text-primary font-mono text-xs group"
      >
        <Eye className="w-3.5 h-3.5" />
        GHOST PREVIEW — See a mockup before you build
      </button>
    );
  }

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center gap-3 px-4 py-8 rounded-xl border border-primary/10 bg-primary/[0.02]">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-xs font-mono text-zinc-500">
          RENDERING PREVIEW...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-4 py-3 rounded-xl border border-destructive/20 bg-destructive/[0.03]">
        <p className="text-xs font-mono text-destructive">ERR: {error}</p>
        <button
          type="button"
          onClick={generate}
          className="mt-2 text-[10px] font-mono text-zinc-500 hover:text-primary transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (code) {
    const srcDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a12;color:#e4e4e7;overflow-x:hidden}#_err{display:none;padding:24px;text-align:center;color:#f87171;font-family:monospace;font-size:12px}</style>
</head>
<body>
<div id="root"></div>
<div id="_err"></div>
<script>window.onerror=function(m){document.getElementById('_err').style.display='block';document.getElementById('_err').textContent='Render error: '+m;};window.onunhandledrejection=function(e){document.getElementById('_err').style.display='block';document.getElementById('_err').textContent='Error: '+(e.reason||'Unknown');}</script>
<script src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel">
${code}
const _C = typeof App !== 'undefined' ? App : (typeof GhostPreview !== 'undefined' ? GhostPreview : () => React.createElement('div',{style:{padding:'40px',textAlign:'center',color:'#71717a'}},'Preview unavailable'));
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(_C));
</script>
</body>
</html>`;

    return (
      <div className="w-full rounded-xl overflow-hidden border border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Eye className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-mono text-zinc-500">GHOST_PREVIEW.EXE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-zinc-700">NON-FUNCTIONAL MOCKUP</span>
            <button
              type="button"
              onClick={() => { setCode(null); setError(null); }}
              className="p-1 rounded hover:bg-white/5 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
        <iframe
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          className="w-full h-[400px] bg-[#0a0a12]"
          title="Ghost Preview"
        />
      </div>
    );
  }

  return null;
}

export function DeconstructorWizard({ onBuildPrompt }: DeconstructorWizardProps) {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeconstructResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addingToCategory, setAddingToCategory] = useState<number | null>(null);
  const [newFeatureName, setNewFeatureName] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<DesignPersonaId | null>(null);

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

    const personaLine = selectedPersona
      ? `\nDesign Style: ${PERSONA_OPTIONS.find(p => p.id === selectedPersona)?.name ?? selectedPersona}`
      : "";

    const prompt = `Build "${result.appName}" — ${result.tagline}

Original idea: ${idea}${personaLine}

Required features:
${enabledFeatures}

Build this as a full-stack web application following all Golden Path standards.`;

    onBuildPrompt(prompt, selectedPersona ?? undefined);
  };

  const totalFeatures = categories.reduce((sum, cat) => sum + cat.features.length, 0);
  const enabledCount = categories.reduce(
    (sum, cat) => sum + cat.features.filter((f) => f.enabled).length,
    0
  );

  const enabledFeatures = categories.flatMap((cat) =>
    cat.features.filter((f) => f.enabled)
  );
  const complexCount = enabledFeatures.filter((f) => f.complexity === "high").length;
  const estimatedCredits = BASE_CREDITS + complexCount * COMPLEX_FEATURE_COST;

  const ghostFeatures = categories.flatMap((cat) =>
    cat.features
      .filter((f) => f.enabled)
      .map((f) => ({ category: cat.name, name: f.name, description: f.description }))
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
      className="w-full space-y-4"
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
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[11px] font-mono text-zinc-600">MODULES</div>
                <div className="text-sm font-mono text-primary">
                  {enabledCount}/{totalFeatures}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-mono text-zinc-600 flex items-center gap-1 justify-end">
                  <Coins className="w-3 h-3" />
                  EST. COST
                </div>
                <div className="text-sm font-mono text-amber-400">
                  {estimatedCredits} cr
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
                      {cat.features.map((feat, featIdx) => (
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
                            aria-label={`Toggle ${feat.name}`}
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
                              <ComplexityBars level={feat.complexity} />
                            </div>
                            <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                              {feat.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFeature(catIdx, featIdx)}
                            aria-label={`Remove ${feat.name}`}
                            className="mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/5 text-zinc-700 hover:text-zinc-400 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

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
                            aria-label="Confirm add feature"
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
                            aria-label="Cancel add feature"
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

        <div className="px-6 py-4 border-t border-white/[0.04] bg-white/[0.01] space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Paintbrush className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-mono text-zinc-500">DESIGN PERSONA</span>
              {selectedPersona && (
                <button
                  type="button"
                  onClick={() => setSelectedPersona(null)}
                  className="ml-auto text-[9px] font-mono text-zinc-700 hover:text-zinc-400 transition-colors"
                >
                  CLEAR
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {PERSONA_OPTIONS.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => setSelectedPersona(selectedPersona === persona.id ? null : persona.id)}
                  className={cn(
                    "group relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200",
                    selectedPersona === persona.id
                      ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/20"
                      : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]"
                  )}
                >
                  <div className={cn(
                    "w-full h-8 rounded-md flex items-center justify-center overflow-hidden border",
                    persona.preview.bg,
                    persona.preview.border
                  )}>
                    <div className={cn("w-10 h-1.5 rounded-full", persona.preview.accent)} />
                  </div>
                  <span className="text-lg leading-none">{persona.emoji}</span>
                  <span className={cn(
                    "text-[10px] font-mono font-medium",
                    selectedPersona === persona.id ? "text-primary" : "text-zinc-400"
                  )}>
                    {persona.name}
                  </span>
                  <span className="text-[8px] font-mono text-zinc-600 leading-tight">
                    {persona.tagline}
                  </span>
                  {selectedPersona === persona.id && (
                    <motion.div
                      layoutId="persona-check"
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-2.5 h-2.5 text-black" />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-[11px] font-mono text-zinc-600">
                {enabledCount} feature{enabledCount !== 1 ? "s" : ""} selected
              </div>
              {complexCount > 0 && (
                <div className="text-[10px] font-mono text-zinc-700">
                  {complexCount} complex feature{complexCount !== 1 ? "s" : ""} (+{complexCount * COMPLEX_FEATURE_COST} cr)
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <Coins className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400">{estimatedCredits}</span>
              <span className="text-zinc-600">credits estimated</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={buildEnrichedPrompt}
              disabled={enabledCount === 0}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-mono text-sm font-medium transition-all duration-300",
                enabledCount === 0
                  ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                  : "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              BUILD THIS <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {enabledCount > 0 && result && (
        <GhostPreview
          appName={result.appName}
          tagline={result.tagline}
          features={ghostFeatures}
        />
      )}
    </motion.div>
  );
}
