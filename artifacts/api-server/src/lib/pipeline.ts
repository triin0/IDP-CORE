import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { AGENTS, type AgentContext, type AgentOutput, type AgentStageStatus, type AgentRole } from "./agents";
import { getActiveConfig, runGoldenPathChecks } from "./golden-path";
import { callWithRetry } from "./ai-retry";
import { validateAllManifests } from "./dependency-audit";
import type { GoldenPathConfigRules } from "@workspace/db";

export interface PipelineStatus {
  stages: AgentStageStatus[];
  currentAgent?: AgentRole;
}

function initPipelineStatus(): PipelineStatus {
  return {
    stages: AGENTS.map((a) => ({
      role: a.role,
      label: a.label,
      status: "pending" as const,
    })),
  };
}

async function updatePipelineStage(
  projectId: string,
  pipeline: PipelineStatus,
  role: AgentRole,
  update: Partial<AgentStageStatus>,
): Promise<void> {
  const stage = pipeline.stages.find((s) => s.role === role);
  if (stage) {
    Object.assign(stage, update);
  }
  if (update.status === "running") {
    pipeline.currentAgent = role;
  } else if (update.status === "completed" || update.status === "failed") {
    if (pipeline.currentAgent === role) {
      pipeline.currentAgent = undefined;
    }
  }

  await db
    .update(projectsTable)
    .set({ pipelineStatus: pipeline })
    .where(eq(projectsTable.id, projectId));
}

async function runAgent(
  agent: typeof AGENTS[number],
  config: GoldenPathConfigRules,
  context: AgentContext,
  projectId: string,
): Promise<AgentOutput> {
  const systemPrompt = agent.buildPrompt(config, context);

  const rawContent = await callWithRetry(
    {
      model: "gpt-5.2",
      max_completion_tokens: agent.maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Build the following application:\n\n${context.prompt}` },
      ],
      response_format: { type: "json_object" },
    },
    `${agent.role}:${projectId.slice(0, 8)}`,
  );

  let parsed: { files: Array<{ path: string; content: string }>; notes?: string };
  try {
    parsed = JSON.parse(rawContent) as { files: Array<{ path: string; content: string }>; notes?: string };
  } catch {
    throw new Error(`${agent.label} returned invalid JSON`);
  }

  if (!parsed.files || !Array.isArray(parsed.files)) {
    throw new Error(`${agent.label} response missing 'files' array`);
  }

  return {
    role: agent.role,
    files: parsed.files,
    notes: parsed.notes || "",
  };
}

function reconcileOutputs(outputs: Record<string, AgentOutput>): Array<{ path: string; content: string }> {
  const fileMap = new Map<string, { content: string; source: AgentRole }>();

  const order: AgentRole[] = ["architect", "backend", "frontend", "security"];

  for (const role of order) {
    const output = outputs[role];
    if (!output) continue;

    for (const file of output.files) {
      fileMap.set(file.path, { content: file.content, source: role });
    }
  }

  return Array.from(fileMap.entries())
    .map(([path, { content }]) => ({ path, content }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function runPipeline(
  projectId: string,
  prompt: string,
  spec?: AgentContext["spec"],
): Promise<void> {
  const pipeline = initPipelineStatus();

  try {
    await db
      .update(projectsTable)
      .set({ status: "generating", pipelineStatus: pipeline })
      .where(eq(projectsTable.id, projectId));

    const config = await getActiveConfig();
    const context: AgentContext = {
      prompt,
      spec,
      priorOutputs: {},
    };

    for (const agent of AGENTS) {
      await updatePipelineStage(projectId, pipeline, agent.role, {
        status: "running",
        startedAt: new Date().toISOString(),
      });

      try {
        const output = await runAgent(agent, config, context, projectId);
        context.priorOutputs[agent.role] = output;

        await updatePipelineStage(projectId, pipeline, agent.role, {
          status: "completed",
          completedAt: new Date().toISOString(),
          fileCount: output.files.length,
          filePaths: output.files.map((f) => f.path),
          notes: output.notes || undefined,
        });

        console.log(
          `[pipeline:${projectId.slice(0, 8)}] ${agent.label} completed: ${output.files.length} files`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);

        await updatePipelineStage(projectId, pipeline, agent.role, {
          status: "failed",
          completedAt: new Date().toISOString(),
          error: message,
        });

        throw new Error(`${agent.label} failed: ${message}`);
      }
    }

    const reconciledFiles = reconcileOutputs(context.priorOutputs);

    console.log(
      `[pipeline:${projectId.slice(0, 8)}] Reconciled ${reconciledFiles.length} files from ${Object.keys(context.priorOutputs).length} agents`,
    );

    const goldenPathChecks = runGoldenPathChecks(reconciledFiles, config);

    try {
      const auditResult = await validateAllManifests(reconciledFiles);
      if (!auditResult.passed) {
        console.warn(`[pipeline:${projectId.slice(0, 8)}] Dependency audit flagged issues:\n${auditResult.errors.join("\n")}`);
        const hasHallucinatedDeps = auditResult.errors.some(e => e.includes("[Hallucination]"));
        if (hasHallucinatedDeps) {
          throw new Error(`Dependency audit blocked generation: ${auditResult.errors.join("; ")}`);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("Dependency audit blocked")) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[pipeline:${projectId.slice(0, 8)}] Dependency audit error:`, msg);
    }

    await db
      .update(projectsTable)
      .set({
        status: "ready",
        files: reconciledFiles,
        goldenPathChecks,
        pipelineStatus: pipeline,
      })
      .where(eq(projectsTable.id, projectId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error(`Pipeline failed for project ${projectId}:`, message);
    await db
      .update(projectsTable)
      .set({
        status: "failed",
        error: message,
        pipelineStatus: pipeline,
      })
      .where(eq(projectsTable.id, projectId));
  }
}
