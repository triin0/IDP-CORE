import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Hash, Package, Hammer, FileCheck, Shield, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { decryptError } from "@/lib/error-decryptor";

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

interface BuildGateProps {
  verdict?: VerificationVerdictData | null;
  isValidating: boolean;
  status: string;
  onDeploy?: () => void;
  isDeploying?: boolean;
  deployUrl?: string | null;
}

const GATE_CONFIG = [
  { key: "golden_path", label: "Golden Path Compliance", icon: FileCheck, color: "text-violet-400" },
  { key: "dependencies", label: "Dependency Audit", icon: Package, color: "text-blue-400" },
  { key: "build", label: "Build Verification", icon: Hammer, color: "text-amber-400" },
  { key: "hash_integrity", label: "SHA-256 Hash Integrity", icon: Hash, color: "text-cyan-400" },
  { key: "security", label: "Security Review", icon: Shield, color: "text-emerald-400" },
];

function deriveGateStatus(verdict: VerificationVerdictData | null | undefined, key: string): "pass" | "fail" | "pending" {
  if (!verdict) return "pending";

  switch (key) {
    case "golden_path":
      return verdict.failureCategory !== "golden_path_violation" ? "pass" : "fail";
    case "dependencies":
      return verdict.dependencyErrors.length === 0 && verdict.failureCategory !== "dependency_hallucination" && verdict.failureCategory !== "dependency_vulnerability" ? "pass" : "fail";
    case "build":
      return (verdict.buildPassed ?? !verdict.buildStderr) && verdict.failureCategory !== "build_failure" ? "pass" : "fail";
    case "hash_integrity":
      return verdict.failureCategory !== "hash_integrity" ? "pass" : "fail";
    case "security": {
      const secChecks = verdict.checks.filter(c => c.category === "security");
      return secChecks.length === 0 || secChecks.every(c => c.passed) ? "pass" : "fail";
    }
    default:
      return "pending";
  }
}

export function BuildGate({ verdict, isValidating, status }: BuildGateProps) {
  const allPassed = verdict?.passed === true;
  const hasVerdict = !!verdict;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2 px-1 mb-2">
        <ShieldCheck className={cn(
          "w-4 h-4",
          isValidating ? "text-amber-400 animate-pulse" :
          allPassed ? "text-green-400" :
          hasVerdict ? "text-red-400" :
          "text-zinc-600",
        )} />
        <span className="font-mono text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Verification Gate
        </span>
        {allPassed && (
          <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
            ALL GATES PASSED
          </span>
        )}
        {hasVerdict && !allPassed && (
          <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            BLOCKED
          </span>
        )}
      </div>

      <div className="space-y-1">
        {GATE_CONFIG.map((gate, i) => {
          const gateStatus = isValidating ? "pending" : deriveGateStatus(verdict, gate.key);
          const Icon = gate.icon;

          return (
            <motion.div
              key={gate.key}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md border text-xs font-mono transition-all",
                gateStatus === "pass" && "border-green-500/20 bg-green-500/5",
                gateStatus === "fail" && "border-red-500/20 bg-red-500/5",
                gateStatus === "pending" && "border-zinc-800 bg-zinc-900/30",
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", gate.color)} />
              <span className={cn(
                "flex-1",
                gateStatus === "pass" && "text-green-400/80",
                gateStatus === "fail" && "text-red-400/80",
                gateStatus === "pending" && "text-zinc-500",
              )}>
                {gate.label}
              </span>
              {gateStatus === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              {gateStatus === "fail" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
              {gateStatus === "pending" && isValidating && <Loader2 className="w-3.5 h-3.5 text-zinc-600 animate-spin" />}
              {gateStatus === "pending" && !isValidating && <div className="w-3.5 h-3.5 rounded-full border border-zinc-700" />}
            </motion.div>
          );
        })}
      </div>

      {verdict?.buildStderr && (() => {
        const decoded = decryptError(verdict.buildStderr);
        return (
          <details className="group mt-2">
            <summary className="flex items-center gap-2 text-[10px] font-mono text-red-400/70 cursor-pointer hover:text-red-400 transition-colors">
              <AlertTriangle className="w-3 h-3" />
              Build stderr ({verdict.buildStderr.split("\n").length} lines)
            </summary>
            <div className="mt-1 p-2 rounded border border-amber-500/20 bg-amber-500/5 text-xs text-zinc-300">
              <span className="mr-1">{decoded.emoji}</span>
              {decoded.friendly}
            </div>
            <pre className="mt-1 p-2 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-500 max-h-24 overflow-y-auto whitespace-pre-wrap">
              {verdict.buildStderr}
            </pre>
          </details>
        );
      })()}

      {verdict?.dependencyErrors && verdict.dependencyErrors.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 text-[10px] font-mono text-amber-400/70 cursor-pointer hover:text-amber-400 transition-colors">
            <Package className="w-3 h-3" />
            Dependency issues ({verdict.dependencyErrors.length})
          </summary>
          <div className="mt-1 space-y-1">
            {verdict.dependencyErrors.map((err, i) => (
              <div key={i} className="p-1.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-amber-400/60">
                {err}
              </div>
            ))}
          </div>
        </details>
      )}
    </motion.div>
  );
}
