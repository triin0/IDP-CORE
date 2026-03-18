import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDeployProject, useDeleteProject } from "@workspace/api-client-react";
import { decryptError } from "@/lib/error-decryptor";
import type { ProjectDetails } from "@workspace/api-client-react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackFileExplorer,
  SandpackCodeEditor,
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { GoldenPath } from "./GoldenPath";
import { RefinementChat } from "./RefinementChat";
import { BuildGate } from "./BuildGate";
import { AppAnatomy } from "./AppAnatomy";
import { SnapshotTimeline } from "./SnapshotTimeline";
import { SeedDataGenerator } from "./SeedDataGenerator";
import { useXRayInspector } from "@/hooks/useXRayInspector";
import {
  Rocket, ExternalLink, Loader2, Code2, ArrowLeft, CheckCircle2,
  AlertCircle, Zap, ShieldCheck, Eye, FileCode, Download, Github,
  Trash2, Play, Monitor, PanelLeft, RefreshCw, Maximize2, Minimize2, Clock, Sparkles,
  Cpu, Crosshair,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { prepareSandpackFiles, SANDPACK_THEME } from "@/lib/sandpack-utils";

interface VerificationVerdictData {
  passed: boolean;
  failureCategory: string;
  summary: string;
  checks: Array<{
    name: string;
    passed: boolean;
    description: string;
    category: string;
  }>;
  hashAudit: Array<{
    path: string;
    status: string;
    currentHash?: string;
    expectedHash?: string;
  }>;
  buildPassed?: boolean;
  buildStderr?: string;
  dependencyErrors: string[];
  recommendedFixes: string[];
}

interface WorkspaceProps {
  project: ProjectDetails;
  onReset?: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`;

type PreviewMode = "sandpack" | "sandbox" | "static";

function PreviewPane({
  project,
  previewMode,
  setPreviewMode,
  liveUrl,
  inspectActive,
  onToggleInspect,
  hasAnnotations,
}: {
  project: ProjectDetails;
  previewMode: PreviewMode;
  setPreviewMode: (m: PreviewMode) => void;
  liveUrl: string | null;
  inspectActive?: boolean;
  onToggleInspect?: () => void;
  hasAnnotations?: boolean;
}) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const sandboxPreviewUrl = liveUrl?.includes("csb.app")
    ? liveUrl
    : (project as unknown as { sandboxId?: string }).sandboxId
      ? `https://${(project as unknown as { sandboxId?: string }).sandboxId}-3000.csb.app`
      : null;

  const hasLiveSandbox = !!sandboxPreviewUrl;

  const staticHtml = useMemo(() => {
    const files = (project.files ?? []) as Array<{ path: string; content: string }>;
    return buildStaticPreview(files, project.prompt || "");
  }, [project.files, project.prompt]);

  return (
    <div className={cn(
      "flex flex-col h-full bg-zinc-950",
      isExpanded && "fixed inset-0 z-50",
    )}>
      <div className="flex items-center justify-between px-2 py-1.5 bg-card border-b border-border/50 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewMode("sandpack")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors",
              previewMode === "sandpack"
                ? "bg-primary/15 text-primary"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            <Play className="w-3 h-3" />
            App
          </button>
          {hasLiveSandbox && (
            <button
              onClick={() => setPreviewMode("sandbox")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors",
                previewMode === "sandbox"
                  ? "bg-success/15 text-success"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Zap className="w-3 h-3" />
              Live
            </button>
          )}
          <button
            onClick={() => setPreviewMode("static")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors",
              previewMode === "static"
                ? "bg-zinc-700 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            <Monitor className="w-3 h-3" />
            Info
          </button>
        </div>
        <div className="flex items-center gap-1">
          {previewMode === "sandpack" && hasAnnotations && onToggleInspect && (
            <button
              onClick={onToggleInspect}
              className={cn(
                "flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono transition-all",
                inspectActive
                  ? "bg-primary/20 text-primary ring-1 ring-primary/40 shadow-[0_0_8px_rgba(34,211,238,0.15)]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
              )}
              title={inspectActive ? "Deactivate X-Ray Inspector" : "Activate X-Ray Inspector"}
            >
              <Crosshair className={cn("w-3 h-3", inspectActive && "animate-pulse")} />
              {inspectActive && <span>Inspect</span>}
            </button>
          )}
          {previewMode !== "sandpack" && (
            <button
              onClick={() => setIframeKey(k => k + 1)}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
          {sandboxPreviewUrl && previewMode === "sandbox" && (
            <a
              href={sandboxPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        {previewMode === "sandpack" && (
          <SandpackPreview
            showNavigator={false}
            showRefreshButton={true}
            style={{ height: "100%", border: "none" }}
          />
        )}
        {previewMode === "sandbox" && sandboxPreviewUrl && (
          <iframe
            key={iframeKey}
            src={sandboxPreviewUrl}
            className="w-full h-full border-0"
            title="Live Sandbox Preview"
            allow="cross-origin-isolated"
          />
        )}
        {previewMode === "static" && (
          <iframe
            key={`static-${iframeKey}`}
            srcDoc={staticHtml}
            className="w-full h-full border-0"
            title="Project Info"
            sandbox=""
          />
        )}
        {previewMode === "sandbox" && !sandboxPreviewUrl && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <AlertCircle className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-xs font-mono text-zinc-500">
                Deploy to see the live sandbox
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPanel({ project, onDeploy, isDeploying, deployUrl, deployError, onDelete, isDeleting }: {
  project: ProjectDetails;
  onDeploy: () => void;
  isDeploying: boolean;
  deployUrl: string | null;
  deployError: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const liveUrl = deployUrl || project.deployUrl;
  const effectiveStatus =
    project.status === "deployed" && !liveUrl ? "ready" : project.status;
  const isReady = effectiveStatus === "ready";
  const isDeployed = effectiveStatus === "deployed";
  const isFailed = effectiveStatus === "failed";
  const verdict = (project as unknown as { verificationVerdict?: VerificationVerdictData }).verificationVerdict;
  const canDeploy = isReady && verdict?.passed !== false;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 text-xs font-mono font-semibold text-zinc-500 border-b border-border/50 uppercase tracking-wider bg-card">
        Status
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        <div className={cn(
          "p-3 rounded-lg border flex items-start gap-3",
          isReady && "bg-success/5 border-success/20",
          isDeployed && "bg-primary/5 border-primary/20",
          isFailed && "bg-destructive/5 border-destructive/20",
        )}>
          {(isReady || isDeployed) && (
            <>
              <CheckCircle2 className={cn("w-5 h-5 mt-0.5 shrink-0", isDeployed ? "text-primary" : "text-success")} />
              <div>
                <div className={cn("text-sm font-mono font-semibold", isDeployed ? "text-primary" : "text-success")}>
                  {isDeployed ? "DEPLOYED" : "READY"}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {project.files.length} files generated and verified
                </div>
              </div>
            </>
          )}
          {isFailed && (
            <>
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-mono font-semibold text-destructive">FAILED</div>
                {(() => {
                  const decoded = decryptError(project.error || "");
                  return (
                    <>
                      <div className="text-xs text-zinc-300 mt-1">
                        <span className="mr-1">{decoded.emoji}</span>
                        {decoded.friendly}
                      </div>
                      {project.error && (
                        <details className="mt-1.5">
                          <summary className="text-[10px] font-mono text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors">
                            Technical details
                          </summary>
                          <div className="text-[10px] font-mono text-zinc-600 mt-1 p-1.5 rounded bg-zinc-950 border border-zinc-800 max-h-20 overflow-y-auto">
                            {project.error}
                          </div>
                        </details>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {project.goldenPathChecks && project.goldenPathChecks.length > 0 && (
          <GoldenPath checks={project.goldenPathChecks} />
        )}

        <BuildGate
          verdict={verdict ?? null}
          isValidating={false}
          status={project.status}
        />

        {(isReady || isDeployed) && project.files.some(f => f.path.includes("admin") || f.path.includes("Admin")) && (
          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <span className="text-base">⚙</span>
              <div>
                <div className="text-xs font-mono font-semibold text-amber-400">ADMIN MODE INCLUDED</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Your app includes a built-in management dashboard at <span className="text-amber-400/80 font-mono">/admin</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2">
          {liveUrl ? (
            <div className="space-y-2">
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center w-full px-4 py-2.5 rounded-lg font-mono text-sm font-medium bg-success/10 text-success border border-success/30 hover:bg-success/20 transition-all shadow-[0_0_15px_rgba(74,222,128,0.15)]"
              >
                {liveUrl.includes("csb.app") ? (
                  <><Zap className="w-4 h-4 mr-2" /> LIVE SANDBOX</>
                ) : (
                  <>LIVE PREVIEW</>
                )}
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
              {liveUrl.includes("csb.app") && (
                <p className="text-[10px] font-mono text-zinc-600 text-center">
                  Running on CodeSandbox cloud VM
                </p>
              )}
            </div>
          ) : canDeploy ? (
            <button
              onClick={onDeploy}
              disabled={isDeploying}
              className={cn(
                "flex items-center justify-center w-full px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all duration-300",
                isDeploying
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
              )}
            >
              {isDeploying ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> DEPLOYING TO SANDBOX...</>
              ) : (
                <><Rocket className="w-4 h-4 mr-2" /> DEPLOY TO LIVE SANDBOX</>
              )}
            </button>
          ) : isReady && !canDeploy ? (
            <div className="p-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <p className="text-[10px] font-mono text-amber-400 text-center">
                Deploy blocked — verification gate failed
              </p>
            </div>
          ) : null}

          {deployError && (
            <div className="mt-2 p-2 rounded-lg border border-destructive/30 bg-destructive/10">
              <p className="text-xs font-mono text-destructive">DEPLOY_FAILED: Could not deploy project. Please try again.</p>
            </div>
          )}
        </div>

        {(isReady || isDeployed) && (
          <ProjectActions projectId={project.id} onDelete={onDelete} isDeleting={isDeleting} />
        )}
      </div>
    </div>
  );
}

function ProjectActions({ projectId, onDelete, isDeleting }: {
  projectId: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingGithub, setIsExportingGithub] = useState(false);
  const [githubResult, setGithubResult] = useState<{ url: string; repository: string } | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleExportZip = async () => {
    setIsExportingZip(true);
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/export-zip`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] ?? `project-${projectId.slice(0, 8)}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ZIP export failed:", err);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleExportGithub = async () => {
    setIsExportingGithub(true);
    setGithubError(null);
    setGithubResult(null);
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/export-to-github`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ private: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGithubError(data.error || "GitHub export failed");
        return;
      }
      setGithubResult({ url: data.url, repository: data.repository });
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : "GitHub export failed");
    } finally {
      setIsExportingGithub(false);
    }
  };

  return (
    <div className="border-t border-border/50 pt-4 space-y-2">
      <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-2">Export & Manage</p>

      <button
        onClick={handleExportZip}
        disabled={isExportingZip}
        className="flex items-center w-full px-3 py-2 rounded-lg text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExportingZip ? (
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5 mr-2" />
        )}
        {isExportingZip ? "EXPORTING..." : "DOWNLOAD ZIP"}
        <span className="ml-auto text-[10px] text-zinc-600">+ audit</span>
      </button>

      <button
        onClick={handleExportGithub}
        disabled={isExportingGithub}
        className="flex items-center w-full px-3 py-2 rounded-lg text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExportingGithub ? (
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
        ) : (
          <Github className="w-3.5 h-3.5 mr-2" />
        )}
        {isExportingGithub ? "PUSHING..." : "EXPORT TO GITHUB"}
        <span className="ml-auto text-[10px] text-zinc-600">+ CI</span>
      </button>

      {githubResult && (
        <div className="p-2 rounded-lg border border-success/20 bg-success/5">
          <p className="text-[10px] font-mono text-success mb-1">
            <CheckCircle2 className="w-3 h-3 inline mr-1" />
            Pushed to {githubResult.repository}
          </p>
          <a
            href={githubResult.url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
          >
            Open on GitHub <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}

      {githubError && (
        <div className="p-2 rounded-lg border border-destructive/20 bg-destructive/5">
          <p className="text-[10px] font-mono text-destructive">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            {githubError}
          </p>
        </div>
      )}

      <div className="pt-2 border-t border-border/30">
        {showDeleteConfirm ? (
          <div className="space-y-2">
            <p className="text-[10px] font-mono text-destructive">
              This will permanently delete the project, its sandbox, and all files. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-3 py-1.5 rounded text-xs font-mono text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={() => { onDelete(); setShowDeleteConfirm(false); }}
                disabled={isDeleting}
                className="flex-1 px-3 py-1.5 rounded text-xs font-mono text-destructive bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "DELETING..." : "CONFIRM DELETE"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center w-full px-3 py-2 rounded-lg text-xs font-mono text-zinc-500 hover:text-destructive hover:bg-destructive/5 border border-transparent hover:border-destructive/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            DELETE PROJECT
          </button>
        )}
      </div>
    </div>
  );
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  const componentNames = componentFiles.map((f) =>
    esc(f.path.split("/").pop()?.replace(/\.(tsx|jsx)$/, "") || "")
  );
  const pageNames = pageFiles.map((f) =>
    esc(f.path.split("/").pop()?.replace(/\.(tsx|jsx)$/, "") || "")
  );
  const safeDeps = pkgDeps.filter((d) => !d.startsWith("@types/")).map(esc);
  const safePrompt = esc(prompt.charAt(0).toUpperCase() + prompt.slice(1));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #0f0f17; color: #e4e4e7; min-height: 100vh; }
    .banner { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-bottom: 1px solid #22d3ee33; padding: 12px 20px; display: flex; align-items: center; gap: 8px; }
    .badge { background: #22d3ee15; color: #22d3ee; border: 1px solid #22d3ee33; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-family: monospace; font-weight: 600; }
    .container { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
    .title { font-size: 24px; font-weight: 700; color: #f4f4f5; margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: #71717a; margin-bottom: 24px; }
    .section { background: #18182433; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .section-title { font-size: 12px; font-weight: 600; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
    .card { background: #1a1a2e; border: 1px solid #27272a; border-radius: 8px; padding: 10px 14px; font-size: 12px; font-family: monospace; color: #22d3ee; }
    .pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill { background: #27272a; border: 1px solid #3f3f46; border-radius: 20px; padding: 4px 12px; font-size: 11px; color: #a1a1aa; }
    .server { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #1a1a2e; border-radius: 8px; border: 1px solid #27272a; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  </style>
</head>
<body>
  <div class="banner"><span class="badge">INFO</span><span style="font-size:12px;color:#71717a;">Application architecture overview</span></div>
  <div class="container">
    <div class="title">${safePrompt}</div>
    <div class="subtitle">Full-stack &middot; ${files.length} files</div>
    ${pageNames.length > 0 ? `<div class="section"><div class="section-title">Pages</div><div class="grid">${pageNames.map(n => `<div class="card">${n}</div>`).join("")}</div></div>` : ""}
    ${componentNames.length > 0 ? `<div class="section"><div class="section-title">Components</div><div class="grid">${componentNames.map(n => `<div class="card">${n}</div>`).join("")}</div></div>` : ""}
    ${serverFiles.length > 0 ? `<div class="section"><div class="section-title">Backend</div><div class="server"><div class="dot"></div><span style="font-size:13px;color:#d4d4d8;">Express server &middot; ${serverFiles.length} files</span></div></div>` : ""}
    ${schemaFiles.length > 0 ? `<div class="section"><div class="section-title">Database</div><div class="grid">${schemaFiles.map(f => `<div class="card">${esc(f.path.split("/").pop() || "")}</div>`).join("")}</div></div>` : ""}
    ${safeDeps.length > 0 ? `<div class="section"><div class="section-title">Stack</div><div class="pills">${safeDeps.map(d => `<div class="pill">${d}</div>`).join("")}</div></div>` : ""}
    ${files.some(f => f.path.includes("admin") || f.path.includes("Admin")) ? `<div class="section" style="border-color: #f59e0b33; background: #f59e0b08;"><div class="section-title" style="color:#f59e0b;">⚙ Admin Dashboard</div><div style="font-size:13px;color:#d4d4d8;">This app includes a built-in management dashboard at <span style="font-family:monospace;color:#f59e0b;">/admin</span> where you can add, edit, and delete your data without touching code.</div></div>` : ""}
  </div>
</body>
</html>`;
}

function SandpackWorkspaceInner({
  project,
  rightPanel,
  setRightPanel,
  previewMode,
  setPreviewMode,
  liveUrl,
  showSidebar,
  handleDeploy,
  deployMut,
  handleDelete,
  deleteMut,
  onSnapshotRestore,
}: {
  project: ProjectDetails;
  rightPanel: "status" | "preview" | "anatomy" | "timeline" | "seeds";
  setRightPanel: (p: "status" | "preview" | "anatomy" | "timeline" | "seeds") => void;
  previewMode: PreviewMode;
  setPreviewMode: (m: PreviewMode) => void;
  liveUrl: string | null;
  showSidebar: boolean;
  handleDeploy: () => void;
  deployMut: { isPending: boolean; data?: { deployUrl?: string } | undefined; isError: boolean };
  handleDelete: () => void;
  deleteMut: { isPending: boolean };
  onSnapshotRestore: () => void;
}) {
  const editorRef = useRef<{ getCodemirror: () => unknown } | null>(null);
  const { inspectActive, toggleInspect, lastSelected } = useXRayInspector(editorRef);
  const hasAnnotations = Array.isArray(project.annotatedFiles) && project.annotatedFiles.length > 0;

  return (
    <>
      <div className="flex-1 flex min-h-0">
        <ResizablePanelGroup direction="horizontal" className="min-h-0">
          <ResizablePanel defaultSize={55} minSize={30}>
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
                  minWidth: "180px",
                  maxWidth: "220px",
                }}
              />
              <div className="relative flex-1 h-full flex flex-col">
                <SandpackCodeEditor
                  ref={editorRef as React.Ref<never>}
                  showLineNumbers
                  showTabs
                  wrapContent
                  style={{
                    height: "100%",
                    flex: 1,
                  }}
                />
                {lastSelected && inspectActive && (
                  <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 px-2 py-1 rounded bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary pointer-events-none z-10">
                    <Crosshair className="w-3 h-3 shrink-0" />
                    <span className="truncate">{lastSelected}</span>
                  </div>
                )}
              </div>
            </SandpackLayout>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/30 transition-colors" />

          <ResizablePanel defaultSize={showSidebar ? 25 : 45} minSize={20}>
            {rightPanel === "preview" ? (
              <PreviewPane
                project={project}
                previewMode={previewMode}
                setPreviewMode={setPreviewMode}
                liveUrl={liveUrl}
                inspectActive={inspectActive}
                onToggleInspect={toggleInspect}
                hasAnnotations={hasAnnotations}
              />
            ) : rightPanel === "anatomy" ? (
              <AppAnatomy project={project} onSwitchToEditor={() => setRightPanel("status")} />
            ) : rightPanel === "timeline" ? (
              <SnapshotTimeline project={project} onRestoreComplete={onSnapshotRestore} />
            ) : rightPanel === "seeds" ? (
              <SeedDataGenerator project={project} />
            ) : (
              <div className="h-full overflow-y-auto">
                <StatusPanel
                  project={project}
                  onDeploy={handleDeploy}
                  isDeploying={deployMut.isPending}
                  deployUrl={deployMut.data?.deployUrl || null}
                  deployError={deployMut.isError}
                  onDelete={handleDelete}
                  isDeleting={deleteMut.isPending}
                />
              </div>
            )}
          </ResizablePanel>

          {showSidebar && rightPanel === "preview" && (
            <>
              <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/30 transition-colors" />
              <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                <div className="h-full overflow-y-auto">
                  <StatusPanel
                    project={project}
                    onDeploy={handleDeploy}
                    isDeploying={deployMut.isPending}
                    deployUrl={deployMut.data?.deployUrl || null}
                    deployError={deployMut.isError}
                    onDelete={handleDelete}
                    isDeleting={deleteMut.isPending}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {(project.status === "ready" || project.status === "deployed") && (
        <RefinementChat
          projectId={project.id}
          refinements={project.refinements ?? []}
          projectFiles={(project.files ?? []) as Array<{ path: string; content: string }>}
        />
      )}
    </>
  );
}

export function Workspace({ project, onReset }: WorkspaceProps) {
  const [rightPanel, setRightPanel] = useState<"status" | "preview" | "anatomy" | "timeline" | "seeds">("status");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("sandpack");
  const [showSidebar, setShowSidebar] = useState(true);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [, navigate] = useLocation();

  const queryClient = useQueryClient();
  const deployMut = useDeployProject();
  const deleteMut = useDeleteProject();

  const handleDeploy = () => {
    deployMut.mutate(
      { id: project.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
        },
      }
    );
  };

  const handleDelete = () => {
    deleteMut.mutate(
      { id: project.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
          navigate("/");
        },
      }
    );
  };

  const liveUrl = deployMut.data?.deployUrl || project.deployUrl || null;

  const sandpackFiles = useMemo(
    () => prepareSandpackFiles(
      (project.files ?? []) as Array<{ path: string; content: string }>,
      (project.annotatedFiles ?? undefined) as Array<{ path: string; content: string }> | undefined,
    ).files,
    [project.files, project.annotatedFiles]
  );

  const hasAnyFiles = Object.keys(sandpackFiles).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[calc(100vh-60px)] w-full max-w-[1800px] mx-auto p-4 flex flex-col"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center space-x-3">
          {onReset && (
            <button
              onClick={onReset}
              className="p-1.5 rounded-lg hover:bg-secondary text-zinc-400 hover:text-zinc-200 transition-colors"
              title="New project"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="p-2 bg-primary/10 rounded-lg ring-1 ring-primary/30">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center">
              Workspace
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                {project.id.split("-")[0]}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 font-mono truncate max-w-lg">
              {project.prompt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors border",
              showSidebar
                ? "bg-zinc-800 text-zinc-200 border-zinc-700"
                : "text-zinc-500 hover:text-zinc-300 border-zinc-800",
            )}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            Panel
          </button>
          <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
            <button
              onClick={() => setRightPanel("status")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                rightPanel === "status" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <ShieldCheck className="w-3 h-3" />
              Status
            </button>
            <button
              onClick={() => setRightPanel("preview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                rightPanel === "preview" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Eye className="w-3 h-3" />
              Preview
            </button>
            <button
              onClick={() => setRightPanel("anatomy")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                rightPanel === "anatomy" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Cpu className="w-3 h-3" />
              X-Ray
            </button>
            <button
              onClick={() => setRightPanel("timeline")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                rightPanel === "timeline" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Clock className="w-3 h-3" />
              Timeline
            </button>
            <button
              onClick={() => setRightPanel("seeds")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                rightPanel === "seeds" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Sparkles className="w-3 h-3" />
              Seeds
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-card border border-border shadow-2xl rounded-xl overflow-hidden flex flex-col min-h-0">
        {hasAnyFiles ? (
          <SandpackProvider
            key={`sandpack-${Object.keys(sandpackFiles).length}-${snapshotVersion}`}
            template="react-ts"
            files={sandpackFiles}
            theme={SANDPACK_THEME}
            options={{
              recompileMode: "delayed",
              recompileDelay: 500,
            }}
          >
            <SandpackWorkspaceInner
              project={project}
              rightPanel={rightPanel}
              setRightPanel={setRightPanel}
              previewMode={previewMode}
              setPreviewMode={setPreviewMode}
              liveUrl={liveUrl}
              showSidebar={showSidebar}
              handleDeploy={handleDeploy}
              deployMut={deployMut}
              handleDelete={handleDelete}
              deleteMut={deleteMut}
              onSnapshotRestore={() => setSnapshotVersion((v) => v + 1)}
            />
          </SandpackProvider>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8">
              <Code2 className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-sm font-mono text-zinc-500">
                No files to display yet
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
