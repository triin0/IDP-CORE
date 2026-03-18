import { useState } from "react";
import type { ProjectDetails } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Database, Loader2, Copy, Check,
  FileCode2, Table2, ChevronDown, Trash2, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-base";

interface SeedRecord {
  [key: string]: string | number | boolean | null;
}

interface SeedTable {
  tableName: string;
  columns: string[];
  rows: SeedRecord[];
}

interface SeedResponse {
  tables: SeedTable[];
  sql?: string;
  typescript?: string;
  injected?: boolean;
  filesAdded?: string[];
}

interface SeedDataGeneratorProps {
  project: ProjectDetails;
}

type OutputFormat = "json" | "sql" | "typescript";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SeedTableView({ table }: { table: SeedTable }) {
  const [expanded, setExpanded] = useState(true);
  const colNames = table.columns.length > 0
    ? table.columns
    : table.rows.length > 0
      ? Object.keys(table.rows[0])
      : [];

  return (
    <div className="rounded-lg border border-zinc-800/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
      >
        <Table2 className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-mono text-emerald-400 font-semibold">{table.tableName}</span>
        <span className="text-[10px] font-mono text-zinc-600">{table.rows.length} rows</span>
        <ChevronDown className={cn("w-3 h-3 text-zinc-600 ml-auto transition-transform", expanded && "rotate-180")} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    {colNames.map((col) => (
                      <th key={col} className="text-left px-2 py-1.5 text-zinc-500 font-medium whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-colors">
                      {colNames.map((col) => (
                        <td key={col} className="px-2 py-1 text-zinc-400 whitespace-nowrap max-w-[200px] truncate">
                          {row[col] === null ? (
                            <span className="text-zinc-700 italic">null</span>
                          ) : (
                            String(row[col])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SeedDataGenerator({ project }: SeedDataGeneratorProps) {
  const [format, setFormat] = useState<OutputFormat>("json");
  const [rowsPerTable, setRowsPerTable] = useState(5);
  const [inject, setInject] = useState(true);
  const [result, setResult] = useState<SeedResponse | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const queryClient = useQueryClient();

  const spec = project.spec as { databaseTables?: Array<{ name: string; columns: string[] }> } | null;
  const hasTables = (spec?.databaseTables ?? []).length > 0;

  const hasSeedFiles = (project.files as Array<{ path: string }> | null)?.some(
    (f) => f.path === "client/src/data/seed-data.ts" || f.path === "server/src/db/seed.ts",
  ) ?? false;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}/seed-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowsPerTable, format: inject ? "json" : format, inject }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate seed data");
      }
      return res.json() as Promise<SeedResponse>;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.injected) {
        queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      }
    },
  });

  const wipeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}/wipe-seed-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to wipe seed data");
      }
      return res.json();
    },
    onSuccess: () => {
      setResult(null);
      setShowWipeConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
    },
  });

  if (!hasTables) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-200">Seed Data</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Database className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs font-mono text-zinc-600">No database tables</p>
            <p className="text-[10px] text-zinc-700 mt-1">This project doesn't have database tables to seed</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-zinc-200">Magic Seed Data</h3>
          </div>
          {hasSeedFiles && (
            <button
              type="button"
              onClick={() => setShowWipeConfirm(true)}
              disabled={wipeMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            >
              {wipeMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Wipe
            </button>
          )}
        </div>
        <p className="text-[11px] text-zinc-500">
          Schema-aware, deterministic seed data with FK-safe topological ordering
        </p>
      </div>

      <AnimatePresence>
        {showWipeConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 space-y-2">
              <p className="text-xs text-red-400 font-medium">Wipe all seed data?</p>
              <p className="text-[10px] text-zinc-500">
                This will overwrite seed files with empty arrays. Module imports will be preserved so Sandpack won't crash.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => wipeMutation.mutate()}
                  disabled={wipeMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
                >
                  {wipeMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Yes, wipe data
                </button>
                <button
                  type="button"
                  onClick={() => setShowWipeConfirm(false)}
                  className="px-3 py-1.5 rounded text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {wipeMutation.isError && (
        <div className="p-2 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
          {(wipeMutation.error as Error)?.message || "Failed to wipe seed data"}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Rows</label>
          <select
            value={rowsPerTable}
            onChange={(e) => setRowsPerTable(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:outline-none focus:border-primary/50"
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        {!inject && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Format</label>
            <div className="flex gap-0.5 bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
              {(["json", "sql", "typescript"] as OutputFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-mono transition-colors",
                    format === f ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {f === "typescript" ? "TS" : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setInject(!inject)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border transition-all",
            inject
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300",
          )}
        >
          <Zap className="w-3 h-3" />
          Auto-inject
        </button>
      </div>

      <button
        type="button"
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
          generateMutation.isPending
            ? "bg-zinc-800 text-zinc-500 cursor-wait"
            : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20",
        )}
      >
        {generateMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating seed data...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {inject ? "Generate & Inject Seed Data" : "Generate Seed Data"}
          </>
        )}
      </button>

      {generateMutation.isError && (
        <div className="p-2 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
          {(generateMutation.error as Error)?.message || "Failed to generate seed data"}
        </div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">
              {result.tables.length} table{result.tables.length !== 1 ? "s" : ""} seeded
            </span>
            {result.injected && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                <Check className="w-3 h-3" />
                Injected into project
              </span>
            )}
          </div>

          <div className="space-y-2">
            {result.tables.map((table) => (
              <SeedTableView key={table.tableName} table={table} />
            ))}
          </div>

          {(result.sql || result.typescript) && (
            <div className="rounded-lg border border-zinc-800/50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/50">
                <div className="flex items-center gap-1.5">
                  <FileCode2 className="w-3 h-3 text-zinc-500" />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    {result.sql ? "SQL" : "TypeScript"}
                  </span>
                </div>
                <CopyButton text={result.sql || result.typescript || ""} />
              </div>
              <pre className="p-3 text-[10px] font-mono text-zinc-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {result.sql || result.typescript}
              </pre>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
