import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDeployProject } from "@workspace/api-client-react";
import type { ProjectDetails } from "@workspace/api-client-react";
import { FileTree } from "./FileTree";
import { CodeViewer } from "./CodeViewer";
import { GoldenPath } from "./GoldenPath";
import { RefinementChat } from "./RefinementChat";
import { Rocket, ExternalLink, Loader2, Code2, ArrowLeft, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface WorkspaceProps {
  project: ProjectDetails;
  onReset?: () => void;
}

function StatusPanel({ project, onDeploy, isDeploying, deployUrl, deployError }: {
  project: ProjectDetails;
  onDeploy: () => void;
  isDeploying: boolean;
  deployUrl: string | null;
  deployError: boolean;
}) {
  const isGenerating = project.status === "pending" || project.status === "generating";
  const isReady = project.status === "ready" || project.status === "deployed";
  const isFailed = project.status === "failed";
  const liveUrl = deployUrl || project.deployUrl;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 text-xs font-mono font-semibold text-zinc-500 border-b border-border/50 uppercase tracking-wider bg-card">
        Status
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        <div className={cn(
          "p-3 rounded-lg border flex items-start gap-3",
          isGenerating && "bg-blue-400/5 border-blue-400/20",
          isReady && "bg-success/5 border-success/20",
          isFailed && "bg-destructive/5 border-destructive/20",
        )}>
          {isGenerating && (
            <>
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-mono font-semibold text-blue-400">GENERATING</div>
                <div className="text-xs text-zinc-500 mt-1">AI is building your application following Golden Path standards...</div>
              </div>
            </>
          )}
          {isReady && (
            <>
              <CheckCircle2 className="w-5 h-5 text-success mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-mono font-semibold text-success">
                  {project.status === "deployed" ? "DEPLOYED" : "READY"}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {project.files.length} files generated and validated
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

        {isGenerating && (
          <GenerationProgress />
        )}

        {project.goldenPathChecks && project.goldenPathChecks.length > 0 && (
          <GoldenPath checks={project.goldenPathChecks} />
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
          ) : isReady ? (
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
          ) : null}

          {deployError && (
            <div className="mt-2 p-2 rounded-lg border border-destructive/30 bg-destructive/10">
              <p className="text-xs font-mono text-destructive">DEPLOY_FAILED: Could not deploy project. Please try again.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GenerationProgress() {
  const steps = [
    "Analyzing architectural prompt...",
    "Generating system schemas...",
    "Writing database migrations...",
    "Scaffolding API routes...",
    "Implementing business logic...",
    "Running Golden Path compliance...",
  ];

  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= steps.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="space-y-1.5">
      {steps.slice(0, visibleCount).map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-xs font-mono text-zinc-500"
        >
          <span className="text-zinc-600">{(i + 1).toString().padStart(2, "0")}:</span>
          <span>{step}</span>
        </motion.div>
      ))}
      <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 animate-pulse">
        <span>{(visibleCount + 1).toString().padStart(2, "0")}:</span>
        <span className="flex items-center">Processing<span className="animate-cursor-blink bg-zinc-500 w-1.5 h-3.5 ml-1 inline-block"></span></span>
      </div>
    </div>
  );
}

export function Workspace({ project, onReset }: WorkspaceProps) {
  const [activeFile, setActiveFile] = useState<string | null>(
    project.files.length > 0 ? project.files[0].path : null
  );

  useEffect(() => {
    if (!activeFile && project.files.length > 0) {
      setActiveFile(project.files[0].path);
    }
  }, [activeFile, project.files]);

  const queryClient = useQueryClient();
  const deployMut = useDeployProject();

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
            />
          )}
        </div>

        <div className="w-72 border-l border-border bg-zinc-950/50">
          <StatusPanel
            project={project}
            onDeploy={handleDeploy}
            isDeploying={deployMut.isPending}
            deployUrl={deployMut.data?.deployUrl || null}
            deployError={deployMut.isError}
          />
        </div>
      </div>
    </motion.div>
  );
}
