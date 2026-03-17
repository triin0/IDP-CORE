import { useParams } from "wouter";
import { useGetProject } from "@workspace/api-client-react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackFileExplorer,
  SandpackCodeEditor,
} from "@codesandbox/sandpack-react";
import { Loader2, Terminal, AlertCircle, Eye, Code2, Maximize2 } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const SKIP_FILES = new Set([
  "package.json", "vite.config.ts", "vite.config.js",
  "tsconfig.json", "tsconfig.node.json",
  "postcss.config.js", "tailwind.config.js", "tailwind.config.ts",
]);

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function prepareSandpackFiles(files: Array<{ path: string; content: string }>) {
  const sandpackFiles: Record<string, { code: string; active?: boolean }> = {};

  const clientFiles = files.filter((f) => f.path.startsWith("client/"));
  const hasClient = clientFiles.length > 0;
  const sourceFiles = hasClient ? clientFiles : files;
  const basePrefix = hasClient ? "client/" : "";

  for (const file of sourceFiles) {
    let filePath = file.path;
    if (basePrefix && filePath.startsWith(basePrefix)) {
      filePath = filePath.slice(basePrefix.length);
    }
    if (filePath.startsWith("src/")) {
      filePath = filePath.slice(4);
    }
    if (SKIP_FILES.has(filePath)) continue;
    if (filePath === "public/index.html" || filePath === "index.html") continue;

    sandpackFiles[`/${filePath}`] = { code: file.content };
  }

  const appEntry = sandpackFiles["/App.tsx"] || sandpackFiles["/App.jsx"];
  if (appEntry) {
    appEntry.active = true;
  }

  return { files: sandpackFiles };
}

