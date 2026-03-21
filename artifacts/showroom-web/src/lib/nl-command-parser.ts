import { analyzeIntent, buildDispatchPlan, dispatchToEngines } from "./engine-dispatcher";
import type { CommandAction } from "../types/commands";
import { commandBus } from "./command-bus";

const VALID_ACTIONS = ["SPAWN_ASSET", "DELETE_NODE", "TRANSFORM_NODE", "UPDATE_MATERIAL", "SET_ENVIRONMENT", "SNAPSHOT_STATE", "UNDO", "REDO"] as const;

export async function parseNaturalLanguageMultiEngine(
  text: string,
): Promise<{ success: boolean; engines: string[]; results?: any[]; error?: string }> {
  const intent = analyzeIntent(text);
  const singleResult = await parseNaturalLanguage(text);
  if (!singleResult.success || !singleResult.command) {
    return { success: false, engines: intent.engines, error: singleResult.error };
  }
  const plan = buildDispatchPlan([singleResult.command], text);
  const dispatched = await dispatchToEngines(plan);
  return {
    success: dispatched.results.every(r => r.success),
    engines: plan.targets,
    results: dispatched.results,
  };
}

export async function parseNaturalLanguage(
  text: string,
): Promise<{ success: boolean; command?: CommandAction; error?: string }> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || ""}/api/ai-command`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.error || "Request failed" };
    }
    const { command } = (await res.json()) as { command: CommandAction };
    if (!command?.action || !VALID_ACTIONS.includes(command.action as any)) {
      return { success: false, error: `Unknown action: ${(command as any)?.action}` };
    }
    commandBus.dispatch(command, "ai");
    return { success: true, command };
  } catch (error: unknown) {
    return { success: false, error: "Network error" };
  }
}
