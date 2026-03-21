import type { CommandAction } from "../types/commands";
import { commandBus } from "./command-bus";

export type EngineTarget = "react" | "fastapi" | "mobile-expo";

export interface DispatchPlan {
  targets: EngineTarget[];
  commands: Array<{
    engine: EngineTarget;
    action: "SPAWN_ASSET" | "DELETE_NODE" | "TRANSFORM_NODE" | "UPDATE_MATERIAL" | "SET_ENVIRONMENT" | "SNAPSHOT_STATE" | "UNDO" | "REDO";
    payload: Record<string, unknown>;
    crossRef?: { engine: EngineTarget; hook: string };
  }>;
  intent: string;
}

const ENGINE_AFFINITY: Record<string, EngineTarget[]> = {
  SPAWN_ASSET: ["react"],
  DELETE_NODE: ["react"],
  TRANSFORM_NODE: ["react"],
  UPDATE_MATERIAL: ["react"],
  SET_ENVIRONMENT: ["react"],
  SNAPSHOT_STATE: ["react", "fastapi"],
  UNDO: ["react"],
  REDO: ["react"],
};

const CROSS_STACK_HOOKS: Record<string, Array<{ engine: EngineTarget; hook: string }>> = {
  SPAWN_ASSET: [{ engine: "fastapi", hook: "createAssetRecord" }],
  DELETE_NODE: [{ engine: "fastapi", hook: "deleteAssetRecord" }],
  SNAPSHOT_STATE: [{ engine: "fastapi", hook: "persistSnapshot" }],
};

export function resolveEngineTargets(
  action: string,
): EngineTarget[] {
  return ENGINE_AFFINITY[action] ?? ["react"];
}

export function buildDispatchPlan(
  commands: CommandAction[],
  intent: string,
): DispatchPlan {
  const targets = new Set<EngineTarget>();
  const planned: DispatchPlan["commands"] = [];

  for (const command of commands) {
    const engines = resolveEngineTargets(command.action);
    engines.forEach(e => targets.add(e));

    planned.push({
      engine: engines[0],
      action: command.action as any,
      payload: command as unknown as Record<string, unknown>,
    });

    const hooks = CROSS_STACK_HOOKS[command.action];
    if (hooks) {
      for (const hook of hooks) {
        targets.add(hook.engine);
        planned[planned.length - 1].crossRef = hook;
      }
    }
  }

  return {
    targets: [...targets],
    commands: planned,
    intent,
  };
}

export async function dispatchToEngines(
  plan: DispatchPlan,
): Promise<{
  results: Array<{ engine: EngineTarget; success: boolean; error?: string }>;
}> {
  const results: Array<{ engine: EngineTarget; success: boolean; error?: string }> = [];

  for (const cmd of plan.commands) {
    try {
      if (cmd.engine === "react") {
        commandBus.dispatch(cmd.payload as unknown as CommandAction, "ai");
      }

      if (cmd.crossRef) {
        const hookRes = await fetch(
          `${import.meta.env.VITE_API_URL || ""}/api/engine-hook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              engine: cmd.crossRef.engine,
              hook: cmd.crossRef.hook,
              payload: cmd.payload,
              sourceEngine: cmd.engine,
            }),
          },
        );
        if (!hookRes.ok) {
          results.push({ engine: cmd.crossRef.engine, success: false, error: `Hook ${cmd.crossRef.hook} failed` });
          continue;
        }
      }

      results.push({ engine: cmd.engine, success: true });
    } catch (error: unknown) {
      results.push({ engine: cmd.engine, success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return { results };
}

export function analyzeIntent(
  text: string,
): { engines: EngineTarget[]; reasoning: string } {
  const lower = text.toLowerCase();
  const engines = new Set<EngineTarget>();
  const reasons: string[] = [];

  const reactSignals = ["3d", "scene", "model", "mesh", "material", "texture", "light",
    "camera", "rotate", "position", "spawn", "render", "canvas", "ui", "component",
    "button", "modal", "sidebar", "layout", "page", "dashboard"];
  const fastapiSignals = ["api", "endpoint", "database", "table", "model", "schema",
    "crud", "auth", "login", "user", "backend", "server", "query", "data",
    "persist", "store", "fetch", "session", "middleware", "route"];
  const mobileSignals = ["mobile", "app", "screen", "tab", "navigation", "swipe",
    "touch", "haptic", "notification", "push", "phone", "ios", "android",
    "expo", "native", "gesture"];

  for (const s of reactSignals) {
    if (lower.includes(s)) { engines.add("react"); reasons.push(`React: detected "${s}"`); break; }
  }
  for (const s of fastapiSignals) {
    if (lower.includes(s)) { engines.add("fastapi"); reasons.push(`FastAPI: detected "${s}"`); break; }
  }
  for (const s of mobileSignals) {
    if (lower.includes(s)) { engines.add("mobile-expo"); reasons.push(`Mobile: detected "${s}"`); break; }
  }

  if (engines.size === 0) {
    engines.add("react");
    reasons.push("Default: no specific engine signal, routing to React");
  }

  return { engines: [...engines], reasoning: reasons.join("; ") };
}
