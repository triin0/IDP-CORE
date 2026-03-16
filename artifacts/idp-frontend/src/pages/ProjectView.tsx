import { useGetProject } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Workspace } from "@/components/Workspace";
import { Loader2 } from "lucide-react";

export function ProjectView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const projectId = params.id || "";

  const { data: project, isLoading } = useGetProject(
    projectId,
    {
      query: {
        queryKey: [`/api/projects/${projectId}`],
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

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 font-mono text-sm mb-4">Project not found</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-secondary text-foreground font-mono text-sm rounded-lg border border-border"
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Workspace project={project} onReset={() => navigate("/")} />
    </div>
  );
}
