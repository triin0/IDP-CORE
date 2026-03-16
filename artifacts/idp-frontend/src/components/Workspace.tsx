import { useState } from "react";
import { useDeployProject } from "@workspace/api-client-react";
import type { ProjectDetails } from "@workspace/api-client-react/src/generated/api.schemas";
import { FileTree } from "./FileTree";
import { CodeViewer } from "./CodeViewer";
import { GoldenPath } from "./GoldenPath";
import { Rocket, ExternalLink, Loader2, Code2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface WorkspaceProps {
  project: ProjectDetails;
}

export function Workspace({ project }: WorkspaceProps) {
  const [activeFile, setActiveFile] = useState<string | null>(
    project.files.length > 0 ? project.files[0].path : null
  );
  
  const deployMut = useDeployProject();
  
  const handleDeploy = () => {
    deployMut.mutate({ id: project.id });
  };

  const activeContent = project.files.find(f => f.path === activeFile)?.content || "";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[calc(100vh-100px)] w-full max-w-[1600px] mx-auto p-4"
    >
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg ring-1 ring-primary/30">
            <Code2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center">
              Generated Artifact
              <span className="ml-3 px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                ID: {project.id.split('-')[0]}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 font-mono truncate max-w-xl">
              {project.prompt}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {project.deployUrl || deployMut.data?.deployUrl ? (
            <a 
              href={project.deployUrl || deployMut.data?.deployUrl} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center px-4 py-2 rounded-lg font-mono text-sm font-medium bg-success/10 text-success border border-success/30 hover:bg-success/20 transition-all shadow-[0_0_15px_rgba(74,222,128,0.15)]"
            >
              LIVE PREVIEW <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={deployMut.isPending || project.status === 'deployed'}
              className={cn(
                "flex items-center px-5 py-2 rounded-lg font-mono text-sm font-medium transition-all duration-300",
                deployMut.isPending 
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                  : "bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
              )}
            >
              {deployMut.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> DEPLOYING...</>
              ) : (
                <><Rocket className="w-4 h-4 mr-2" /> DEPLOY TO PREVIEW</>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="h-[calc(100%-70px)] bg-card border border-border shadow-2xl rounded-xl overflow-hidden flex">
        {/* Sidebar */}
        <div className="w-72 border-r border-border flex flex-col bg-zinc-950/50">
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-2 text-xs font-mono font-semibold text-zinc-500 border-b border-border/50 uppercase tracking-wider bg-card sticky top-0">
              Explorer
            </div>
            <FileTree 
              files={project.files} 
              activeFile={activeFile} 
              onSelectFile={setActiveFile} 
            />
          </div>
          
          <GoldenPath checks={project.goldenPathChecks || []} />
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-hidden relative bg-zinc-950">
          <CodeViewer content={activeContent} path={activeFile || ""} />
        </div>
      </div>
    </motion.div>
  );
}
