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
import { ErrorDecryptorOverlay } from "./ErrorDecryptorOverlay";
import { ExpoSnackEmbed } from "./ExpoSnackEmbed";
import { useXRayInspector } from "@/hooks/useXRayInspector";
import {
  Rocket, ExternalLink, Loader2, Code2, ArrowLeft, CheckCircle2,
  AlertCircle, Zap, ShieldCheck, Eye, FileCode, Download, Github,
  Trash2, Play, Monitor, PanelLeft, RefreshCw, Maximize2, Minimize2, Clock, Sparkles,
  Cpu, Crosshair, Smartphone,
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

type PreviewMode = "sandpack" | "sandbox" | "static" | "swagger" | "snack";

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

  const isFastAPI = project.engine === "fastapi";
  const isMobile = project.engine === "mobile-expo";

  const staticHtml = useMemo(() => {
    const files = (project.files ?? []) as Array<{ path: string; content: string }>;
    return buildStaticPreview(files, project.prompt || "");
  }, [project.files, project.prompt]);

  const swaggerHtml = useMemo(() => {
    if (!isFastAPI) return "";
    const files = (project.files ?? []) as Array<{ path: string; content: string }>;
    const mainPy = files.find((f) => f.path === "main.py");
    return buildSwaggerPreview(mainPy?.content ?? "", project.prompt || "");
  }, [isFastAPI, project.files, project.prompt]);

  return (
    <div className={cn(
      "flex flex-col h-full bg-zinc-950",
      isExpanded && "fixed inset-0 z-50",
    )}>
      <div className="flex items-center justify-between px-2 py-1.5 bg-card border-b border-border/50 shrink-0">
        <div className="flex items-center gap-1">
          {isMobile ? (
            <button
              onClick={() => setPreviewMode("snack")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors",
                previewMode === "snack"
                  ? "bg-blue-500/15 text-blue-400"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Smartphone className="w-3 h-3" />
              Device
            </button>
          ) : isFastAPI ? (
            <button
              onClick={() => setPreviewMode("swagger")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors",
                previewMode === "swagger"
                  ? "bg-primary/15 text-primary"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <FileCode className="w-3 h-3" />
              Swagger
            </button>
          ) : (
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
          )}
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
        {previewMode === "swagger" && isFastAPI && (
          <iframe
            key={`swagger-${iframeKey}`}
            srcDoc={swaggerHtml}
            className="w-full h-full border-0"
            title="Swagger UI Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
        {previewMode === "snack" && isMobile && (
          <ExpoSnackEmbed project={project} />
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
    <div className="flex flex-col">
      <div className="px-4 py-2 text-xs font-mono font-semibold text-zinc-500 border-b border-border/50 uppercase tracking-wider bg-card">
        Status
      </div>

      <div className="p-4 space-y-4">
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

function buildSwaggerPreview(mainPyContent: string, prompt: string): string {
  const safePrompt = esc(prompt.slice(0, 200));

  interface RouteInfo {
    method: string;
    path: string;
    docstring: string;
    responseModel: string;
    requestBody: string;
    statusCode: string;
    tags: string;
  }

  const routes: RouteInfo[] = [];
  const routeBlockRegex = /@(?:app|router)\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']([^)]*)\)\s*\nasync\s+def\s+\w+\([^)]*\)[^:]*:\s*\n\s*"""([^"]*)"""/gi;
  let match;
  while ((match = routeBlockRegex.exec(mainPyContent)) !== null) {
    const decoratorArgs = match[3] || "";
    const responseModelMatch = decoratorArgs.match(/response_model\s*=\s*(\w+(?:\[\w+\])?)/);
    const statusCodeMatch = decoratorArgs.match(/status_code\s*=\s*(?:status\.)?(\w+)/);
    const tagsMatch = decoratorArgs.match(/tags\s*=\s*\["([^"]+)"\]/);
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      docstring: match[4].trim(),
      responseModel: responseModelMatch ? responseModelMatch[1] : "",
      requestBody: "",
      statusCode: statusCodeMatch ? statusCodeMatch[1] : "",
      tags: tagsMatch ? tagsMatch[1] : "",
    });
  }

  if (routes.length === 0) {
    const simpleRouteRegex = /@(?:app|router)\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']([^)]*)\)/gi;
    while ((match = simpleRouteRegex.exec(mainPyContent)) !== null) {
      const decoratorArgs = match[3] || "";
      const responseModelMatch = decoratorArgs.match(/response_model\s*=\s*(\w+(?:\[\w+\])?)/);
      const statusCodeMatch = decoratorArgs.match(/status_code\s*=\s*(?:status\.)?(\w+)/);
      const tagsMatch = decoratorArgs.match(/tags\s*=\s*\["([^"]+)"\]/);
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        docstring: "",
        responseModel: responseModelMatch ? responseModelMatch[1] : "",
        requestBody: "",
        statusCode: statusCodeMatch ? statusCodeMatch[1] : "",
        tags: tagsMatch ? tagsMatch[1] : "",
      });
    }
  }

  const funcSignatureRegex = /async\s+def\s+\w+\(([^)]*)\)/g;
  const funcBodies: string[] = [];
  while ((match = funcSignatureRegex.exec(mainPyContent)) !== null) {
    funcBodies.push(match[1]);
  }
  for (let i = 0; i < routes.length && i < funcBodies.length; i++) {
    const bodyModelMatch = funcBodies[i]?.match(/(\w+):\s*(\w+(?:Create|Update|Base))/);
    if (bodyModelMatch) {
      routes[i].requestBody = bodyModelMatch[2];
    }
  }

  interface ModelField {
    name: string;
    type: string;
    default: string;
    description: string;
  }
  interface ModelInfo {
    name: string;
    parent: string;
    fields: ModelField[];
    config: string;
  }

  const models: ModelInfo[] = [];
  const classBlockRegex = /class\s+(\w+)\((\w+(?:,\s*\w+)*)\):\s*\n((?:\s+.*\n)*?)(?=\nclass\s|\n[^\s]|\n*$)/g;
  while ((match = classBlockRegex.exec(mainPyContent)) !== null) {
    const name = match[1];
    const parent = match[2].trim();
    const body = match[3] || "";
    const fields: ModelField[] = [];
    let config = "";

    const fieldRegex = /^\s+(\w+):\s*(.+?)(?:\s*=\s*(.+))?$/gm;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const fieldName = fieldMatch[1];
      if (fieldName === "model_config" || fieldName === "__tablename__") {
        if (fieldName === "model_config") {
          config = fieldMatch[3] || fieldMatch[2];
        }
        continue;
      }
      const fieldType = fieldMatch[2].replace(/\s*=\s*$/, "").trim();
      const fieldDefault = fieldMatch[3]?.trim() || "";
      const descMatch = fieldDefault.match(/description\s*=\s*"([^"]+)"/);
      fields.push({
        name: fieldName,
        type: fieldType,
        default: fieldDefault.replace(/Field\(.*\)/, "").trim(),
        description: descMatch ? descMatch[1] : "",
      });
    }

    if (parent.includes("BaseModel") || parent.includes("Base") || parent === "DeclarativeBase" ||
        name.endsWith("Create") || name.endsWith("Update") || name.endsWith("Response") || name.endsWith("Base")) {
      models.push({ name, parent, fields, config });
    }
  }

  const pydanticModels = models.filter((m) =>
    m.parent.includes("BaseModel") || m.parent.includes("Base") && !m.parent.includes("Declarative") &&
    (m.name.endsWith("Base") || m.name.endsWith("Create") || m.name.endsWith("Update") || m.name.endsWith("Response"))
  );
  const dbModels = models.filter((m) =>
    m.parent === "Base" && m.fields.some((f) => f.type.includes("Mapped"))
  );

  const methodColors: Record<string, { bg: string; border: string; text: string; bgHover: string }> = {
    GET:    { bg: "#61affe12", border: "#61affe40", text: "#61affe", bgHover: "#61affe22" },
    POST:   { bg: "#49cc9012", border: "#49cc9040", text: "#49cc90", bgHover: "#49cc9022" },
    PUT:    { bg: "#fca13012", border: "#fca13040", text: "#fca130", bgHover: "#fca13022" },
    PATCH:  { bg: "#50e3c212", border: "#50e3c240", text: "#50e3c2", bgHover: "#50e3c222" },
    DELETE: { bg: "#f93e3e12", border: "#f93e3e40", text: "#f93e3e", bgHover: "#f93e3e22" },
  };

  const tagGroups = new Map<string, RouteInfo[]>();
  for (const r of routes) {
    const tag = r.tags || "Default";
    if (!tagGroups.has(tag)) tagGroups.set(tag, []);
    tagGroups.get(tag)!.push(r);
  }

  let routeIndex = 0;
  const groupsHtml = Array.from(tagGroups.entries()).map(([tag, groupRoutes]) => {
    const routesHtml = groupRoutes.map((r) => {
      const c = methodColors[r.method] || methodColors.GET;
      const idx = routeIndex++;
      const pathParams = r.path.match(/\{(\w+)\}/g)?.map((p) => p.slice(1, -1)) || [];
      const hasPathParams = pathParams.length > 0;
      const statusCodeDisplay = r.statusCode
        ? r.statusCode.replace("HTTP_", "").replace(/_/g, " ")
        : (r.method === "POST" ? "201 Created" : r.method === "DELETE" ? "204 No Content" : "200 OK");

      return `<div class="route-card" data-idx="${idx}" style="border:1px solid ${c.border};border-radius:8px;margin-bottom:8px;overflow:hidden;background:${c.bg};">
        <div class="route-header" onclick="toggleRoute(${idx})" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='${c.bgHover}'" onmouseout="this.style.background='transparent'">
          <span class="method-badge" style="font-weight:700;font-size:11px;color:#fff;background:${c.text};min-width:60px;text-align:center;padding:4px 0;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">${esc(r.method)}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#e0e0e0;flex:1;">${esc(r.path)}</span>
          ${r.docstring ? `<span style="font-size:11px;color:#888;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.docstring)}</span>` : ""}
          <svg class="chevron chevron-${idx}" style="width:14px;height:14px;fill:#555;transition:transform 0.2s;flex-shrink:0;" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
        </div>
        <div class="route-body route-body-${idx}" style="display:none;border-top:1px solid ${c.border};padding:14px;background:#0d0d12;">
          ${r.docstring ? `<div style="font-size:12px;color:#aaa;margin-bottom:12px;">${esc(r.docstring)}</div>` : ""}
          ${hasPathParams ? `
            <div class="detail-section">
              <div class="detail-title">Path Parameters</div>
              ${pathParams.map((p) => `<div class="param-row"><span class="param-name">${esc(p)}</span><span class="param-type">string</span><span class="param-required">required</span></div>`).join("")}
            </div>` : ""}
          ${r.requestBody ? `
            <div class="detail-section">
              <div class="detail-title">Request Body</div>
              <div class="schema-ref" onclick="scrollToModel('${esc(r.requestBody)}')" style="cursor:pointer;">
                <span style="color:#888;">application/json</span>
                <span style="color:${c.text};font-family:'JetBrains Mono',monospace;font-size:12px;text-decoration:underline;">${esc(r.requestBody)}</span>
              </div>
            </div>` : ""}
          <div class="detail-section">
            <div class="detail-title">Response</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="status-badge">${esc(statusCodeDisplay)}</span>
              ${r.responseModel ? `<span style="color:${c.text};font-family:'JetBrains Mono',monospace;font-size:12px;cursor:pointer;text-decoration:underline;" onclick="scrollToModel('${esc(r.responseModel)}')">${esc(r.responseModel)}</span>` : ""}
            </div>
          </div>
        </div>
      </div>`;
    }).join("\n");

    return `<div class="tag-group">
      <div class="tag-header" onclick="toggleTag('${esc(tag)}')" style="cursor:pointer;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg class="tag-chevron tag-chevron-${esc(tag)}" style="width:12px;height:12px;fill:#22d3ee;transition:transform 0.2s;" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          <span style="font-size:13px;font-weight:600;color:#e4e4e7;">${esc(tag)}</span>
          <span style="font-size:10px;color:#555;font-family:'JetBrains Mono',monospace;">${groupRoutes.length} endpoint${groupRoutes.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div class="tag-body tag-body-${esc(tag)}" style="margin-top:8px;">
        ${routesHtml}
      </div>
    </div>`;
  }).join("\n");

  const schemasHtml = pydanticModels.length > 0 ? pydanticModels.map((m) => {
    const isCreate = m.name.endsWith("Create");
    const isResponse = m.name.endsWith("Response");
    const schemaColor = isCreate ? "#49cc90" : isResponse ? "#61affe" : "#fca130";
    const schemaLabel = isCreate ? "Input" : isResponse ? "Output" : "Base";

    return `<div class="model-card" id="model-${esc(m.name)}" style="border:1px solid #27272a;border-radius:8px;margin-bottom:10px;overflow:hidden;background:#111118;">
      <div class="model-header" onclick="toggleModel('${esc(m.name)}')" style="display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;border-bottom:1px solid transparent;" onmouseover="this.style.background='#161622'" onmouseout="this.style.background='transparent'">
        <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:#e4e4e7;flex:1;">${esc(m.name)}</span>
        <span style="font-size:9px;font-weight:600;color:${schemaColor};background:${schemaColor}15;border:1px solid ${schemaColor}30;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;">${schemaLabel}</span>
        ${m.config.includes("forbid") ? `<span style="font-size:9px;color:#f93e3e;background:#f93e3e12;border:1px solid #f93e3e30;padding:2px 6px;border-radius:10px;">strict</span>` : ""}
        <svg class="model-chevron model-chevron-${esc(m.name)}" style="width:14px;height:14px;fill:#555;transition:transform 0.2s;" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
      </div>
      <div class="model-body model-body-${esc(m.name)}" style="display:none;border-top:1px solid #27272a;padding:0;">
        ${m.fields.length > 0 ? m.fields.map((f, fi) => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 14px;${fi < m.fields.length - 1 ? "border-bottom:1px solid #1a1a22;" : ""}">
            <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#e4e4e7;min-width:100px;">${esc(f.name)}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#22d3ee;min-width:80px;">${esc(f.type.replace(/Mapped\[/, "").replace(/\]$/, ""))}</span>
            ${f.description ? `<span style="font-size:11px;color:#666;flex:1;">${esc(f.description)}</span>` : ""}
          </div>
        `).join("") : `<div style="padding:10px 14px;font-size:11px;color:#555;">Inherits fields from parent</div>`}
      </div>
    </div>`;
  }).join("\n") : "";

  const dbModelsHtml = dbModels.length > 0 ? dbModels.map((m) => {
    return `<div class="model-card" id="model-${esc(m.name)}" style="border:1px solid #27272a;border-radius:8px;margin-bottom:10px;overflow:hidden;background:#111118;">
      <div class="model-header" onclick="toggleModel('${esc(m.name)}')" style="display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;" onmouseover="this.style.background='#161622'" onmouseout="this.style.background='transparent'">
        <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:#e4e4e7;flex:1;">${esc(m.name)}</span>
        <span style="font-size:9px;font-weight:600;color:#4ade80;background:#4ade8015;border:1px solid #4ade8030;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;">Table</span>
        <svg class="model-chevron model-chevron-${esc(m.name)}" style="width:14px;height:14px;fill:#555;transition:transform 0.2s;" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
      </div>
      <div class="model-body model-body-${esc(m.name)}" style="display:none;border-top:1px solid #27272a;padding:0;">
        ${m.fields.map((f, fi) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;${fi < m.fields.length - 1 ? "border-bottom:1px solid #1a1a22;" : ""}">
            <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#e4e4e7;min-width:120px;">${esc(f.name)}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#a78bfa;">${esc(f.type)}</span>
          </div>
        `).join("")}
      </div>
    </div>`;
  }).join("\n") : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #08080d; color: #e4e4e7; min-height: 100vh; }
    .topbar {
      background: linear-gradient(180deg, #0f0f18 0%, #0a0a12 100%);
      border-bottom: 1px solid #1a1a2e;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      gap: 14px;
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(12px);
    }
    .topbar-logo {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #009688 0%, #00796b 100%);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 16px; color: white;
      box-shadow: 0 2px 8px #00968833;
    }
    .topbar-info { flex: 1; }
    .topbar-title { font-size: 16px; font-weight: 600; color: #f4f4f5; display: flex; align-items: center; gap: 8px; }
    .topbar-version {
      font-size: 10px; font-weight: 600; color: #22d3ee;
      background: #22d3ee12; border: 1px solid #22d3ee25;
      padding: 2px 8px; border-radius: 10px;
      font-family: 'JetBrains Mono', monospace;
    }
    .topbar-desc { font-size: 12px; color: #71717a; margin-top: 2px; max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .topbar-stats { display: flex; gap: 16px; }
    .stat { text-align: center; }
    .stat-val { font-size: 18px; font-weight: 700; color: #22d3ee; font-family: 'JetBrains Mono', monospace; }
    .stat-label { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
    .container { max-width: 900px; margin: 0 auto; padding: 24px; }
    .server-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; margin-bottom: 24px;
      background: #111118; border: 1px solid #1e1e2e; border-radius: 8px;
    }
    .server-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    .section-header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 14px; margin-top: 28px;
      padding-bottom: 8px; border-bottom: 1px solid #1a1a22;
    }
    .section-icon { width: 18px; height: 18px; fill: #22d3ee; }
    .section-label { font-size: 14px; font-weight: 600; color: #e4e4e7; }
    .tag-group { margin-bottom: 20px; }
    .tag-header {
      padding: 8px 12px; background: #0f0f18; border: 1px solid #1e1e2e;
      border-radius: 6px; margin-bottom: 4px;
    }
    .detail-section { margin-bottom: 12px; }
    .detail-title { font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
    .param-row {
      display: flex; align-items: center; gap: 10px;
      padding: 5px 10px; background: #0a0a0f; border-radius: 4px; margin-bottom: 3px;
    }
    .param-name { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #e4e4e7; min-width: 80px; }
    .param-type { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #a78bfa; }
    .param-required { font-size: 9px; color: #f93e3e; font-weight: 600; text-transform: uppercase; }
    .schema-ref { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #0a0a0f; border-radius: 4px; }
    .status-badge {
      font-size: 11px; font-weight: 600; color: #4ade80;
      background: #4ade8012; border: 1px solid #4ade8025;
      padding: 3px 10px; border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
    }
    .footer {
      margin-top: 32px; padding: 14px 16px;
      background: #0d0d14; border: 1px solid #1a1a22; border-radius: 8px;
      display: flex; align-items: center; gap: 10px;
    }
    .footer-icon { width: 16px; height: 16px; fill: #555; }
    .footer-text { font-size: 11px; color: #555; }
    .footer-text strong { color: #22d3ee; }
    .expanded .chevron { transform: rotate(180deg); }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-logo">F</div>
    <div class="topbar-info">
      <div class="topbar-title">
        FastAPI Backend
        <span class="topbar-version">v1.0.0</span>
        <span style="font-size:10px;color:#4ade80;background:#4ade8012;border:1px solid #4ade8025;padding:2px 8px;border-radius:10px;font-family:'JetBrains Mono',monospace;">Python 3.12+</span>
      </div>
      <div class="topbar-desc">${safePrompt}</div>
    </div>
    <div class="topbar-stats">
      <div class="stat"><div class="stat-val">${routes.length}</div><div class="stat-label">Endpoints</div></div>
      <div class="stat"><div class="stat-val">${pydanticModels.length}</div><div class="stat-label">Schemas</div></div>
      <div class="stat"><div class="stat-val">${dbModels.length}</div><div class="stat-label">Tables</div></div>
    </div>
  </div>

  <div class="container">
    <div class="server-bar">
      <div class="server-dot"></div>
      <span style="font-size:12px;color:#aaa;">Base URL</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#22d3ee;">http://localhost:8000</span>
      <span style="margin-left:auto;font-size:10px;color:#555;font-family:'JetBrains Mono',monospace;">/api/v1/docs</span>
    </div>

    <div class="section-header">
      <svg class="section-icon" viewBox="0 0 24 24"><path d="M21 12.22C21 6.73 16.74 3 12 3c-4.69 0-9 3.65-9 9.28-.6.34-1 .98-1 1.72v2c0 1.1.9 2 2 2h1v-6.1c0-3.87 3.13-7 7-7s7 3.13 7 7V19h-8v2h8c1.1 0 2-.9 2-2v-1.22c.59-.31 1-.92 1-1.64v-2.3c0-.7-.41-1.31-1-1.62z"/></svg>
      <span class="section-label">API Endpoints</span>
    </div>

    ${groupsHtml || '<div style="color:#555;font-size:12px;padding:12px;">No endpoints detected in source</div>'}

    ${pydanticModels.length > 0 ? `
    <div class="section-header">
      <svg class="section-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      <span class="section-label">Schemas (Pydantic v2)</span>
    </div>
    ${schemasHtml}
    ` : ""}

    ${dbModels.length > 0 ? `
    <div class="section-header">
      <svg class="section-icon" style="fill:#4ade80;" viewBox="0 0 24 24"><path d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zM6 17V9.27C7.52 10.04 9.62 10.5 12 10.5s4.48-.46 6-1.23V17c0 .5-2.13 2-6 2s-6-1.5-6-2z"/></svg>
      <span class="section-label">Database Models (SQLAlchemy 2.0)</span>
    </div>
    ${dbModelsHtml}
    ` : ""}

    <div class="footer">
      <svg class="footer-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      <span class="footer-text">
        Generated by <strong>IDP.CORE</strong> FastAPI Engine.
        Deploy with <strong>uvicorn main:app --reload</strong> to access interactive Swagger docs at <strong>/api/v1/docs</strong>.
      </span>
    </div>
  </div>

  <script>
    function toggleRoute(idx) {
      const body = document.querySelector('.route-body-' + idx);
      const chevron = document.querySelector('.chevron-' + idx);
      if (!body) return;
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
    }
    function toggleTag(tag) {
      const body = document.querySelector('.tag-body-' + CSS.escape(tag));
      const chevron = document.querySelector('.tag-chevron-' + CSS.escape(tag));
      if (!body) return;
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      if (chevron) chevron.style.transform = open ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
    function toggleModel(name) {
      const body = document.querySelector('.model-body-' + CSS.escape(name));
      const chevron = document.querySelector('.model-chevron-' + CSS.escape(name));
      if (!body) return;
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
    }
    function scrollToModel(name) {
      const el = document.getElementById('model-' + name);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const body = el.querySelector('[class*="model-body"]');
      const chevron = el.querySelector('[class*="model-chevron"]');
      if (body && body.style.display === 'none') {
        body.style.display = 'block';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      }
      el.style.transition = 'box-shadow 0.3s';
      el.style.boxShadow = '0 0 0 2px #22d3ee44';
      setTimeout(() => { el.style.boxShadow = 'none'; }, 1500);
    }
  </script>
</body>
</html>`;
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
  const queryClient = useQueryClient();
  const editorRef = useRef<{ getCodemirror: () => unknown } | null>(null);
  const { inspectActive, toggleInspect, lastSelected } = useXRayInspector(editorRef);
  const hasAnnotations = Array.isArray(project.annotatedFiles) && project.annotatedFiles.length > 0;
  const isFastAPIInner = project.engine === "fastapi";
  const isMobileInner = project.engine === "mobile-expo";
  const usePlainEditor = isFastAPIInner || isMobileInner;
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const projectFiles = useMemo(() => {
    return ((project.files ?? []) as Array<{ path: string; content: string }>);
  }, [project.files]);

  const displayFile = activeFile ?? (projectFiles.length > 0 ? projectFiles[0].path : null);
  const displayContent = projectFiles.find((f) => f.path === displayFile)?.content ?? "";

  return (
    <>
      <div className="flex-1 flex min-h-0">
        <ResizablePanelGroup direction="horizontal" className="min-h-0">
          <ResizablePanel defaultSize={55} minSize={30}>
            {usePlainEditor ? (
              <div className="flex h-full" style={{ background: "#0a0a0f" }}>
                <div className="flex flex-col border-r border-zinc-800 overflow-auto" style={{ minWidth: 160, maxWidth: 200 }}>
                  <div className="px-3 py-2 text-[10px] font-mono text-zinc-600 uppercase tracking-wider border-b border-zinc-800">
                    Files
                  </div>
                  {projectFiles.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => setActiveFile(f.path)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors",
                        displayFile === f.path
                          ? "bg-primary/10 text-primary"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900",
                      )}
                    >
                      {f.path}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-auto">
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-950">
                    <FileCode className="w-3 h-3 text-zinc-600" />
                    <span className="text-[11px] font-mono text-zinc-400">{displayFile}</span>
                    <span className="ml-auto text-[9px] font-mono text-zinc-700 bg-zinc-900 px-1.5 py-0.5 rounded">
                      {isMobileInner ? "TSX" : "PYTHON"}
                    </span>
                  </div>
                  <pre className="p-4 text-[12px] font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">{displayContent}</pre>
                </div>
              </div>
            ) : (
              <SandpackLayout
                style={{
                  height: "100%",
                  border: "none",
                  borderRadius: 0,
                  background: "#0a0a0f",
                  overflow: "hidden",
                }}
              >
                <SandpackFileExplorer
                  style={{
                    height: "100%",
                    minWidth: "180px",
                    maxWidth: "220px",
                    overflow: "auto",
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
                  <ErrorDecryptorOverlay
                    projectId={project.id}
                    onFixApplied={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
                      queryClient.invalidateQueries({ queryKey: ["snapshots", project.id] });
                      onSnapshotRestore();
                    }}
                  />
                </div>
              </SandpackLayout>
            )}
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
  const projectEngine = project.engine;
  const isFastAPIProject = projectEngine === "fastapi";
  const isMobileProject = projectEngine === "mobile-expo";
  const [previewMode, setPreviewMode] = useState<PreviewMode>(isMobileProject ? "snack" : isFastAPIProject ? "swagger" : "sandpack");
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

  const sandpackDeps = useMemo(() => {
    const files = (project.files ?? []) as Array<{ path: string; content: string }>;
    const clientPkg = files.find(f => f.path === "client/package.json");
    const rootPkg = files.find(f => f.path === "package.json");
    const pkgFile = clientPkg || rootPkg;
    if (!pkgFile) return {};
    try {
      const parsed = JSON.parse(pkgFile.content);
      const deps: Record<string, string> = { ...(parsed.dependencies || {}) };
      const NODE_ONLY = new Set(["vite", "typescript", "concurrently", "tsx", "esbuild",
        "@vitejs/plugin-react", "@tailwindcss/vite", "@types/react", "@types/react-dom", "@types/node",
        "drizzle-kit", "postcss", "tailwindcss", "autoprefixer", "browserslist"]);
      for (const key of Object.keys(deps)) {
        if (NODE_ONLY.has(key) || key.startsWith("@types/")) delete deps[key];
      }
      return deps;
    } catch { return {}; }
  }, [project.files]);

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
          (isFastAPIProject || isMobileProject) ? (
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
          ) : (
            <SandpackProvider
              key={`sandpack-${Object.keys(sandpackFiles).length}-${snapshotVersion}`}
              template="react-ts"
              files={sandpackFiles}
              theme={SANDPACK_THEME}
              customSetup={{
                dependencies: sandpackDeps,
              }}
              options={{
                recompileMode: "delayed",
                recompileDelay: 500,
                bundlerURL: "https://sandpack-bundler.codesandbox.io",
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
          )
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
