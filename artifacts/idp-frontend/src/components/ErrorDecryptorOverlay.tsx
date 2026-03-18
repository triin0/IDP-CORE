import { useSandpackErrorWatcher } from "@/hooks/useSandpackErrorWatcher";
import { Loader2, Wrench, X, AlertTriangle, FileCode, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ErrorDecryptorOverlayProps {
  projectId: string;
  onFixApplied: () => void;
}

export function ErrorDecryptorOverlay({ projectId, onFixApplied }: ErrorDecryptorOverlayProps) {
  const {
    decryptedResult,
    isDecrypting,
    dismissError,
    applyFix,
    sandpackError,
  } = useSandpackErrorWatcher(projectId);

  const showOverlay = isDecrypting || decryptedResult;

  if (!showOverlay) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute bottom-0 left-0 right-0 z-40 mx-2 mb-2"
      >
        <div className="rounded-lg border border-amber-500/30 bg-zinc-950/95 backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.1)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
                Error Decryptor
              </span>
            </div>
            <button
              onClick={dismissError}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-3 py-2.5 space-y-2">
            {isDecrypting && !decryptedResult && (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span className="font-mono">Analyzing error...</span>
              </div>
            )}

            {decryptedResult && (
              <>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {decryptedResult.explanation}
                  </p>
                </div>

                {decryptedResult.rootCause && (
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                    <FileCode className="w-3 h-3" />
                    <span>{decryptedResult.rootCause.path}</span>
                    {decryptedResult.rootCause.line && (
                      <span className="text-amber-400/60">:{decryptedResult.rootCause.line}</span>
                    )}
                  </div>
                )}

                {sandpackError && (
                  <details className="group">
                    <summary className="text-[10px] font-mono text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors">
                      Raw error
                    </summary>
                    <div className="mt-1 p-2 rounded bg-zinc-900 border border-zinc-800 max-h-16 overflow-y-auto">
                      <pre className="text-[10px] font-mono text-zinc-500 whitespace-pre-wrap break-words">
                        {sandpackError.message}
                      </pre>
                    </div>
                  </details>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {decryptedResult.fixes && decryptedResult.fixes.length > 0 && (
                    <button
                      onClick={() => applyFix(onFixApplied)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all",
                        "bg-amber-500/10 text-amber-400 border border-amber-500/30",
                        "hover:bg-amber-500/20 hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]",
                      )}
                    >
                      <Wrench className="w-3 h-3" />
                      Fix Issue
                    </button>
                  )}
                  <button
                    onClick={dismissError}
                    className="px-3 py-1.5 rounded-md text-xs font-mono text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    Dismiss
                  </button>
                  {decryptedResult.fixes && decryptedResult.fixes.length > 0 && (
                    <span className="text-[10px] font-mono text-zinc-600 ml-auto">
                      {decryptedResult.fixes.length} file{decryptedResult.fixes.length > 1 ? "s" : ""} to patch
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
