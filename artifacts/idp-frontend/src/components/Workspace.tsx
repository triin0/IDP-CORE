import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDeployProject, useDeleteProject } from "@workspace/api-client-react";
import type { ProjectDetails } from "@workspace/api-client-react";
import { FileTree } from "./FileTree";
import { CodeViewer } from "./CodeViewer";
import { GoldenPath } from "./GoldenPath";
import { RefinementChat } from "./RefinementChat";
import { BuildGate } from "./BuildGate";
import { SandboxPreview } from "./SandboxPreview";
import { Rocket, ExternalLink, Loader2, Code2, ArrowLeft, CheckCircle2, AlertCircle, Zap, ShieldCheck, Hash, Eye, FileCode, Download, Github, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

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
                <div className="text-xs text-zinc-500 mt-1">{project.error || "An unexpected error occurred"}</div>
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
    <div className="border-t border-border/50 p-4 space-y-2">
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

export function Workspace({ project, onReset }: WorkspaceProps) {
  const [activeFile, setActiveFile] = useState<string | null>(
    project.files.length > 0 ? project.files[0].path : null
  );
  const [rightPanel, setRightPanel] = useState<"status" | "preview">("status");
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!activeFile && project.files.length > 0) {
      setActiveFile(project.files[0].path);
    }
  }, [activeFile, project.files]);

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
  const activeContent = project.files.find((f: { path: string; content: string }) => f.path === activeFile)?.content || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[calc(100vh-60px)] w-full max-w-[1600px] mx-auto p-4 flex flex-col"
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
              Generated Artifact
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                ID: {project.id.split("-")[0]}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 font-mono truncate max-w-lg">
              {project.prompt}
            </p>
          </div>
        </div>

        {liveUrl && (
          <div className="flex items-center gap-1 bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
            <button
              onClick={() => setRightPanel("status")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                rightPanel === "status" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <FileCode className="w-3 h-3" />
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
          </div>
        )}
      </div>

      <div className="flex-1 bg-card border border-border shadow-2xl rounded-xl overflow-hidden flex min-h-0">
        <div className="w-64 border-r border-border flex flex-col bg-zinc-950/50">
          <div className="px-4 py-2 text-xs font-mono font-semibold text-zinc-500 border-b border-border/50 uppercase tracking-wider bg-card">
            Explorer
          </div>
          {project.files.length > 0 ? (
            <FileTree
              files={project.files}
              activeFile={activeFile}
              onSelectFile={setActiveFile}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs font-mono text-zinc-600 text-center">
                Files will appear here once generation completes
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden relative bg-zinc-950">
            <CodeViewer content={activeContent} path={activeFile || ""} />
          </div>
          {(project.status === "ready" || project.status === "deployed") && (
            <RefinementChat
              projectId={project.id}
              refinements={project.refinements ?? []}
              projectFiles={(project.files ?? []) as Array<{ path: string; content: string }>}
            />
          )}
        </div>

        <div className="w-72 border-l border-border bg-zinc-950/50">
          {rightPanel === "status" ? (
            <StatusPanel
              project={project}
              onDeploy={handleDeploy}
              isDeploying={deployMut.isPending}
              deployUrl={deployMut.data?.deployUrl || null}
              deployError={deployMut.isError}
              onDelete={handleDelete}
              isDeleting={deleteMut.isPending}
            />
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-4 py-2 text-xs font-mono font-semibold text-zinc-500 border-b border-border/50 uppercase tracking-wider bg-card">
                Live Preview
              </div>
              <div className="flex-1 p-2">
                <SandboxPreview deployUrl={liveUrl} status={project.status} />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
