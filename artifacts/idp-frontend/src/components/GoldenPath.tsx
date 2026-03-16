import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { GoldenPathCheck } from "@workspace/api-client-react/src/generated/api.schemas";
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
    <div className="border-t border-border/50 bg-secondary/10 flex flex-col h-64">
      <div className="px-4 py-3 border-b border-border/50 flex justify-between items-center bg-card sticky top-0">
        <h3 className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider flex items-center">
          <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-primary" />
          Golden Path Validation
        </h3>
        <div className={cn(
          "text-xs font-mono px-2 py-0.5 rounded border",
          allPassed 
            ? "bg-success/10 text-success border-success/20" 
            : "bg-destructive/10 text-destructive border-destructive/20"
        )}>
          {passedCount}/{totalCount} PASSED
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        <div className="space-y-1">
          {checks.map((check, i) => (
            <div 
              key={i} 
              className={cn(
                "p-3 rounded-lg border flex items-start space-x-3 transition-colors",
                check.passed 
                  ? "bg-success/5 border-success/10 hover:border-success/30" 
                  : "bg-destructive/5 border-destructive/10 hover:border-destructive/30"
              )}
            >
              <div className="mt-0.5">
                {check.passed 
                  ? <CheckCircle2 className="w-4 h-4 text-success drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" /> 
                  : <XCircle className="w-4 h-4 text-destructive drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
                }
              </div>
              <div>
                <div className={cn(
                  "text-sm font-semibold font-mono",
                  check.passed ? "text-zinc-200" : "text-destructive"
                )}>
                  {check.name}
                </div>
                {check.description && (
                  <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
                    {check.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
