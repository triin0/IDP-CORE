import { useState } from "react";
import { useApproveSpec, useRegenerateSpec, useUpdateSpec } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  FileCode,
  Globe,
  Database,
  Shield,
  Lightbulb,
  CheckCircle2,
  Loader2,
  Rocket,
  AlertTriangle,
  RefreshCw,
  Pencil,
  X,
  Save,
} from "lucide-react";

interface ProjectSpec {
  overview: string;
  fileStructure: string[];
  apiEndpoints: Array<{ method: string; path: string; description: string }>;
  databaseTables: Array<{ name: string; columns: string[] }>;
  middleware: string[];
  architecturalDecisions: string[];
}

interface SpecReviewProps {
  projectId: string;
  prompt: string;
  spec: ProjectSpec;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-400 bg-emerald-400/10",
  POST: "text-blue-400 bg-blue-400/10",
  PUT: "text-yellow-400 bg-yellow-400/10",
  PATCH: "text-orange-400 bg-orange-400/10",
  DELETE: "text-red-400 bg-red-400/10",
};

function EditableOverview({
  value,
  onSave,
  isSaving,
}: {
  value: string;
  onSave: (v: string) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div className="group relative">
        <p className="text-sm text-zinc-300 leading-relaxed">{value}</p>
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-zinc-800 hover:bg-zinc-700"
        >
          <Pencil className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 font-mono resize-y min-h-[80px] focus:outline-none focus:border-primary/50"
        rows={4}
      />
      <div className="flex gap-2 mt-2 justify-end">
        <button
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 rounded text-xs font-mono text-zinc-400 bg-zinc-800 hover:bg-zinc-700"
        >
          <X className="w-3 h-3 inline mr-1" />CANCEL
        </button>
        <button
          onClick={() => { onSave(draft); setEditing(false); }}
          disabled={isSaving}
          className="px-3 py-1.5 rounded text-xs font-mono text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30"
        >
          {isSaving ? <Loader2 className="w-3 h-3 inline mr-1 animate-spin" /> : <Save className="w-3 h-3 inline mr-1" />}
          SAVE
        </button>
      </div>
    </div>
  );
}

function EditableList({
  items,
  onSave,
  isSaving,
}: {
  items: string[];
  onSave: (items: string[]) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items.join("\n"));

  if (!editing) {
    return (
      <div className="group relative">
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {items.map((item, i) => (
            <div key={i} className="text-xs font-mono text-zinc-400 py-1 px-2 rounded hover:bg-zinc-800/50">
              {item}
            </div>
          ))}
        </div>
        <button
          onClick={() => { setDraft(items.join("\n")); setEditing(true); }}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-zinc-800 hover:bg-zinc-700"
        >
          <Pencil className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 font-mono resize-y min-h-[120px] focus:outline-none focus:border-primary/50"
        rows={8}
      />
      <p className="text-[10px] font-mono text-zinc-600 mt-1">One item per line</p>
      <div className="flex gap-2 mt-2 justify-end">
        <button
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 rounded text-xs font-mono text-zinc-400 bg-zinc-800 hover:bg-zinc-700"
        >
          <X className="w-3 h-3 inline mr-1" />CANCEL
        </button>
        <button
          onClick={() => { onSave(draft.split("\n").filter(Boolean)); setEditing(false); }}
          disabled={isSaving}
          className="px-3 py-1.5 rounded text-xs font-mono text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30"
        >
          {isSaving ? <Loader2 className="w-3 h-3 inline mr-1 animate-spin" /> : <Save className="w-3 h-3 inline mr-1" />}
          SAVE
        </button>
      </div>
    </div>
  );
}

export function SpecReview({ projectId, prompt, spec }: SpecReviewProps) {
  const queryClient = useQueryClient();
  const approveMut = useApproveSpec();
  const regenerateMut = useRegenerateSpec();
  const updateMut = useUpdateSpec();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
  };

  const handleApprove = () => {
    approveMut.mutate({ id: projectId }, { onSuccess: invalidate });
  };

  const handleRegenerate = () => {
    regenerateMut.mutate({ id: projectId }, { onSuccess: invalidate });
  };

  const handleUpdateField = (field: string, value: unknown) => {
    updateMut.mutate(
      { id: projectId, data: { [field]: value } },
      { onSuccess: invalidate },
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 max-w-5xl mx-auto w-full px-6 py-8"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 font-mono flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            SPEC_REVIEW
          </h1>
          <p className="text-xs font-mono text-zinc-500 mt-1 truncate max-w-xl">
            {prompt}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(approveMut.isError || regenerateMut.isError) && (
            <span className="text-xs font-mono text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              ACTION_FAILED
            </span>
          )}
          <button
            onClick={handleRegenerate}
            disabled={regenerateMut.isPending}
            className={cn(
              "flex items-center px-4 py-2.5 rounded-lg font-mono text-xs font-medium transition-all duration-300 border",
              regenerateMut.isPending
                ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed"
                : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:text-zinc-100"
            )}
          >
            {regenerateMut.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> REGENERATING...</>
            ) : (
              <><RefreshCw className="w-3.5 h-3.5 mr-2" /> REGENERATE</>
            )}
          </button>
          <button
            onClick={handleApprove}
            disabled={approveMut.isPending}
            className={cn(
              "flex items-center px-5 py-2.5 rounded-lg font-mono text-sm font-medium transition-all duration-300",
              approveMut.isPending
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
            )}
          >
            {approveMut.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> APPROVING...</>
            ) : (
              <><Rocket className="w-4 h-4 mr-2" /> APPROVE & GENERATE</>
            )}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h3 className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider mb-3">Overview</h3>
        <EditableOverview
          value={spec.overview}
          onSave={(v) => handleUpdateField("overview", v)}
          isSaving={updateMut.isPending}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5" />
            File Structure ({spec.fileStructure.length} files)
          </h3>
          <EditableList
            items={spec.fileStructure}
            onSave={(items) => handleUpdateField("fileStructure", items)}
            isSaving={updateMut.isPending}
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5" />
            API Endpoints ({spec.apiEndpoints.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {spec.apiEndpoints.map((ep, i) => (
              <div key={i} className="flex items-start gap-2 py-1">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0",
                  METHOD_COLORS[ep.method.toUpperCase()] || "text-zinc-400 bg-zinc-800"
                )}>
                  {ep.method.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-mono text-zinc-300">{ep.path}</span>
                  <p className="text-[10px] font-mono text-zinc-600 truncate">{ep.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Database className="w-3.5 h-3.5" />
            Database Tables ({spec.databaseTables.length})
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {spec.databaseTables.map((table, i) => (
              <div key={i}>
                <div className="text-xs font-mono font-semibold text-zinc-300 mb-1">{table.name}</div>
                <div className="space-y-0.5 pl-3 border-l border-zinc-800">
                  {table.columns.map((col, j) => (
                    <div key={j} className="text-[10px] font-mono text-zinc-500">{col}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Middleware
            </h3>
            <EditableList
              items={spec.middleware}
              onSave={(items) => handleUpdateField("middleware", items)}
              isSaving={updateMut.isPending}
            />
          </div>

          <div>
            <h3 className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Architectural Decisions
            </h3>
            <EditableList
              items={spec.architecturalDecisions}
              onSave={(items) => handleUpdateField("architecturalDecisions", items)}
              isSaving={updateMut.isPending}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
