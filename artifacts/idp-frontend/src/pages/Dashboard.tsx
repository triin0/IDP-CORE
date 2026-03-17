import { useListProjects } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Plus, FolderCode, Rocket, Clock, AlertTriangle, Loader2, CheckCircle2, XCircle, Lightbulb, FileCheck, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "PENDING", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20", icon: Clock },
  planning: { label: "PLANNING", color: "text-violet-400 bg-violet-400/10 border-violet-400/20", icon: Loader2 },
  planned: { label: "SPEC READY", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: FileCheck },
  generating: { label: "GENERATING", color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: Loader2 },
  validating: { label: "VALIDATING", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: Loader2 },
  ready: { label: "READY", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle2 },
  deployed: { label: "DEPLOYED", color: "text-primary bg-primary/10 border-primary/20", icon: Rocket },
  failed: { label: "FAILED", color: "text-destructive bg-destructive/10 border-destructive/20", icon: XCircle },
  failed_checks: { label: "CHECKS FAILED", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: AlertTriangle },
  failed_validation: { label: "VALIDATION FAILED", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: AlertTriangle },
};

export function Dashboard() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const projectsQuery = useListProjects(
    { limit: 50, offset: 0 },
    { query: { enabled: isAuthenticated } as never },
  );
  const data = isAuthenticated ? projectsQuery.data : undefined;
  const isLoading = authLoading || (isAuthenticated && projectsQuery.isLoading);
  const isError = isAuthenticated && projectsQuery.isError;

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center max-w-6xl mx-auto w-full px-6 py-8">
        <LogIn className="w-16 h-16 text-zinc-700 mb-4" />
        <h2 className="text-xl font-mono text-zinc-400 mb-2">SIGN_IN_REQUIRED</h2>
        <p className="text-sm text-zinc-600 font-mono mb-6">Log in with your Replit account to view and manage projects.</p>
        <button
          onClick={login}
          className="px-6 py-2.5 bg-primary text-primary-foreground font-mono text-sm rounded-lg hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all"
        >
          LOGIN
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 font-mono">PROJECT_REGISTRY</h1>
          <p className="text-sm text-zinc-500 font-mono mt-1">
            {data ? `${data.total} project${data.total === 1 ? "" : "s"} generated` : "Loading..."}
          </p>
        </div>
        <button
          onClick={() => navigate("/new")}
          className="flex items-center px-5 py-2.5 rounded-lg font-mono text-sm font-medium bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all"
        >
          <Plus className="w-4 h-4 mr-2" /> NEW_PROJECT
        </button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-destructive/60 mx-auto mb-4" />
            <h2 className="text-xl font-mono text-destructive mb-2">CONNECTION_ERROR</h2>
            <p className="text-sm text-zinc-600 font-mono mb-6">Failed to load projects. The API server may be unavailable.</p>
          </div>
        </div>
      )}

      {data && data.projects.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FolderCode className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl font-mono text-zinc-400 mb-2">NO_PROJECTS_FOUND</h2>
            <p className="text-sm text-zinc-600 font-mono mb-6">Generate your first application from a natural language prompt.</p>
            <button
              onClick={() => navigate("/new")}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-mono text-sm rounded-lg hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all"
            >
              CREATE_PROJECT
            </button>
          </div>
        </div>
      )}

      {data && data.projects.length > 0 && (
        <div className="grid gap-4">
          {data.projects.map((project, index) => {
            const effectiveStatus =
              project.status === "deployed" && !project.deployUrl
                ? "ready"
                : project.status;
            const config = statusConfig[effectiveStatus] || statusConfig.pending;
            const StatusIcon = config.icon;
            const timeAgo = formatDistanceToNow(new Date(project.createdAt), { addSuffix: true });

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/project/${project.id}`)}
                className="group cursor-pointer bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.08)] transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border", config.color)}>
                        <StatusIcon className={cn("w-3 h-3 inline mr-1", (effectiveStatus === "generating" || effectiveStatus === "planning" || effectiveStatus === "validating") && "animate-spin")} />
                        {config.label}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-600 uppercase">
                        ID: {project.id.split("-")[0]}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 font-mono truncate group-hover:text-zinc-100 transition-colors">
                      {project.prompt}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 shrink-0">
                    {project.fileCount > 0 && (
                      <div className="flex items-center gap-1">
                        <FolderCode className="w-3.5 h-3.5" />
                        <span>{project.fileCount} files</span>
                      </div>
                    )}
                    {project.goldenPathScore !== "0/0" && (
                      <div className={cn(
                        "flex items-center gap-1",
                        (() => {
                          const [passed, total] = project.goldenPathScore.split("/");
                          return passed === total ? "text-emerald-400" : "text-yellow-500";
                        })()
                      )}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{project.goldenPathScore}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timeAgo}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
