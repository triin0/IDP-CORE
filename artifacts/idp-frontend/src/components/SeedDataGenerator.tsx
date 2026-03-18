import { useState } from "react";
import type { ProjectDetails } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles, Database, Loader2, Copy, Check,
  FileCode2, Table2, ChevronDown,
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
  const [result, setResult] = useState<SeedResponse | null>(null);

  const spec = project.spec as { databaseTables?: Array<{ name: string; columns: string[] }> } | null;
  const hasTables = (spec?.databaseTables ?? []).length > 0;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}/seed-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowsPerTable, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate seed data");
      }
      return res.json() as Promise<SeedResponse>;
    },
    onSuccess: (data) => {
      setResult(data);
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
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-200">Magic Seed Data</h3>
        </div>
        <p className="text-[11px] text-zinc-500">
          Generate realistic test data for your database tables
        </p>
      </div>

      <div className="flex items-center gap-3">
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
            Generate Seed Data
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
