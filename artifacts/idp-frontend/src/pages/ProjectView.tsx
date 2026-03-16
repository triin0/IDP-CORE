import { useGetProject } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Workspace } from "@/components/Workspace";
import { SpecReview } from "@/components/SpecReview";
import { AlertCircle, Loader2, WifiOff } from "lucide-react";
import { motion } from "framer-motion";

function isApiError(err: unknown): err is { name: string; status: number } {
  return err !== null && typeof err === "object" && "name" in err && (err as { name: string }).name === "ApiError" && "status" in err;
}

function PlanningSpinner() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex items-center justify-center"
    >
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-mono font-semibold text-zinc-200 mb-1">GENERATING_SPEC</h2>
        <p className="text-xs font-mono text-zinc-500">Analyzing your prompt and designing the architecture...</p>
      </div>
    </motion.div>
  );
}

export function ProjectView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const projectId = params.id || "";

  const { data: project, isLoading, isError, error } = useGetProject(
    projectId,
    {
      query: {
        queryKey: [`/api/projects/${projectId}`],
        enabled: !!projectId,
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          return (status === "pending" || status === "planning" || status === "generating") ? 2000 : false;
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

  if (isError) {
    const is404 = isApiError(error) && error.status === 404;
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          {is404 ? (
            <>
              <AlertCircle className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
              <h2 className="text-lg font-mono font-semibold text-zinc-300 mb-2">PROJECT_NOT_FOUND</h2>
              <p className="text-sm text-zinc-500 font-mono mb-6">No project exists with this ID.</p>
            </>
          ) : (
            <>
              <WifiOff className="w-12 h-12 text-destructive/60 mx-auto mb-4" />
              <h2 className="text-lg font-mono font-semibold text-destructive mb-2">CONNECTION_ERROR</h2>
              <p className="text-sm text-zinc-500 font-mono mb-6">Failed to reach the API server. Please try again.</p>
            </>
          )}
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-secondary text-foreground font-mono text-sm rounded-lg border border-border hover:bg-secondary/80 transition-colors"
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  if (project.status === "pending" || project.status === "planning") {
    return <PlanningSpinner />;
  }

  if (project.status === "planned" && project.spec) {
    return (
      <SpecReview
        projectId={project.id}
        prompt={project.prompt}
        spec={project.spec}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Workspace project={project} onReset={() => navigate("/")} />
    </div>
  );
}
