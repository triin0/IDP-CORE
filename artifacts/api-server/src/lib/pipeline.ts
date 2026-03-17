import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { AGENTS, GENERATION_AGENTS, VERIFICATION_AGENT, type AgentContext, type AgentOutput, type AgentStageStatus, type AgentRole } from "./agents";
import { getActiveConfig, runGoldenPathChecks, getCriticalFailures } from "./golden-path";
import type { GoldenPathCheck } from "./golden-path";
import { callWithRetry } from "./ai-retry";
import { validateAllManifests } from "./dependency-audit";
import { runBuildVerification } from "./build-verification";
import { computeHashManifest, compareHashManifests } from "./hash-integrity";
import type { HashManifest } from "./hash-integrity";
import type { GoldenPathConfigRules } from "@workspace/db";

export type FailureCategory =
  | "golden_path_violation"
  | "dependency_hallucination"
  | "dependency_vulnerability"
  | "build_failure"
  | "hash_integrity"
  | "spec_mismatch"
  | "none";

export interface VerificationVerdict {
  passed: boolean;
  failureCategory: FailureCategory;
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

function buildExpectedHashManifest(
  spec: AgentContext["spec"],
  reconciledFiles: Array<{ path: string; content: string }>,
): HashManifest {
  const coreConfigPatterns = ["package.json", "tsconfig.json", ".env.example"];
  const expectedPaths: string[] = [];

  if (spec?.fileStructure) {
    for (const filePath of spec.fileStructure) {
      if (coreConfigPatterns.some(p => filePath === p || filePath.endsWith(`/${p}`))) {
        expectedPaths.push(filePath);
      }
    }
  }

  if (expectedPaths.length === 0) {
    for (const pattern of coreConfigPatterns) {
      const matchingFiles = reconciledFiles.filter(
        f => f.path === pattern || f.path.endsWith(`/${pattern}`)
      );
      for (const f of matchingFiles) {
        expectedPaths.push(f.path);
      }
    }
  }

  const hashes = expectedPaths.map((path) => ({
    path,
    sha256: "",
  }));

  return { hashes, computedAt: new Date().toISOString() };
}

function determineFailureCategory(
  criticalFailures: GoldenPathCheck[],
  hasHallucinatedDeps: boolean,
  depAuditFailed: boolean,
  buildFailed: boolean,
  hashIntegrityFailed: boolean,
): FailureCategory {
  if (hashIntegrityFailed) return "hash_integrity";
  if (hasHallucinatedDeps) return "dependency_hallucination";
  if (criticalFailures.length > 0) return "golden_path_violation";
  if (buildFailed) return "build_failure";
  if (depAuditFailed) return "dependency_vulnerability";
  return "none";
}

async function runVerificationStage(
  projectId: string,
  pipeline: PipelineStatus,
  reconciledFiles: Array<{ path: string; content: string }>,
  config: GoldenPathConfigRules,
  spec: AgentContext["spec"],
  prompt: string,
  hashManifest: HashManifest,
): Promise<{ verdict: VerificationVerdict; goldenPathChecks: GoldenPathCheck[] }> {
  await updatePipelineStage(projectId, pipeline, "verification", {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  const verdictChecks: VerificationVerdict["checks"] = [];
  let buildStderr: string | undefined;
  const dependencyErrors: string[] = [];

  console.log(`[pipeline:${projectId.slice(0, 8)}] Running Golden Path checks...`);
  const goldenPathChecks: GoldenPathCheck[] = runGoldenPathChecks(reconciledFiles, config);
  for (const check of goldenPathChecks) {
    verdictChecks.push({
      name: check.name,
      passed: check.passed,
      description: check.description,
      category: "golden_path",
    });
  }

  let depAuditCheck: GoldenPathCheck = {
    name: "Dependency Audit",
    passed: true,
    description: "All dependencies verified against npm registry and OSV vulnerability database",
  };
  try {
    const auditResult = await validateAllManifests(reconciledFiles);
    if (!auditResult.passed) {
      console.warn(`[pipeline:${projectId.slice(0, 8)}] Dependency audit flagged issues:\n${auditResult.errors.join("\n")}`);
      dependencyErrors.push(...auditResult.errors);
      depAuditCheck = {
        name: "Dependency Audit",
        passed: false,
        description: auditResult.errors.join("; "),
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline:${projectId.slice(0, 8)}] Dependency audit error:`, msg);
    depAuditCheck = { name: "Dependency Audit", passed: false, description: `Audit failed: ${msg}` };
    dependencyErrors.push(`Audit error: ${msg}`);
  }
  goldenPathChecks.push(depAuditCheck);
  verdictChecks.push({
    name: depAuditCheck.name,
    passed: depAuditCheck.passed,
    description: depAuditCheck.description,
    category: "dependency_audit",
  });

  let buildCheck: GoldenPathCheck = {
    name: "Build Verification",
    passed: true,
    description: "Project compiles successfully with npm install && npm run build",
  };
  try {
    console.log(`[pipeline:${projectId.slice(0, 8)}] Running build verification...`);
    const buildResult = await runBuildVerification(reconciledFiles);
    buildCheck = {
      name: "Build Verification",
      passed: buildResult.passed,
      description: buildResult.description,
    };
    if (!buildResult.passed) {
      console.warn(`[pipeline:${projectId.slice(0, 8)}] Build verification failed: ${buildResult.description}`);
      buildStderr = buildResult.stderr || undefined;
    } else {
      console.log(`[pipeline:${projectId.slice(0, 8)}] Build verification passed`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline:${projectId.slice(0, 8)}] Build verification error:`, msg);
    buildCheck = { name: "Build Verification", passed: false, description: `Build verification failed: ${msg}` };
  }
  goldenPathChecks.push(buildCheck);
  verdictChecks.push({
    name: buildCheck.name,
    passed: buildCheck.passed,
    description: buildCheck.description,
    category: "build",
  });

  const expectedManifest = buildExpectedHashManifest(spec, reconciledFiles);
  const hashComparison = compareHashManifests(hashManifest, expectedManifest);
  const hashAudit = hashComparison.map((entry) => ({
    path: entry.path,
    status: entry.status,
    currentHash: entry.currentHash,
    expectedHash: entry.expectedHash,
  }));
  const hashIntegrityFailed = hashComparison.some(
    (h) => h.status === "missing"
  );
  if (hashIntegrityFailed) {
    const missingFiles = hashComparison.filter(h => h.status === "missing").map(h => h.path);
    verdictChecks.push({
      name: "Hash Integrity",
      passed: false,
      description: `Expected core config files missing from output: ${missingFiles.join(", ")}`,
      category: "hash_integrity",
    });
  } else {
    verdictChecks.push({
      name: "Hash Integrity",
      passed: true,
      description: `All ${hashComparison.length} core config files present and hashed`,
      category: "hash_integrity",
    });
  }

  const verificationContext: AgentContext = {
    prompt,
    spec,
    priorOutputs: {
      reconciled: {
        role: "verification" as AgentRole,
        files: reconciledFiles,
        notes: "Reconciled final file tree from all generation agents",
      },
    },
  };

  let verificationNotes = "";
  try {
    const verificationOutput = await runAgent(VERIFICATION_AGENT, config, verificationContext, projectId);
    verificationNotes = verificationOutput.notes;
    console.log(`[pipeline:${projectId.slice(0, 8)}] Verification agent completed`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[pipeline:${projectId.slice(0, 8)}] Verification agent LLM call failed (non-blocking): ${msg}`);
    verificationNotes = `Verification agent analysis unavailable: ${msg}`;
  }

  const criticalFailures = getCriticalFailures(goldenPathChecks);
  const hasHallucinatedDeps = depAuditCheck.description.includes("[Hallucination]");
  const overallPassed = criticalFailures.length === 0 && !hasHallucinatedDeps && !hashIntegrityFailed;

  const failureCategory = determineFailureCategory(
    criticalFailures,
    hasHallucinatedDeps,
    !depAuditCheck.passed,
    !buildCheck.passed,
    hashIntegrityFailed,
  );

  const passedNames = verdictChecks.filter(c => c.passed).map(c => c.name);
  const failedNames = verdictChecks.filter(c => !c.passed).map(c => c.name);

  const summary = [
    verificationNotes,
    `\n--- Automated Check Results ---`,
    `PASSED: ${passedNames.length > 0 ? passedNames.join(", ") : "None"}`,
    `FAILED: ${failedNames.length > 0 ? failedNames.join(", ") : "None"}`,
    overallPassed ? "VERDICT: All critical checks passed." : `VERDICT: Blocked [${failureCategory}] — ${failedNames.join(", ")}`,
  ].join("\n");

  const recommendedFixes: string[] = [];
  for (const check of verdictChecks) {
    if (!check.passed) {
      recommendedFixes.push(`Fix "${check.name}": ${check.description}`);
    }
  }

  const verdict: VerificationVerdict = {
    passed: overallPassed,
    failureCategory,
    summary,
    checks: verdictChecks,
    hashAudit,
    buildStderr,
    dependencyErrors,
    recommendedFixes,
  };

  await updatePipelineStage(projectId, pipeline, "verification", {
    status: overallPassed ? "completed" : "failed",
    completedAt: new Date().toISOString(),
    notes: overallPassed ? "All checks passed" : `${failedNames.length} check(s) failed`,
    error: overallPassed ? undefined : `Failed [${failureCategory}]: ${failedNames.join(", ")}`,
  });

  return { verdict, goldenPathChecks };
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

    for (const agent of GENERATION_AGENTS) {
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

    const hashManifest = computeHashManifest(reconciledFiles);
    console.log(
      `[pipeline:${projectId.slice(0, 8)}] Computed SHA-256 hashes for ${hashManifest.hashes.length} core config files`,
    );

    await db
      .update(projectsTable)
      .set({ status: "validating", pipelineStatus: pipeline })
      .where(eq(projectsTable.id, projectId));

    const { verdict, goldenPathChecks } = await runVerificationStage(
      projectId,
      pipeline,
      reconciledFiles,
      config,
      spec,
      prompt,
      hashManifest,
    );

    if (!verdict.passed) {
      const errorMsg = `Verification agent blocked project: ${verdict.recommendedFixes.slice(0, 3).join("; ")}`;
      console.error(`[pipeline:${projectId.slice(0, 8)}] ${errorMsg}`);

      await db
        .update(projectsTable)
        .set({
          status: "failed_validation",
          files: reconciledFiles,
          goldenPathChecks,
          pipelineStatus: pipeline,
          verificationVerdict: verdict,
          error: errorMsg,
        })
        .where(eq(projectsTable.id, projectId));
      return;
    }

    await db
      .update(projectsTable)
      .set({
        status: "ready",
        files: reconciledFiles,
        goldenPathChecks,
        pipelineStatus: pipeline,
        verificationVerdict: verdict,
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
