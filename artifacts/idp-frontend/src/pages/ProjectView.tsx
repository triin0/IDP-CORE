import { useGetProject, getGetProjectQueryOptions } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { StatusTerminal } from "@/components/StatusTerminal";
import { Workspace } from "@/components/Workspace";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

export function ProjectView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const projectId = params.id || "";

  const queryOptions = getGetProjectQueryOptions(projectId);
  const { data: project, isLoading, isError } = useGetProject(
    projectId,
    {
      query: {
        ...queryOptions,
        enabled: !!projectId,
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          return (status === "pending" || status === "generating") ? 2000 : false;
        }
      }
    }
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {project && (project.status === "pending" || project.status === "generating") && (
        <div className="flex-1 py-12 px-4">
          <StatusTerminal status={project.status} />
        </div>
      )}

      {project && (project.status === "ready" || project.status === "deployed") && (
        <div className="flex-1 py-4">
          <Workspace project={project} />
        </div>
      )}

      {(isError || project?.status === "failed") && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-xl w-full p-6 bg-destructive/10 border border-destructive/30 rounded-xl text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-mono font-semibold text-destructive mb-2">GENERATION_FAILED</h2>
            <p className="text-zinc-400 font-mono text-sm mb-6">
              {project?.error || "An unexpected error occurred during the generation sequence."}
            </p>
            <button 
              onClick={() => navigate("/")}
              className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-mono text-sm rounded-lg border border-border transition-colors"
            >
              <ArrowLeft className="w-4 h-4 inline mr-2" />
              BACK_TO_DASHBOARD
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