function buildStaticPreview(files: Array<{ path: string; content: string }>, prompt: string): string {
  const clientFiles = files.filter((f) => f.path.startsWith("client/"));
  const hasClient = clientFiles.length > 0;
  const sourceFiles = hasClient ? clientFiles : files;
  const basePrefix = hasClient ? "client/" : "";

  const pkgFile = sourceFiles.find((f) => f.path === `${basePrefix}package.json`);
  let pkgDeps: string[] = [];
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      pkgDeps = Object.keys(pkg.dependencies || {});
    } catch {}
  }

  const serverFiles = files.filter((f) => f.path.startsWith("server/"));
  const schemaFiles = files.filter((f) => f.path.includes("schema/"));
  const componentFiles = sourceFiles.filter((f) =>
    f.path.includes("components/") && (f.path.endsWith(".tsx") || f.path.endsWith(".jsx"))
  );
  const pageFiles = sourceFiles.filter((f) =>
    f.path.includes("pages/") && (f.path.endsWith(".tsx") || f.path.endsWith(".jsx"))
  );
  const hookFiles = sourceFiles.filter((f) =>
    f.path.includes("hooks/") && (f.path.endsWith(".ts") || f.path.endsWith(".tsx"))
  );

  const componentNames = componentFiles.map((f) =>
    esc(f.path.split("/").pop()?.replace(/\.(tsx|jsx)$/, "") || "")
  );
  const pageNames = pageFiles.map((f) =>
    esc(f.path.split("/").pop()?.replace(/\.(tsx|jsx)$/, "") || "")
  );
  const hookNames = hookFiles.map((f) =>
    esc(f.path.split("/").pop()?.replace(/\.(ts|tsx)$/, "") || "")
  );
  const schemaNames = schemaFiles.map((f) => esc(f.path.split("/").pop() || ""));
  const safeDeps = pkgDeps.filter((d) => !d.startsWith("@types/")).map(esc);
  const safePrompt = esc(prompt.charAt(0).toUpperCase() + prompt.slice(1));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #0f0f17; color: #e4e4e7; min-height: 100vh; }
    .preview-banner { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-bottom: 1px solid #22d3ee33; padding: 12px 20px; display: flex; align-items: center; gap: 8px; }
    .preview-badge { background: #22d3ee15; color: #22d3ee; border: 1px solid #22d3ee33; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-family: monospace; font-weight: 600; }
    .app-container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
    .app-header { margin-bottom: 32px; }
    .app-title { font-size: 28px; font-weight: 700; color: #f4f4f5; margin-bottom: 4px; }
    .app-subtitle { font-size: 14px; color: #71717a; }
    .section { background: #18182433; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .section-title { font-size: 13px; font-weight: 600; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    .component-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
    .component-card { background: #1a1a2e; border: 1px solid #27272a; border-radius: 8px; padding: 12px 16px; font-size: 13px; font-family: 'JetBrains Mono', monospace; color: #22d3ee; display: flex; align-items: center; gap: 8px; }
    .component-card::before { content: '\\2B22'; font-size: 8px; color: #4ade80; }
    .tech-pills { display: flex; flex-wrap: wrap; gap: 8px; }
    .tech-pill { background: #27272a; border: 1px solid #3f3f46; border-radius: 20px; padding: 6px 14px; font-size: 12px; color: #a1a1aa; }
    .server-info { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #1a1a2e; border-radius: 8px; border: 1px solid #27272a; }
    .server-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  </style>
</head>
<body>
  <div class="preview-banner">
    <span class="preview-badge">PREVIEW</span>
    <span style="font-size: 12px; color: #71717a;">Generated application structure</span>
  </div>

  <div class="app-container">
    <div class="app-header">
      <div class="app-title">${safePrompt}</div>
      <div class="app-subtitle">Full-stack application &middot; ${files.length} files generated</div>
    </div>

    ${pageNames.length > 0 ? `
    <div class="section">
      <div class="section-title">Pages</div>
      <div class="component-grid">
        ${pageNames.map((n) => `<div class="component-card">${n}</div>`).join("")}
      </div>
    </div>` : ""}

    ${componentNames.length > 0 ? `
    <div class="section">
      <div class="section-title">Components</div>
      <div class="component-grid">
        ${componentNames.map((n) => `<div class="component-card">${n}</div>`).join("")}
      </div>
    </div>` : ""}

    ${hookNames.length > 0 ? `
    <div class="section">
      <div class="section-title">Custom Hooks</div>
      <div class="component-grid">
        ${hookNames.map((n) => `<div class="component-card">${n}</div>`).join("")}
      </div>
    </div>` : ""}

    ${serverFiles.length > 0 ? `
    <div class="section">
      <div class="section-title">Backend API</div>
      <div class="server-info">
        <div class="server-dot"></div>
        <span style="font-size: 13px; color: #d4d4d8;">Express.js server &middot; ${serverFiles.length} files</span>
      </div>
    </div>` : ""}

    ${schemaNames.length > 0 ? `
    <div class="section">
      <div class="section-title">Database Schema</div>
      <div class="component-grid">
        ${schemaNames.map((n) => `<div class="component-card">${n}</div>`).join("")}
      </div>
    </div>` : ""}

    ${safeDeps.length > 0 ? `
    <div class="section">
      <div class="section-title">Technology Stack</div>
      <div class="tech-pills">
        ${safeDeps.map((d) => `<div class="tech-pill">${d}</div>`).join("")}
      </div>
    </div>` : ""}
  </div>
</body>
</html>`;
}

const SANDPACK_THEME = {
  colors: {
    surface1: "#12121a",
    surface2: "#1a1a24",
    surface3: "#22222e",
    clickable: "#71717a",
    base: "#e4e4e7",
    disabled: "#3f3f46",
    hover: "#22d3ee",
    accent: "#22d3ee",
    error: "#f87171",
    errorSurface: "#2a1515",
  },
  syntax: {
    plain: "#e4e4e7",
    comment: { color: "#52525b", fontStyle: "italic" as const },
    keyword: "#c084fc",
    tag: "#22d3ee",
    punctuation: "#71717a",
    definition: "#4ade80",
    property: "#60a5fa",
    static: "#f59e0b",
    string: "#34d399",
  },
  font: {
    body: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
    mono: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
    size: "13px",
    lineHeight: "1.6",
  },
};

export function Preview() {
  const params = useParams<{ id: string }>();
  const [viewMode, setViewMode] = useState<"preview" | "code" | "split">("split");

  const projectId = params.id || "";
  const { data: project, isLoading, isError } = useGetProject(
    projectId,
    { query: { queryKey: [`/api/projects/${projectId}`], enabled: !!projectId } }
  );

  const files = useMemo(
    () => ((project?.files || []) as Array<{ path: string; content: string }>),
    [project?.files]
  );
  const checks = useMemo(
    () => ((project?.goldenPathChecks || []) as Array<{ name: string; passed: boolean }>),
    [project?.goldenPathChecks]
  );

  const sandpackFiles = useMemo(() => prepareSandpackFiles(files).files, [files]);
  const staticHtml = useMemo(
    () => buildStaticPreview(files, project?.prompt || "Generated Application"),
    [files, project?.prompt]
  );

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-mono text-zinc-500">Loading project...</p>
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm font-mono text-zinc-400">Project not found</p>
        </div>
      </div>
    );
  }

  const passedCount = checks.filter((c) => c.passed).length;

  if (files.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="w-8 h-8 text-zinc-500" />
          <p className="text-sm font-mono text-zinc-400">No files generated yet</p>
        </div>
      </div>
    );
  }

  const shortId = project.id.substring(0, 8).toUpperCase();

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-[#12121a] shrink-0">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-2 text-primary font-mono font-bold text-sm hover:opacity-80 transition-opacity"
          >
            <Terminal className="w-4 h-4" />
            <span>IDP.CORE</span>
          </a>
          <div className="h-4 w-px bg-zinc-700" />
          <div>
            <div className="text-xs font-medium text-zinc-300 truncate max-w-md">
              {project.prompt}
            </div>
            <div className="text-[10px] font-mono text-zinc-600">
              ID: {shortId} &middot; {files.length} files
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-900 rounded-md border border-zinc-800 overflow-hidden">
            <button
              onClick={() => setViewMode("preview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors",
                viewMode === "preview"
                  ? "bg-primary/15 text-primary"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors border-x border-zinc-800",
                viewMode === "split"
                  ? "bg-primary/15 text-primary"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors",
                viewMode === "code"
                  ? "bg-primary/15 text-primary"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code
            </button>
          </div>

          <span className="px-2 py-1 text-[10px] font-mono font-semibold rounded bg-primary/15 text-primary border border-primary/30">
            DEPLOYED
          </span>
          <span className="px-2 py-1 text-[10px] font-mono font-semibold rounded bg-green-500/15 text-green-400 border border-green-500/30">
            {passedCount}/{checks.length} CHECKS
          </span>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {(viewMode === "code" || viewMode === "split") && (
          <div className={cn("min-h-0", viewMode === "split" ? "w-1/2" : "w-full")}>
            <SandpackProvider
              template="react-ts"
              files={sandpackFiles}
              theme={SANDPACK_THEME}
            >
              <SandpackLayout
                style={{
                  height: "100%",
                  border: "none",
                  borderRadius: 0,
                  background: "#0a0a0f",
                }}
              >
                <SandpackFileExplorer
                  style={{
                    height: "100%",
                    minWidth: viewMode === "split" ? "160px" : "220px",
                    maxWidth: viewMode === "split" ? "180px" : "260px",
                  }}
                />
                <SandpackCodeEditor
                  showLineNumbers
                  showTabs
                  style={{
                    height: "100%",
                    flex: 1,
                  }}
                />
              </SandpackLayout>
            </SandpackProvider>
          </div>
        )}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className={cn("min-h-0 border-l border-zinc-800", viewMode === "split" ? "w-1/2" : "w-full")}>
            <iframe
              srcDoc={staticHtml}
              className="w-full h-full border-0"
              title="App Preview"
              sandbox=""
            />
          </div>
        )}
      </div>
    </div>
  );
}
