import { useState, useMemo } from "react";
import { createTwoFilesPatch } from "diff";
import { X, Copy, Check, ChevronDown, ChevronRight, GitCompare, FileCode2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiffFile {
  path: string;
  oldContent: string;
  newContent: string;
}

interface DiffViewerProps {
  files: DiffFile[];
  onClose: () => void;
}

interface ParsedHunk {
  header: string;
  lines: Array<{
    type: "add" | "remove" | "context";
    content: string;
    oldLine?: number;
    newLine?: number;
  }>;
}

function parsePatch(oldContent: string, newContent: string, path: string): ParsedHunk[] {
  const patch = createTwoFilesPatch(`a/${path}`, `b/${path}`, oldContent, newContent, "", "", { context: 3 });
  const lines = patch.split("\n");

  const hunks: ParsedHunk[] = [];
  let current: ParsedHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
        current = { header: line, lines: [] };
        hunks.push(current);
      }
      continue;
    }

    if (!current) continue;

    if (line.startsWith("+")) {
      current.lines.push({ type: "add", content: line.slice(1), newLine: newLine++ });
    } else if (line.startsWith("-")) {
      current.lines.push({ type: "remove", content: line.slice(1), oldLine: oldLine++ });
    } else if (line.startsWith(" ")) {
      current.lines.push({ type: "context", content: line.slice(1), oldLine: oldLine++, newLine: newLine++ });
    } else if (line === "\\ No newline at end of file") {
      continue;
    }
  }

  return hunks;
}

function FileDiff({ file }: { file: DiffFile }) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const isNewFile = !file.oldContent;

  const hunks = useMemo(() => parsePatch(file.oldContent, file.newContent, file.path), [file]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const h of hunks) {
      for (const l of h.lines) {
        if (l.type === "add") added++;
        if (l.type === "remove") removed++;
      }
    }
    return { added, removed };
  }, [hunks]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(file.newContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-900/80 hover:bg-zinc-800/80 transition-colors text-left"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        )}
        <FileCode2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span className="text-xs font-mono text-zinc-300 truncate">{file.path}</span>
        {isNewFile && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">NEW</span>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {stats.added > 0 && (
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
              <Plus className="w-2.5 h-2.5" />
              {stats.added}
            </span>
          )}
          {stats.removed > 0 && (
            <span className="text-[10px] font-mono text-red-400 flex items-center gap-0.5">
              <Minus className="w-2.5 h-2.5" />
              {stats.removed}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="p-1 rounded hover:bg-zinc-700 transition-colors"
            title="Copy new content"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-zinc-500" />
            )}
          </button>
        </div>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto text-xs font-mono">
          {hunks.map((hunk, hi) => (
            <div key={hi}>
              <div className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] border-y border-border/30">
                {hunk.header}
              </div>
              {hunk.lines.map((line, li) => (
                <div
                  key={li}
                  className={cn(
                    "flex",
                    line.type === "add" && "bg-emerald-500/10",
                    line.type === "remove" && "bg-red-500/10",
                  )}
                >
                  <span className="w-10 shrink-0 text-right pr-2 text-zinc-600 select-none border-r border-border/30 py-0.5">
                    {line.oldLine ?? ""}
                  </span>
                  <span className="w-10 shrink-0 text-right pr-2 text-zinc-600 select-none border-r border-border/30 py-0.5">
                    {line.newLine ?? ""}
                  </span>
                  <span
                    className={cn(
                      "w-5 shrink-0 text-center select-none py-0.5",
                      line.type === "add" && "text-emerald-400",
                      line.type === "remove" && "text-red-400",
                      line.type === "context" && "text-zinc-600",
                    )}
                  >
                    {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                  </span>
                  <span className="flex-1 py-0.5 pr-4 whitespace-pre">
                    {line.content}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DiffViewer({ files, onClose }: DiffViewerProps) {
  const totalStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const f of files) {
      const hunks = parsePatch(f.oldContent, f.newContent, f.path);
      for (const h of hunks) {
        for (const l of h.lines) {
          if (l.type === "add") added++;
          if (l.type === "remove") removed++;
        }
      }
    }
    return { added, removed, files: files.length };
  }, [files]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-primary" />
          <span className="text-sm font-mono text-zinc-200">Changes</span>
          <span className="text-[10px] font-mono text-zinc-500">
            {totalStats.files} file{totalStats.files !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] font-mono text-emerald-400">+{totalStats.added}</span>
          <span className="text-[10px] font-mono text-red-400">-{totalStats.removed}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {files.map((file) => (
          <FileDiff key={file.path} file={file} />
        ))}
      </div>
    </div>
  );
}

export type { DiffFile };
