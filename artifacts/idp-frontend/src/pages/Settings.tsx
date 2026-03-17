import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import YAML from "yaml";
import {
  useListGoldenPathConfigs,
  useGetActiveGoldenPathConfig,
  useCreateGoldenPathConfig,
  useUpdateGoldenPathConfig,
  useActivateGoldenPathConfig,
  useDeleteGoldenPathConfig,
  useResetGoldenPathToDefault,
} from "@workspace/api-client-react";
import {
  Settings2,
  Shield,
  Code2,
  Database,
  FolderTree,
  AlertTriangle,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronRight,
  Zap,
  Upload,
} from "lucide-react";

interface GoldenPathRule {
  name: string;
  description: string;
  promptInstruction: string;
  check: {
    type: "file_pattern" | "content_match" | "content_not_match";
    pattern: string;
  };
}

interface ConfigRules {
  techStack: {
    backend: string;
    frontend: string;
    language: string;
    orm: string;
    validation: string;
  };
  folderStructure: {
    backend: string[];
    frontend: string[];
    shared: string[];
    root: string[];
  };
  security: {
    requireHelmet: boolean;
    requireCors: boolean;
    requireRateLimiting: boolean;
    noHardcodedSecrets: boolean;
  };
  codeQuality: {
    strictTypeScript: boolean;
    noAnyTypes: boolean;
    explicitReturnTypes: boolean;
    esmImports: boolean;
  };
  database: {
    requireSchema: boolean;
    requireConnectionPooling: boolean;
    requireParameterizedQueries: boolean;
  };
  errorHandling: {
    requireGlobalHandler: boolean;
    structuredResponses: boolean;
    noStackTraceLeaks: boolean;
  };
  checks: GoldenPathRule[];
}

function SectionHeader({
  icon: Icon,
  title,
  expanded,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg hover:bg-zinc-800 transition-colors"
    >
      <Icon className="w-4 h-4 text-primary" />
      <span className="font-mono text-sm text-zinc-200 flex-1 text-left">{title}</span>
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-zinc-500" />
      ) : (
        <ChevronRight className="w-4 h-4 text-zinc-500" />
      )}
    </button>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2 px-3 rounded hover:bg-zinc-800/30 cursor-pointer">
      <span className="text-sm text-zinc-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          value ? "bg-primary" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <label className="text-xs text-zinc-500 font-mono">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-900 border border-zinc-700/50 rounded px-3 py-1.5 text-sm text-zinc-200 font-mono focus:border-primary/50 focus:outline-none"
      />
    </div>
  );
}

function ArrayEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <label className="text-xs text-zinc-500 font-mono">{label}</label>
      <div className="space-y-1">
        {values.map((v, i) => (
          <div key={i} className="flex gap-1">
            <input
              type="text"
              value={v}
              onChange={(e) => {
                const newVals = [...values];
                newVals[i] = e.target.value;
                onChange(newVals);
              }}
              className="flex-1 bg-zinc-900 border border-zinc-700/50 rounded px-3 py-1 text-sm text-zinc-200 font-mono focus:border-primary/50 focus:outline-none"
            />
            <button
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="px-2 text-zinc-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...values, ""])}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-primary transition-colors px-1 py-0.5"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>
    </div>
  );
}

function CheckRuleEditor({
  rule,
  onChange,
  onDelete,
}: {
  rule: GoldenPathRule;
  onChange: (r: GoldenPathRule) => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-zinc-700/30 rounded-lg p-3 space-y-2 bg-zinc-900/30">
      <div className="flex items-start justify-between">
        <input
          type="text"
          value={rule.name}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
          className="bg-transparent border-b border-zinc-700/50 text-sm text-zinc-200 font-mono pb-0.5 focus:border-primary/50 focus:outline-none"
          placeholder="Rule name"
        />
        <button onClick={onDelete} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <input
        type="text"
        value={rule.description}
        onChange={(e) => onChange({ ...rule, description: e.target.value })}
        className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-400 focus:border-primary/50 focus:outline-none"
        placeholder="Description"
      />
      <input
        type="text"
        value={rule.promptInstruction}
        onChange={(e) => onChange({ ...rule, promptInstruction: e.target.value })}
        className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-400 focus:border-primary/50 focus:outline-none"
        placeholder="Prompt instruction for AI"
      />
      <div className="flex gap-2">
        <select
          value={rule.check.type}
          onChange={(e) =>
            onChange({
              ...rule,
              check: { ...rule.check, type: e.target.value as GoldenPathRule["check"]["type"] },
            })
          }
          className="bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="file_pattern">File Pattern</option>
          <option value="content_match">Content Match</option>
          <option value="content_not_match">Content Not Match</option>
        </select>
        <input
          type="text"
          value={rule.check.pattern}
          onChange={(e) => onChange({ ...rule, check: { ...rule.check, pattern: e.target.value } })}
          className="flex-1 bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 font-mono focus:border-primary/50 focus:outline-none"
          placeholder="Pattern (comma-separated)"
        />
      </div>
    </div>
  );
}

export function Settings() {
  const { data: configsData, refetch: refetchConfigs } = useListGoldenPathConfigs({
    query: { queryKey: ["golden-path-configs"] },
  });
  const { data: activeData, refetch: refetchActive } = useGetActiveGoldenPathConfig({
    query: { queryKey: ["golden-path-config-active"] },
  });
  const createMutation = useCreateGoldenPathConfig();
  const updateMutation = useUpdateGoldenPathConfig();
  const activateMutation = useActivateGoldenPathConfig();
  const deleteMutation = useDeleteGoldenPathConfig();
  const resetMutation = useResetGoldenPathToDefault();

  const [editingRules, setEditingRules] = useState<ConfigRules | null>(null);
  const [configName, setConfigName] = useState("");
  const [configDescription, setConfigDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    techStack: true,
    folderStructure: false,
    security: true,
    codeQuality: false,
    database: false,
    errorHandling: false,
    checks: false,
  });
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeData) {
      setEditingRules(activeData.rules as ConfigRules);
      setConfigName(activeData.name ?? "Default");
      setConfigDescription((activeData as { description?: string }).description ?? "");
      setEditingId((activeData as { id?: string }).id ?? null);
    }
  }, [activeData]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLoadDefault = () => {
    if (configsData?.defaultRules) {
      setEditingRules(configsData.defaultRules as ConfigRules);
      setConfigName("Custom Config");
      setConfigDescription("");
      setEditingId(null);
    }
  };

  const handleSave = async () => {
    if (!editingRules || !configName) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          data: { name: configName, description: configDescription, rules: editingRules, isActive: true },
        });
      } else {
        await createMutation.mutateAsync({
          data: { name: configName, description: configDescription, rules: editingRules, isActive: true },
        });
      }
      await refetchConfigs();
      await refetchActive();
      toast({ title: "Config saved & activated", description: `"${configName}" is now the active Golden Path configuration.` });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync();
      setEditingRules(configsData?.defaultRules as ConfigRules ?? null);
      setConfigName("Default");
      setConfigDescription("Built-in Golden Path configuration");
      setEditingId(null);
      await refetchConfigs();
      await refetchActive();
      toast({ title: "Reset to default", description: "Built-in Golden Path configuration restored." });
    } catch (e) {
      toast({ title: "Reset failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateMutation.mutateAsync({ id });
      await refetchConfigs();
      await refetchActive();
      toast({ title: "Config activated" });
    } catch (e) {
      toast({ title: "Activation failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      await refetchConfigs();
      await refetchActive();
      toast({ title: "Config deleted" });
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleJsonToggle = () => {
    if (!showJsonEditor && editingRules) {
      setJsonText(JSON.stringify(editingRules, null, 2));
      setJsonError(null);
    }
    setShowJsonEditor(!showJsonEditor);
  };

  const handleJsonApply = () => {
    try {
      let parsed: ConfigRules;
      try {
        parsed = JSON.parse(jsonText) as ConfigRules;
      } catch {
        parsed = YAML.parse(jsonText) as ConfigRules;
      }
      if (!parsed || !parsed.techStack || !parsed.checks) {
        setJsonError("Missing required fields (techStack, checks)");
        return;
      }
      setEditingRules(parsed);
      setJsonError(null);
      setShowJsonEditor(false);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON/YAML");
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      try {
        let parsed: ConfigRules;
        if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
          parsed = YAML.parse(text) as ConfigRules;
        } else {
          parsed = JSON.parse(text) as ConfigRules;
        }
        if (!parsed.techStack || !parsed.checks) {
          toast({ title: "Import failed", description: "File missing required fields (techStack, checks)", variant: "destructive" });
          return;
        }
        setEditingRules(parsed);
        setConfigName(file.name.replace(/\.(json|ya?ml)$/i, ""));
        setEditingId(null);
        toast({ title: "Config imported", description: `Loaded from ${file.name}` });
      } catch (err) {
        toast({ title: "Import failed", description: err instanceof Error ? err.message : "Invalid file format", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateRules = (path: string, value: unknown) => {
    if (!editingRules) return;
    const keys = path.split(".");
    const updated = { ...editingRules };
    let current: Record<string, unknown> = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
    setEditingRules(updated as ConfigRules);
  };

  if (!editingRules) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-zinc-500 font-mono text-sm">Loading configuration...</div>
      </div>
    );
  }

  const configs = configsData?.configs ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-2xl font-bold text-zinc-100 flex items-center gap-3">
              <Settings2 className="w-6 h-6 text-primary" />
              GOLDEN_PATH_CONFIG
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Define enterprise standards for all generated projects
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleFileImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-400 border border-zinc-700/50 rounded hover:bg-zinc-800 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              IMPORT
            </button>
            <button
              onClick={handleJsonToggle}
              className="px-3 py-1.5 text-xs font-mono text-zinc-400 border border-zinc-700/50 rounded hover:bg-zinc-800 transition-colors"
            >
              {showJsonEditor ? "VISUAL" : "JSON/YAML"}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-400 border border-zinc-700/50 rounded hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              RESET
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono bg-primary text-black rounded hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "SAVING..." : "SAVE & ACTIVATE"}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 font-mono block mb-1">CONFIG NAME</label>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-3 py-2 text-sm text-zinc-200 font-mono focus:border-primary/50 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 font-mono block mb-1">DESCRIPTION</label>
            <input
              type="text"
              value={configDescription}
              onChange={(e) => setConfigDescription(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700/50 rounded px-3 py-2 text-sm text-zinc-200 font-mono focus:border-primary/50 focus:outline-none"
              placeholder="Optional description"
            />
          </div>
        </div>

        {showJsonEditor ? (
          <div className="space-y-3">
            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setJsonError(null);
              }}
              className="w-full h-[500px] bg-zinc-900 border border-zinc-700/50 rounded-lg px-4 py-3 text-sm text-zinc-200 font-mono focus:border-primary/50 focus:outline-none resize-none"
              spellCheck={false}
            />
            {jsonError && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4" />
                {jsonError}
              </div>
            )}
            <button
              onClick={handleJsonApply}
              className="px-4 py-2 text-xs font-mono bg-primary text-black rounded hover:bg-primary/80 transition-colors"
            >
              APPLY JSON
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <SectionHeader icon={Code2} title="TECH_STACK" expanded={expandedSections.techStack} onToggle={() => toggleSection("techStack")} />
            <AnimatePresence>
              {expandedSections.techStack && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pl-4 space-y-1 pb-3">
                    <TextInput label="Backend Framework" value={editingRules.techStack.backend} onChange={(v) => updateRules("techStack.backend", v)} />
                    <TextInput label="Frontend Framework" value={editingRules.techStack.frontend} onChange={(v) => updateRules("techStack.frontend", v)} />
                    <TextInput label="Language" value={editingRules.techStack.language} onChange={(v) => updateRules("techStack.language", v)} />
                    <TextInput label="ORM" value={editingRules.techStack.orm} onChange={(v) => updateRules("techStack.orm", v)} />
                    <TextInput label="Validation Library" value={editingRules.techStack.validation} onChange={(v) => updateRules("techStack.validation", v)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <SectionHeader icon={FolderTree} title="FOLDER_STRUCTURE" expanded={expandedSections.folderStructure} onToggle={() => toggleSection("folderStructure")} />
            <AnimatePresence>
              {expandedSections.folderStructure && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pl-4 space-y-1 pb-3">
                    <ArrayEditor label="Backend Directories" values={editingRules.folderStructure.backend} onChange={(v) => updateRules("folderStructure.backend", v)} />
                    <ArrayEditor label="Frontend Directories" values={editingRules.folderStructure.frontend} onChange={(v) => updateRules("folderStructure.frontend", v)} />
                    <ArrayEditor label="Shared Directories" values={editingRules.folderStructure.shared} onChange={(v) => updateRules("folderStructure.shared", v)} />
                    <ArrayEditor label="Root Files" values={editingRules.folderStructure.root} onChange={(v) => updateRules("folderStructure.root", v)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <SectionHeader icon={Shield} title="SECURITY" expanded={expandedSections.security} onToggle={() => toggleSection("security")} />
            <AnimatePresence>
              {expandedSections.security && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pl-4 space-y-0 pb-3">
                    <ToggleField label="Require Helmet Security Headers" value={editingRules.security.requireHelmet} onChange={(v) => updateRules("security.requireHelmet", v)} />
                    <ToggleField label="Require CORS Configuration" value={editingRules.security.requireCors} onChange={(v) => updateRules("security.requireCors", v)} />
                    <ToggleField label="Require Rate Limiting" value={editingRules.security.requireRateLimiting} onChange={(v) => updateRules("security.requireRateLimiting", v)} />
                    <ToggleField label="No Hardcoded Secrets" value={editingRules.security.noHardcodedSecrets} onChange={(v) => updateRules("security.noHardcodedSecrets", v)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <SectionHeader icon={Code2} title="CODE_QUALITY" expanded={expandedSections.codeQuality} onToggle={() => toggleSection("codeQuality")} />
            <AnimatePresence>
              {expandedSections.codeQuality && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pl-4 space-y-0 pb-3">
                    <ToggleField label="Strict TypeScript" value={editingRules.codeQuality.strictTypeScript} onChange={(v) => updateRules("codeQuality.strictTypeScript", v)} />
                    <ToggleField label="No any Types" value={editingRules.codeQuality.noAnyTypes} onChange={(v) => updateRules("codeQuality.noAnyTypes", v)} />
                    <ToggleField label="Explicit Return Types" value={editingRules.codeQuality.explicitReturnTypes} onChange={(v) => updateRules("codeQuality.explicitReturnTypes", v)} />
                    <ToggleField label="ESM Imports" value={editingRules.codeQuality.esmImports} onChange={(v) => updateRules("codeQuality.esmImports", v)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <SectionHeader icon={Database} title="DATABASE" expanded={expandedSections.database} onToggle={() => toggleSection("database")} />
            <AnimatePresence>
              {expandedSections.database && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pl-4 space-y-0 pb-3">
                    <ToggleField label="Require Schema Directory" value={editingRules.database.requireSchema} onChange={(v) => updateRules("database.requireSchema", v)} />
                    <ToggleField label="Require Connection Pooling" value={editingRules.database.requireConnectionPooling} onChange={(v) => updateRules("database.requireConnectionPooling", v)} />
                    <ToggleField label="Require Parameterized Queries" value={editingRules.database.requireParameterizedQueries} onChange={(v) => updateRules("database.requireParameterizedQueries", v)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <SectionHeader icon={AlertTriangle} title="ERROR_HANDLING" expanded={expandedSections.errorHandling} onToggle={() => toggleSection("errorHandling")} />
            <AnimatePresence>
              {expandedSections.errorHandling && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pl-4 space-y-0 pb-3">
                    <ToggleField label="Global Error Handler" value={editingRules.errorHandling.requireGlobalHandler} onChange={(v) => updateRules("errorHandling.requireGlobalHandler", v)} />
                    <ToggleField label="Structured Responses" value={editingRules.errorHandling.structuredResponses} onChange={(v) => updateRules("errorHandling.structuredResponses", v)} />
                    <ToggleField label="No Stack Trace Leaks" value={editingRules.errorHandling.noStackTraceLeaks} onChange={(v) => updateRules("errorHandling.noStackTraceLeaks", v)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <SectionHeader icon={Check} title={`COMPLIANCE_CHECKS (${editingRules.checks.length})`} expanded={expandedSections.checks} onToggle={() => toggleSection("checks")} />
            <AnimatePresence>
              {expandedSections.checks && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pl-4 space-y-3 pb-3">
                    {editingRules.checks.map((rule, i) => (
                      <CheckRuleEditor
                        key={i}
                        rule={rule}
                        onChange={(r) => {
                          const newChecks = [...editingRules.checks];
                          newChecks[i] = r;
                          updateRules("checks", newChecks);
                        }}
                        onDelete={() => {
                          updateRules(
                            "checks",
                            editingRules.checks.filter((_, idx) => idx !== i),
                          );
                        }}
                      />
                    ))}
                    <button
                      onClick={() =>
                        updateRules("checks", [
                          ...editingRules.checks,
                          {
                            name: "New Check",
                            description: "",
                            promptInstruction: "",
                            check: { type: "content_match" as const, pattern: "" },
                          },
                        ])
                      }
                      className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-zinc-400 border border-dashed border-zinc-700/50 rounded-lg hover:bg-zinc-800/50 hover:text-primary transition-colors w-full justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      ADD CHECK RULE
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {configs.length > 0 && (
          <div className="border-t border-zinc-800 pt-6">
            <h2 className="font-mono text-sm text-zinc-400 mb-3">SAVED_CONFIGS</h2>
            <div className="space-y-2">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between px-4 py-3 bg-zinc-800/30 border border-zinc-700/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {config.isActive && (
                      <Zap className="w-4 h-4 text-primary" />
                    )}
                    <div>
                      <div className="text-sm text-zinc-200 font-mono">{config.name}</div>
                      {(config as { description?: string }).description && (
                        <div className="text-xs text-zinc-500">{(config as { description?: string }).description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!config.isActive && config.id && (
                      <button
                        onClick={() => handleActivate(config.id!)}
                        className="px-2 py-1 text-xs font-mono text-zinc-400 hover:text-primary transition-colors"
                      >
                        ACTIVATE
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingRules(config.rules as ConfigRules);
                        setConfigName(config.name);
                        setConfigDescription((config as { description?: string }).description ?? "");
                        setEditingId(config.id ?? null);
                      }}
                      className="px-2 py-1 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      EDIT
                    </button>
                    {!config.isDefault && config.id && (
                      <button
                        onClick={() => handleDelete(config.id!)}
                        className="px-2 py-1 text-xs font-mono text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleLoadDefault}
              className="mt-3 flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              CREATE NEW FROM DEFAULT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
