import { useState } from "react";
import { useGetProject } from "@workspace/api-client-react";
import { PromptForm } from "@/components/PromptForm";
import { StatusTerminal } from "@/components/StatusTerminal";
import { Workspace } from "@/components/Workspace";
import { AlertCircle } from "lucide-react";

export function Home() {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const { data: project, isError, error } = useGetProject(
    activeProjectId || "", 
    {
      query: {
        enabled: !!activeProjectId,
        // Poll every 2 seconds if generating or pending
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          return (status === "pending" || status === "generating") ? 2000 : false;
        }
      }
    }
  );

  return (
    <div className="flex-1 flex flex-col">
      {!activeProjectId && (
        <div className="flex-1 flex items-center justify-center py-12">
          <PromptForm onProjectCreated={setActiveProjectId} />
        </div>
      )}

      {activeProjectId && project && (project.status === "pending" || project.status === "generating") && (
        <div className="flex-1 py-12 px-4">
          <StatusTerminal status={project.status} />
        </div>
      )}

      {activeProjectId && project && (project.status === "ready" || project.status === "deployed") && (
        <div className="flex-1 py-4">
          <Workspace project={project} />
        </div>
      )}

      {/* Error States */}
      {(isError || project?.status === "failed") && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-xl w-full p-6 bg-destructive/10 border border-destructive/30 rounded-xl text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-mono font-semibold text-destructive mb-2">GENERATION_FAILED</h2>
            <p className="text-zinc-400 font-mono text-sm mb-6">
              {project?.error || "An unexpected error occurred during the generation sequence."}
            </p>
            <button 
              onClick={() => setActiveProjectId(null)}
              className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-mono text-sm rounded-lg border border-border transition-colors"
            >
              RESET_SEQUENCE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
