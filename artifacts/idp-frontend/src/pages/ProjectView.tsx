import { useGetProject } from "@workspace/api-client-react";
import { useRegenerateSpec } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Workspace } from "@/components/Workspace";
import { SpecReview } from "@/components/SpecReview";
import { StatusTerminal } from "@/components/StatusTerminal";
import { AlertCircle, Loader2, WifiOff, ShieldAlert, XCircle, AlertTriangle, RefreshCw, CheckCircle2, Hash, FileWarning } from "lucide-react";
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

interface GoldenPathCheckResult {
  name: string;
  passed: boolean;
  description: string;
  critical?: boolean;
}

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
    status: "match" | "mismatch" | "missing" | "unexpected";
    currentHash?: string;
    expectedHash?: string;
  }>;
  buildStderr?: string;
  dependencyErrors: string[];
  recommendedFixes: string[];
}

function CheckFailurePanel({
  checks,
  error,
  projectId,
  onRetry,
}: {
  checks: GoldenPathCheckResult[];
  error?: string | null;
  projectId: string;
  onRetry: () => void;
}) {
  const failedChecks = checks.filter((c) => !c.passed);
  const criticalFailed = failedChecks.filter((c) => c.critical);
  const nonCriticalFailed = failedChecks.filter((c) => !c.critical);
  const passedChecks = checks.filter((c) => c.passed);
  const regenerateSpec = useRegenerateSpec();
  const [, navigate] = useLocation();

  const handleRegenerate = () => {
    regenerateSpec.mutate(
      { id: projectId },
      {
        onSuccess: () => {
          onRetry();
        },
      },
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex items-center justify-center py-8"
    >
      <div className="w-full max-w-2xl mx-auto">
        <div className="rounded-xl bg-card border border-red-500/30 shadow-2xl overflow-hidden">
          <div className="px-6 py-4 bg-red-500/10 border-b border-red-500/20 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            <div>
              <h2 className="text-lg font-mono font-bold text-red-400">QUALITY_GATE_BLOCKED</h2>
              <p className="text-xs font-mono text-red-400/70 mt-0.5">
                {criticalFailed.length} critical check{criticalFailed.length !== 1 ? "s" : ""} failed — project cannot proceed
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm font-mono text-red-300">
                {error}
              </div>
            )}

            {criticalFailed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-semibold text-red-400 uppercase tracking-wider">
                  Critical Failures (Blocking)
                </h3>
                {criticalFailed.map((check) => (
                  <div
                    key={check.name}
                    className="p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="font-mono text-sm font-semibold text-red-300">{check.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase">critical</span>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono ml-6">{check.description}</p>
                  </div>
                ))}
              </div>
            )}

            {nonCriticalFailed.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
                  Non-Critical Failures (Warnings)
                </h3>
                {nonCriticalFailed.map((check) => (
                  <div
                    key={check.name}
                    className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="font-mono text-sm font-semibold text-amber-300">{check.name}</span>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono ml-6">{check.description}</p>
                  </div>
                ))}
              </div>
            )}

            {passedChecks.length > 0 && (
              <details className="group">
                <summary className="text-xs font-mono font-semibold text-green-400 uppercase tracking-wider cursor-pointer hover:text-green-300 transition-colors">
                  Passed Checks ({passedChecks.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {passedChecks.map((check) => (
                    <div
                      key={check.name}
                      className="flex items-center gap-2 p-2 rounded text-xs font-mono text-zinc-500"
                    >
                      <span className="text-green-500">✓</span>
                      <span>{check.name}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                What You Can Do
              </h3>
              <ul className="text-xs text-zinc-500 font-mono space-y-1 list-disc list-inside">
                <li>Regenerate from the spec to try generating compliant code</li>
                <li>Adjust the prompt to be more specific about security requirements</li>
                <li>Review the project files to understand what was generated</li>
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerateSpec.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${regenerateSpec.isPending ? "animate-spin" : ""}`} />
                  {regenerateSpec.isPending ? "Regenerating..." : "Regenerate Project"}
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 bg-secondary text-foreground font-mono text-sm rounded-lg border border-border hover:bg-secondary/80 transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function VerificationFailurePanel({
  verdict,
  checks,
  error,
  projectId,
  onRetry,
}: {
  verdict?: VerificationVerdictData;
  checks: GoldenPathCheckResult[];
  error?: string | null;
  projectId: string;
  onRetry: () => void;
}) {
  const regenerateSpec = useRegenerateSpec();
  const [, navigate] = useLocation();

  const handleRegenerate = () => {
    regenerateSpec.mutate(
      { id: projectId },
      { onSuccess: () => { onRetry(); } },
    );
  };

  const failedVerdictChecks = verdict?.checks.filter((c) => !c.passed) ?? [];
  const passedVerdictChecks = verdict?.checks.filter((c) => c.passed) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex items-center justify-center py-8"
    >
      <div className="w-full max-w-3xl mx-auto">
        <div className="rounded-xl bg-card border border-red-500/30 shadow-2xl overflow-hidden">
          <div className="px-6 py-4 bg-red-500/10 border-b border-red-500/20 flex items-center gap-3">
            <FileWarning className="w-6 h-6 text-red-400" />
            <div>
              <h2 className="text-lg font-mono font-bold text-red-400">VERIFICATION_FAILED</h2>
              <p className="text-xs font-mono text-red-400/70 mt-0.5">
                The Verification & Audit Agent blocked this project
                {verdict?.failureCategory && verdict.failureCategory !== "none" && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase text-[10px]">
                    {verdict.failureCategory.replace(/_/g, " ")}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm font-mono text-red-300">
                {error}
              </div>
            )}

            {verdict?.summary && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                  Verification Summary
                </h3>
                <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {verdict.summary}
                </div>
              </div>
            )}

            {failedVerdictChecks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-semibold text-red-400 uppercase tracking-wider">
                  Failed Checks ({failedVerdictChecks.length})
                </h3>
                {failedVerdictChecks.map((check, i) => (
                  <div
                    key={`${check.name}-${i}`}
                    className="p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="font-mono text-sm font-semibold text-red-300">{check.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 uppercase">{check.category}</span>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono ml-6">{check.description}</p>
                  </div>
                ))}
              </div>
            )}

            {verdict?.hashAudit && verdict.hashAudit.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5" />
                  SHA-256 Hash Audit
                </h3>
                <div className="space-y-1">
                  {verdict.hashAudit.map((h, i) => (
                    <div
                      key={`${h.path}-${i}`}
                      className={`flex items-center gap-2 p-2 rounded text-xs font-mono ${
                        h.status === "match" ? "text-green-400/80" :
                        h.status === "mismatch" ? "text-red-400/80" :
                        h.status === "missing" ? "text-amber-400/80" :
                        "text-zinc-500"
                      }`}
                    >
                      {h.status === "match" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      {h.status === "mismatch" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      {h.status === "missing" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                      {h.status === "unexpected" && <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />}
                      <span>{h.path}</span>
                      <span className="text-zinc-600">({h.status})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verdict?.dependencyErrors && verdict.dependencyErrors.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
                  Dependency Issues ({verdict.dependencyErrors.length})
                </h3>
                <div className="space-y-1">
                  {verdict.dependencyErrors.map((err, i) => (
                    <div key={i} className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs font-mono text-amber-300">
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verdict?.buildStderr && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-semibold text-red-400 uppercase tracking-wider">
                  Build Output
                </h3>
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-400 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {verdict.buildStderr}
                </pre>
              </div>
            )}

            {passedVerdictChecks.length > 0 && (
              <details className="group">
                <summary className="text-xs font-mono font-semibold text-green-400 uppercase tracking-wider cursor-pointer hover:text-green-300 transition-colors">
                  Passed Checks ({passedVerdictChecks.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {passedVerdictChecks.map((check, i) => (
                    <div
                      key={`${check.name}-${i}`}
                      className="flex items-center gap-2 p-2 rounded text-xs font-mono text-zinc-500"
                    >
                      <span className="text-green-500">✓</span>
                      <span>{check.name}</span>
                      <span className="text-zinc-600">({check.category})</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {verdict?.recommendedFixes && verdict.recommendedFixes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                  Recommended Fixes
                </h3>
                <ul className="text-xs text-zinc-500 font-mono space-y-1 list-disc list-inside">
                  {verdict.recommendedFixes.map((fix, i) => (
                    <li key={i}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerateSpec.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${regenerateSpec.isPending ? "animate-spin" : ""}`} />
                  {regenerateSpec.isPending ? "Regenerating..." : "Regenerate Project"}
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 bg-secondary text-foreground font-mono text-sm rounded-lg border border-border hover:bg-secondary/80 transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ProjectView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const projectId = params.id || "";

  const { data: project, isLoading, isError, error, refetch } = useGetProject(
    projectId,
    {
      query: {
        queryKey: [`/api/projects/${projectId}`],
        enabled: !!projectId,
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          return (status === "pending" || status === "planning" || status === "generating" || status === "validating") ? 2000 : false;
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

  if (project.status === "generating" || project.status === "validating") {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <StatusTerminal
          status={project.status}
          pipelineStatus={project.pipelineStatus ?? undefined}
        />
      </div>
    );
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

  if (project.status === "failed_checks") {
    return (
      <CheckFailurePanel
        checks={(project.goldenPathChecks ?? []) as GoldenPathCheckResult[]}
        error={project.error}
        projectId={project.id}
        onRetry={() => refetch()}
      />
    );
  }

  if (project.status === "failed_validation") {
    return (
      <VerificationFailurePanel
        verdict={(project as unknown as { verificationVerdict?: VerificationVerdictData }).verificationVerdict}
        checks={(project.goldenPathChecks ?? []) as GoldenPathCheckResult[]}
        error={project.error}
        projectId={project.id}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Workspace project={project} onReset={() => navigate("/")} />
    </div>
  );
}
