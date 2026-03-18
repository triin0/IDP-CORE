import { useState, useEffect, useRef, useCallback } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { extractErrorContext } from "@/lib/error-context-extractor";

const API_BASE = import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`;
const DEBOUNCE_MS = 1500;

interface DecryptedResult {
  explanation: string;
  rootCause: { path: string; line: number } | null;
  fixes: Array<{ path: string; content: string }> | null;
}

function hashError(message: string, path?: string): string {
  const raw = `${message}::${path || ""}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

export function useSandpackErrorWatcher(projectId: string) {
  const { sandpack } = useSandpack();
  const [decryptedResult, setDecryptedResult] = useState<DecryptedResult | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const lastErrorHashRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dismissedHashesRef = useRef<Set<string>>(new Set());

  const sandpackError = sandpack.error;

  useEffect(() => {
    if (!sandpackError) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      lastErrorHashRef.current = null;
      return;
    }

    const errorHash = hashError(sandpackError.message, sandpackError.path);

    if (errorHash === lastErrorHashRef.current) return;
    if (dismissedHashesRef.current.has(errorHash)) return;

    lastErrorHashRef.current = errorHash;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    debounceTimerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsDecrypting(true);
      setDecryptedResult(null);

      const { files: contextFiles } = extractErrorContext(
        sandpack.files,
        sandpackError.message,
        sandpackError.path,
      );

      fetch(`${API_BASE}/projects/${projectId}/decrypt-error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          error: {
            message: sandpackError.message,
            line: sandpackError.line,
            column: sandpackError.column,
            path: sandpackError.path,
          },
          files: contextFiles,
        }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: DecryptedResult) => {
          if (!controller.signal.aborted) {
            setDecryptedResult(data);
          }
        })
        .catch((err) => {
          if (err instanceof Error && err.name === "AbortError") return;
          console.error("[error-decryptor] Failed:", err);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsDecrypting(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [sandpackError?.message, sandpackError?.path, projectId, sandpack.files]);

  const dismissError = useCallback(() => {
    if (lastErrorHashRef.current) {
      dismissedHashesRef.current.add(lastErrorHashRef.current);
    }
    setDecryptedResult(null);
    setIsDecrypting(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const applyFix = useCallback(
    async (onSuccess: () => void) => {
      if (!decryptedResult?.fixes) return;

      if (lastErrorHashRef.current) {
        dismissedHashesRef.current.add(lastErrorHashRef.current);
      }

      const fixes = decryptedResult.fixes;
      setDecryptedResult(null);
      setIsDecrypting(false);

      try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/apply-decrypt-fix`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ fixes }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        onSuccess();
      } catch (err) {
        console.error("[error-decryptor] Apply fix failed:", err);
      }
    },
    [decryptedResult, projectId],
  );

  return {
    sandpackError,
    decryptedResult,
    isDecrypting,
    dismissError,
    applyFix,
  };
}
