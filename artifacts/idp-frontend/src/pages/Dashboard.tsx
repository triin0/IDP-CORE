import { useListProjects } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Plus, FolderCode, Rocket, Clock, AlertTriangle, Loader2, CheckCircle2, XCircle, FileCheck, LogIn, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";

const statusConfig: Record<string, { label: string; color: string; dot: string; icon: typeof Clock }> = {
  pending: { label: "PENDING", color: "text-yellow-500", dot: "bg-yellow-500", icon: Clock },
  planning: { label: "PLANNING", color: "text-violet-400", dot: "bg-violet-400", icon: Loader2 },
  planned: { label: "SPEC READY", color: "text-amber-400", dot: "bg-amber-400", icon: FileCheck },
  generating: { label: "GENERATING", color: "text-blue-400", dot: "bg-blue-400", icon: Loader2 },
  validating: { label: "VALIDATING", color: "text-amber-400", dot: "bg-amber-400", icon: Loader2 },
  ready: { label: "READY", color: "text-emerald-400", dot: "bg-emerald-400", icon: CheckCircle2 },
  deployed: { label: "DEPLOYED", color: "text-primary", dot: "bg-primary", icon: Rocket },
  failed: { label: "FAILED", color: "text-destructive", dot: "bg-destructive", icon: XCircle },
  failed_checks: { label: "CHECKS FAILED", color: "text-red-400", dot: "bg-red-400", icon: AlertTriangle },
  failed_validation: { label: "VALIDATION FAILED", color: "text-red-400", dot: "bg-red-400", icon: AlertTriangle },
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
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-zinc-800/30 mb-6 ring-1 ring-zinc-700/50">
            <LogIn className="w-10 h-10 text-zinc-600" />
          </div>
          <h2 className="text-xl font-mono text-zinc-300 mb-2">AUTHENTICATION_REQUIRED</h2>
          <p className="text-sm text-zinc-600 mb-8 max-w-sm">
            Sign in with your Replit account to access the project registry.
          </p>
          <button
            onClick={login}
            className="px-8 py-3 bg-primary text-primary-foreground font-mono text-sm font-medium rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all duration-300"
          >
            LOGIN
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 font-mono tracking-tight">Projects</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {data ? `${data.total} project${data.total === 1 ? "" : "s"} in registry` : "Loading..."}
          </p>
        </div>
        <button
          onClick={() => navigate("/new")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-medium bg-primary text-primary-foreground shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all duration-300"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </motion.div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-destructive/60 mx-auto mb-4" />
            <h2 className="text-lg font-mono text-destructive mb-2">CONNECTION_ERROR</h2>
            <p className="text-sm text-zinc-600 mb-6">Failed to reach the API server.</p>
          </div>
        </div>
      )}

      {data && data.projects.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-zinc-800/30 mb-6 ring-1 ring-zinc-700/50">
              <FolderCode className="w-10 h-10 text-zinc-600" />
            </div>
            <h2 className="text-lg font-mono text-zinc-300 mb-2">No projects yet</h2>
            <p className="text-sm text-zinc-600 mb-8 max-w-sm">
              Generate your first application from a single prompt.
            </p>
            <button
              onClick={() => navigate("/new")}
              className="px-8 py-3 bg-primary text-primary-foreground font-mono text-sm font-medium rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all duration-300"
            >
              Create Project
            </button>
          </motion.div>
        </div>
      )}

      {data && data.projects.length > 0 && (
        <div className="grid gap-3">
          {data.projects.map((project, index) => {
            const effectiveStatus =
              project.status === "deployed" && !project.deployUrl
                ? "ready"
                : project.status;
            const config = statusConfig[effectiveStatus] || statusConfig.pending;
            const isActive = effectiveStatus === "generating" || effectiveStatus === "planning" || effectiveStatus === "validating";
            const timeAgo = formatDistanceToNow(new Date(project.createdAt), { addSuffix: true });

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => navigate(`/project/${project.id}`)}
                className="group cursor-pointer glass-panel-hover rounded-xl p-5 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.05)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-2 w-2">
                          {isActive && (
                            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-60", config.dot)} />
                          )}
                          <span className={cn("relative inline-flex rounded-full h-2 w-2", config.dot)} />
                        </div>
                        <span className={cn("text-[10px] font-mono font-bold uppercase tracking-wider", config.color)}>
                          {config.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-700">
                        {project.id.split("-")[0]}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 font-mono truncate group-hover:text-zinc-200 transition-colors">
                      {project.prompt}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 text-[11px] font-mono text-zinc-600 shrink-0">
                    {project.fileCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <FolderCode className="w-3.5 h-3.5" />
                        <span>{project.fileCount}</span>
                      </div>
                    )}
                    {project.goldenPathScore !== "0/0" && (
                      <div className={cn(
                        "flex items-center gap-1.5",
                        (() => {
                          const [passed, total] = project.goldenPathScore.split("/");
                          return passed === total ? "text-emerald-500/70" : "text-yellow-500/70";
                        })()
                      )}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{project.goldenPathScore}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-zinc-600">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timeAgo}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-primary transition-colors" />
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
