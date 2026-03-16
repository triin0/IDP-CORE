import { CheckCircle2, XCircle } from "lucide-react";
import type { GoldenPathCheck } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface GoldenPathProps {
  checks: GoldenPathCheck[];
}

export function GoldenPath({ checks }: GoldenPathProps) {
  if (!checks || checks.length === 0) return null;

  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;
  const allPassed = passedCount === totalCount;

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider flex items-center">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
          Golden Path
        </h3>
        <div className={cn(
          "text-[10px] font-mono px-1.5 py-0.5 rounded border font-bold",
          allPassed
            ? "bg-success/10 text-success border-success/20"
            : "bg-destructive/10 text-destructive border-destructive/20"
        )}>
          {passedCount}/{totalCount} PASSED
        </div>
      </div>

      <div className="space-y-1">
        {checks.map((check, i) => (
          <div
            key={i}
            className={cn(
              "p-2 rounded-lg border flex items-start gap-2 transition-colors",
              check.passed
                ? "bg-success/5 border-success/10"
                : "bg-destructive/5 border-destructive/10"
            )}
          >
            <div className="mt-0.5 shrink-0">
              {check.passed
                ? <CheckCircle2 className="w-3.5 h-3.5 text-success drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                : <XCircle className="w-3.5 h-3.5 text-destructive drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
              }
            </div>
            <div className="min-w-0">
              <div className={cn(
                "text-xs font-semibold font-mono",
                check.passed ? "text-zinc-200" : "text-destructive"
              )}>
                {check.name}
              </div>
              {check.description && (
                <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
                  {check.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
