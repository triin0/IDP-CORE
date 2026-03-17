import { useState, useEffect, useCallback, useRef } from "react";

export type PipelineEventType =
  | "connected"
  | "stage:start"
  | "stage:complete"
  | "stage:fail"
  | "pipeline:log"
  | "verification:start"
  | "verification:gate"
  | "verification:complete"
  | "self-healing:attempt"
  | "self-healing:success"
  | "self-healing:exhausted"
  | "build:output"
  | "pipeline:complete"
  | "pipeline:error";

export interface PipelineEvent {
  type: PipelineEventType;
  projectId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface VerificationGate {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface UsePipelineStreamResult {
  events: PipelineEvent[];
  isConnected: boolean;
  isComplete: boolean;
  selfHealingAttempts: number;
  verificationGates: VerificationGate[];
  currentStage: string | null;
  terminalLines: string[];
}

export function usePipelineStream(
  projectId: string | null,
  enabled: boolean,
  initialHistoryLines: string[] = [],
): UsePipelineStreamResult {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [selfHealingAttempts, setSelfHealingAttempts] = useState(0);
  const [verificationGates, setVerificationGates] = useState<VerificationGate[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const historyAppliedRef = useRef(false);

  useEffect(() => {
    if (initialHistoryLines.length > 0 && !historyAppliedRef.current) {
      historyAppliedRef.current = true;
      setTerminalLines(initialHistoryLines);
    } else if (initialHistoryLines.length > 0) {
      setTerminalLines(prev => {
        const sseOnlyLines = prev.filter(l => l.startsWith("[SSE]") || l.startsWith("[pipeline]") || l.startsWith("[self-heal]") || l.startsWith("[verification]") || l.startsWith("[build]") || l.startsWith("[stderr]"));
        return [...initialHistoryLines, ...sseOnlyLines].slice(-200);
      });
    }
  }, [initialHistoryLines]);

  const addTerminalLine = useCallback((line: string) => {
    setTerminalLines(prev => [...prev.slice(-200), line]);
  }, []);

  useEffect(() => {
    if (!projectId || !enabled) return;

    const baseUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
    const url = `${baseUrl}/projects/${projectId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      addTerminalLine("[SSE] Connected to pipeline stream");
    };

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as PipelineEvent;
        setEvents(prev => [...prev, event]);

        switch (event.type) {
          case "stage:start":
            setCurrentStage(event.data.role as string);
            addTerminalLine(`[${event.data.label}] Starting...`);
            break;

          case "stage:complete":
            addTerminalLine(`[${event.data.label}] Completed — ${event.data.fileCount} files`);
            break;

          case "stage:fail":
            addTerminalLine(`[${event.data.label}] FAILED: ${event.data.error}`);
            break;

          case "pipeline:log":
            addTerminalLine(`[pipeline] ${event.data.message}`);
            break;

          case "verification:start":
            setCurrentStage("verification");
            addTerminalLine(`[verification] Starting verification gate (attempt ${(event.data.attempt as number) + 1})...`);
            break;

          case "verification:complete": {
            const passed = event.data.passed as boolean;
            const category = event.data.failureCategory as string;
            addTerminalLine(
              passed
                ? "[verification] All gates PASSED"
                : `[verification] FAILED: ${category}`
            );
            setVerificationGates([
              { name: "Golden Path", passed: category !== "golden_path_violation", detail: !passed ? category : undefined },
              { name: "Dependencies", passed: (event.data.dependencyErrors as number) === 0 },
              { name: "Build", passed: event.data.buildPassed as boolean },
              { name: "Hash Integrity", passed: category !== "hash_integrity" },
              { name: "Overall", passed },
            ]);
            break;
          }

          case "self-healing:attempt": {
            const attempt = event.data.attempt as number;
            setSelfHealingAttempts(attempt);
            setCurrentStage("fixer");
            addTerminalLine(`[self-heal] Recovery attempt ${attempt}/${event.data.maxAttempts} — fixing: ${event.data.failureCategory}`);
            if (event.data.buildStderr) {
              addTerminalLine(`[stderr] ${(event.data.buildStderr as string).slice(0, 200)}`);
            }
            break;
          }

          case "self-healing:success":
            addTerminalLine(`[self-heal] Recovery SUCCEEDED on attempt ${event.data.attempt}`);
            break;

          case "self-healing:exhausted":
            addTerminalLine(`[self-heal] Recovery EXHAUSTED — ${event.data.reason || event.data.failureCategory}`);
            break;

          case "build:output":
            addTerminalLine(`[build] ${event.data.line}`);
            break;

          case "pipeline:complete":
            setIsComplete(true);
            addTerminalLine(`[pipeline] COMPLETE — ${event.data.fileCount} files ready`);
            break;

          case "pipeline:error":
            setIsComplete(true);
            addTerminalLine(`[pipeline] ERROR: ${event.data.error}`);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      addTerminalLine("[SSE] Connection lost — will reconnect");
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [projectId, enabled, addTerminalLine]);

  return {
    events,
    isConnected,
    isComplete,
    selfHealingAttempts,
    verificationGates,
    currentStage,
    terminalLines,
  };
}
