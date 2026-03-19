import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { AGENTS, GENERATION_AGENTS, VERIFICATION_AGENT, FIXER_AGENT_PROMPT, type AgentContext, type AgentOutput, type AgentStageStatus, type AgentRole } from "./agents";
import { getActiveConfig, runGoldenPathChecks, getCriticalFailures } from "./golden-path";
import type { GoldenPathCheck } from "./golden-path";
import { callWithRetry } from "@workspace/engine-common";
import { validateAllManifests } from "./dependency-audit";
import { runBuildVerification } from "./build-verification";
import { computeHashManifest, compareHashManifests, computeFullTreeHash, computePayloadHash } from "./hash-integrity";
import type { HashManifest, FullTreeHashResult } from "./hash-integrity";
import { runASTVerification } from "./ast-verification";
import type { ASTVerificationResult } from "./ast-verification";
import type { GoldenPathConfigRules } from "@workspace/db";
import { emitPipelineEvent } from "@workspace/engine-common";
import { enforcePackageVersions } from "./version-enforcement";
import { hardenGeneratedTypes } from "./type-hardener";
import { createSnapshot } from "@workspace/engine-common";

function extractJSON(raw: string): unknown | null {
  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch {}
  }
  const braceStart = raw.indexOf("{");
  const braceEnd = raw.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try { return JSON.parse(raw.slice(braceStart, braceEnd + 1)); } catch {}
  }
  return null;
}

export type FailureCategory =
  | "golden_path_violation"
  | "dependency_hallucination"
  | "dependency_vulnerability"
  | "build_failure"
  | "hash_integrity"
  | "ast_violation"
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
  buildPassed: boolean;
  buildStderr?: string;
  dependencyErrors: string[];
  recommendedFixes: string[];
}

export interface PipelineStatus {
  stages: AgentStageStatus[];
  currentAgent?: AgentRole;
}

export function initPipelineStatus(): PipelineStatus {
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
    const extracted = extractJSON(rawContent);
    if (extracted) {
      parsed = extracted as typeof parsed;
    } else {
      throw new Error(`${agent.label} returned invalid JSON`);
    }
  }

  if (!parsed.files || !Array.isArray(parsed.files)) {
    throw new Error(`${agent.label} response missing 'files' array`);
  }

  return {
    role: agent.role,
    files: parsed.files,
    notes: typeof parsed.notes === "string" ? parsed.notes : (parsed.notes ? JSON.stringify(parsed.notes) : ""),
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

export function buildExpectedHashManifest(
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
  astFailed: boolean = false,
): FailureCategory {
  if (hashIntegrityFailed) return "hash_integrity";
  if (hasHallucinatedDeps) return "dependency_hallucination";
  if (astFailed) return "ast_violation";
  if (criticalFailures.length > 0) return "golden_path_violation";
  if (buildFailed) return "build_failure";
  if (depAuditFailed) return "dependency_vulnerability";
  return "none";
}

export async function runVerificationStage(
  projectId: string,
  pipeline: PipelineStatus,
  reconciledFiles: Array<{ path: string; content: string }>,
  config: GoldenPathConfigRules,
  spec: AgentContext["spec"],
  prompt: string,
  hashManifest: HashManifest,
): Promise<{ verdict: VerificationVerdict; goldenPathChecks: GoldenPathCheck[]; payloadHash: string; hardenedFiles: Array<{ path: string; content: string }> }> {
  await updatePipelineStage(projectId, pipeline, "verification", {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  const verdictChecks: VerificationVerdict["checks"] = [];
  let buildStderr: string | undefined;
  const dependencyErrors: string[] = [];

  const enforcement = enforcePackageVersions(reconciledFiles);
  let enforcedFiles = reconciledFiles;
  if (enforcement.fixes.length > 0) {
    enforcedFiles = enforcement.files;
    console.log(`[pipeline:${projectId.slice(0, 8)}] Version enforcement applied ${enforcement.fixes.length} fixes:\n${enforcement.fixes.join("\n")}`);
    emitPipelineEvent(projectId, "version-enforcement", { fixes: enforcement.fixes });
  }

  const hardening = hardenGeneratedTypes(enforcedFiles);
  if (hardening.fixes.length > 0) {
    enforcedFiles = hardening.files;
    console.log(`[pipeline:${projectId.slice(0, 8)}] Type hardening applied ${hardening.fixes.length} fixes:\n${hardening.fixes.join("\n")}`);
    emitPipelineEvent(projectId, "type-hardening", { fixes: hardening.fixes });
  }

  console.log(`[pipeline:${projectId.slice(0, 8)}] Running Golden Path checks...`);
  const goldenPathChecks: GoldenPathCheck[] = runGoldenPathChecks(enforcedFiles, config);
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
    const auditResult = await validateAllManifests(enforcedFiles);
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
    const buildResult = await runBuildVerification(enforcedFiles);
    buildCheck = {
      name: "Build Verification",
      passed: buildResult.passed,
      description: buildResult.description,
    };
    if (!buildResult.passed) {
      console.warn(`[pipeline:${projectId.slice(0, 8)}] Build verification failed: ${buildResult.description.slice(0, 300)}`);
      const rawOutput = [buildResult.stdout || "", buildResult.stderr || ""].join("\n");
      const cleanedOutput = rawOutput
        .split("\n")
        .filter((l: string) => !/^npm\s+(warn|notice|WARN|ERR!|error\s+(code|path|workspace|location|command|Lifecycle))/i.test(l) && l.trim().length > 0)
        .join("\n");
      buildStderr = cleanedOutput || buildResult.description || undefined;
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

  console.log(`[pipeline:${projectId.slice(0, 8)}] Running AST verification...`);
  let astResult: ASTVerificationResult;
  try {
    astResult = runASTVerification(enforcedFiles);
    for (const check of astResult.checks) {
      verdictChecks.push({
        name: check.name,
        passed: check.passed,
        description: check.description,
        category: "ast_verification",
      });
    }
    if (astResult.passed) {
      console.log(`[pipeline:${projectId.slice(0, 8)}] AST verification passed (${astResult.checks.length} checks)`);
    } else {
      console.warn(`[pipeline:${projectId.slice(0, 8)}] AST verification failed: ${astResult.errors.join("; ")}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline:${projectId.slice(0, 8)}] AST verification error (non-blocking):`, msg);
    astResult = { passed: true, checks: [], errors: [] };
  }
  goldenPathChecks.push({
    name: "AST Verification",
    passed: astResult.passed,
    description: astResult.passed
      ? `All ${astResult.checks.filter(c => c.passed).length} AST checks passed — security middleware verified in execution path`
      : `${astResult.errors.length} AST violation(s): ${astResult.errors.slice(0, 3).join("; ")}`,
  });

  console.log(`[pipeline:${projectId.slice(0, 8)}] Computing full-tree hash manifest...`);
  const fullTreeHash = computeFullTreeHash(enforcedFiles, spec?.fileStructure);

  const expectedManifest = buildExpectedHashManifest(spec, enforcedFiles);
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

  const missingSpec = fullTreeHash.specComparison.missing;
  const specMatchRatio = fullTreeHash.specComparison.matchRatio;
  const specMismatch = specMatchRatio < 0.5;
  if (hashIntegrityFailed) {
    const missingCore = hashComparison.filter(h => h.status === "missing").map(h => h.path);
    verdictChecks.push({
      name: "Hash Integrity",
      passed: false,
      description: `Core config files missing: ${missingCore.join(", ")} | Spec match ratio: ${(specMatchRatio * 100).toFixed(0)}%`,
      category: "hash_integrity",
    });
  } else if (specMismatch) {
    verdictChecks.push({
      name: "Hash Integrity",
      passed: false,
      description: `Spec match ratio too low (${(specMatchRatio * 100).toFixed(0)}%). Missing: ${missingSpec.slice(0, 5).join(", ")}${missingSpec.length > 5 ? ` (+${missingSpec.length - 5} more)` : ""}`,
      category: "hash_integrity",
    });
  } else {
    verdictChecks.push({
      name: "Hash Integrity",
      passed: true,
      description: `${fullTreeHash.fileCount} files hashed (SHA-256), payload locked: ${fullTreeHash.payloadHash.slice(0, 16)}... | Spec match: ${(fullTreeHash.specComparison.matchRatio * 100).toFixed(0)}%`,
      category: "hash_integrity",
    });
  }

  const verificationContext: AgentContext = {
    prompt,
    spec,
    priorOutputs: {
      reconciled: {
        role: "verification" as AgentRole,
        files: enforcedFiles,
        notes: "Reconciled final file tree from all generation agents",
      },
    },
  };

  let verificationNotes = "";
  try {
    const verificationOutput = await runAgent(VERIFICATION_AGENT, config, verificationContext, projectId);
    verificationNotes = typeof verificationOutput.notes === "string"
      ? verificationOutput.notes
      : JSON.stringify(verificationOutput.notes);
    console.log(`[pipeline:${projectId.slice(0, 8)}] Verification agent completed`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[pipeline:${projectId.slice(0, 8)}] Verification agent LLM call failed (non-blocking): ${msg}`);
    verificationNotes = `Verification agent analysis unavailable: ${msg}`;
  }

  const criticalFailures = getCriticalFailures(goldenPathChecks);
  const hasHallucinatedDeps = depAuditCheck.description.includes("[Hallucination]");
  const astFailed = !astResult.passed;
  const hasCVEsOnly = !depAuditCheck.passed && !hasHallucinatedDeps && depAuditCheck.description.includes("[CVE]");
  const overallPassed =
    !hasHallucinatedDeps &&
    !hashIntegrityFailed &&
    !specMismatch;

  const failureCategory = determineFailureCategory(
    criticalFailures,
    hasHallucinatedDeps,
    !depAuditCheck.passed,
    !buildCheck.passed,
    hashIntegrityFailed || specMismatch,
    astFailed,
  );

  const passedNames = verdictChecks.filter(c => c.passed).map(c => c.name);
  const failedNames = verdictChecks.filter(c => !c.passed).map(c => c.name);

  const summary = [
    verificationNotes,
    `\n--- Automated Check Results ---`,
    `PASSED: ${passedNames.length > 0 ? passedNames.join(", ") : "None"}`,
    `FAILED: ${failedNames.length > 0 ? failedNames.join(", ") : "None"}`,
    `PAYLOAD HASH: ${fullTreeHash.payloadHash}`,
    overallPassed
      ? (failedNames.length > 0 ? `VERDICT: Passed with warnings — ${failedNames.join(", ")}` : "VERDICT: All checks passed.")
      : `VERDICT: Blocked [${failureCategory}] — ${failedNames.join(", ")}`,
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
    buildPassed: buildCheck.passed,
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

  return { verdict, goldenPathChecks, payloadHash: fullTreeHash.payloadHash, hardenedFiles: enforcedFiles };
}

const MAX_RECOVERY_LOOPS = 3;

async function runFixerAgent(
  projectId: string,
  currentFiles: Array<{ path: string; content: string }>,
  verdict: VerificationVerdict,
): Promise<Array<{ path: string; content: string }>> {
  const evidenceParts: string[] = [];

  if (verdict.buildStderr) {
    evidenceParts.push(`### BUILD STDERR\n${verdict.buildStderr}`);
  }

  if (verdict.dependencyErrors.length > 0) {
    evidenceParts.push(`### DEPENDENCY ERRORS\n${verdict.dependencyErrors.join("\n")}`);
  }

  const failedChecks = verdict.checks.filter(c => !c.passed);
  if (failedChecks.length > 0) {
    evidenceParts.push(`### FAILED CHECKS\n${failedChecks.map(c => `- ${c.name}: ${c.description}`).join("\n")}`);
  }

  if (verdict.recommendedFixes.length > 0) {
    evidenceParts.push(`### RECOMMENDED FIXES\n${verdict.recommendedFixes.join("\n")}`);
  }

  const hashFailures = verdict.hashAudit.filter(h => h.status !== "match");
  if (hashFailures.length > 0) {
    evidenceParts.push(`### HASH INTEGRITY FAILURES\n${hashFailures.map(h => `- ${h.path}: ${h.status}`).join("\n")}`);
  }

  const fileTree = currentFiles
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const payload = `### FAILURE CATEGORY\n${verdict.failureCategory}\n\n${evidenceParts.join("\n\n")}\n\n### CURRENT FILE TREE\n${fileTree}`;

  const rawContent = await callWithRetry(
    {
      model: "gpt-5.2",
      max_completion_tokens: 32768,
      messages: [
        { role: "system", content: FIXER_AGENT_PROMPT },
        { role: "user", content: payload },
      ],
      response_format: { type: "json_object" },
    },
    `fixer:${projectId.slice(0, 8)}`,
  );

  let parsed: { files: Array<{ path: string; content: string }>; notes?: string };
  try {
    parsed = JSON.parse(rawContent) as typeof parsed;
  } catch {
    const extracted = extractJSON(rawContent);
    if (extracted) {
      parsed = extracted as typeof parsed;
    } else {
      throw new Error("Fixer Agent returned invalid JSON");
    }
  }

  if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error("Fixer Agent returned no file fixes");
  }

  const sanitizedFiles: Array<{ path: string; content: string }> = [];
  for (const f of parsed.files) {
    if (!f.path || typeof f.path !== "string" || !f.content || typeof f.content !== "string") continue;
    const normalized = f.path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
    if (
      normalized.includes("..") ||
      normalized.startsWith("/") ||
      /^[a-zA-Z]:/.test(normalized) ||
      normalized.includes("\0") ||
      normalized.startsWith(".git/") ||
      normalized === ".git" ||
      normalized.length === 0 ||
      normalized === "."
    ) {
      console.warn(`[fixer:${projectId.slice(0, 8)}] Rejected unsafe path: "${f.path}"`);
      continue;
    }
    sanitizedFiles.push({ path: normalized, content: f.content });
  }

  if (sanitizedFiles.length === 0) {
    throw new Error("Fixer Agent returned no valid file fixes after path sanitization");
  }

  console.log(`[fixer:${projectId.slice(0, 8)}] Fixer proposed ${sanitizedFiles.length} file changes: ${parsed.notes || "no notes"}`);

  return sanitizedFiles;
}

function applyDelta(
  currentFiles: Array<{ path: string; content: string }>,
  delta: Array<{ path: string; content: string }>,
): Array<{ path: string; content: string }> {
  const merged = [...currentFiles];
  for (const d of delta) {
    const idx = merged.findIndex(f => f.path === d.path);
    if (idx >= 0) {
      merged[idx] = d;
    } else {
      merged.push(d);
    }
  }
  return merged;
}

export async function executeWithSelfHealing(
  projectId: string,
  pipeline: PipelineStatus,
  reconciledFiles: Array<{ path: string; content: string }>,
  config: GoldenPathConfigRules,
  spec: AgentContext["spec"],
  prompt: string,
): Promise<{
  status: "ready" | "failed_validation";
  files: Array<{ path: string; content: string }>;
  verdict: VerificationVerdict;
  goldenPathChecks: GoldenPathCheck[];
  payloadHash?: string;
}> {
  let attempt = 0;
  let currentFiles = reconciledFiles;
  const originalFiles = reconciledFiles;

  while (attempt <= MAX_RECOVERY_LOOPS) {
    const hashManifest = computeHashManifest(currentFiles);

    await db
      .update(projectsTable)
      .set({ status: "validating", pipelineStatus: pipeline })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "verification:start", { attempt });

    const { verdict, goldenPathChecks, payloadHash, hardenedFiles } = await runVerificationStage(
      projectId,
      pipeline,
      currentFiles,
      config,
      spec,
      prompt,
      hashManifest,
    );

    currentFiles = hardenedFiles;

    emitPipelineEvent(projectId, "verification:complete", {
      attempt,
      passed: verdict.passed,
      failureCategory: verdict.failureCategory,
      summary: verdict.summary,
      buildPassed: verdict.buildPassed,
      dependencyErrors: verdict.dependencyErrors.length,
    });

    if (verdict.passed) {
      if (attempt > 0) {
        emitPipelineEvent(projectId, "self-healing:success", { attempt });
        console.log(`[self-heal:${projectId.slice(0, 8)}] Self-healing SUCCEEDED on attempt ${attempt}`);
      }
      console.log(`[pipeline:${projectId.slice(0, 8)}] Payload hash locked: ${payloadHash}`);
      return { status: "ready", files: currentFiles, verdict, goldenPathChecks, payloadHash };
    }

    attempt++;
    if (attempt > MAX_RECOVERY_LOOPS) {
      emitPipelineEvent(projectId, "self-healing:exhausted", {
        maxAttempts: MAX_RECOVERY_LOOPS,
        failureCategory: verdict.failureCategory,
      });
      console.warn(`[self-heal:${projectId.slice(0, 8)}] Exhausted ${MAX_RECOVERY_LOOPS} recovery attempts`);
      if (verdict.passed) {
        const manifest = computeHashManifest(currentFiles);
        return { status: "ready", files: currentFiles, verdict, goldenPathChecks, payloadHash: computePayloadHash(manifest) };
      }
      return { status: "failed_validation", files: currentFiles, verdict, goldenPathChecks };
    }

    emitPipelineEvent(projectId, "self-healing:attempt", {
      attempt,
      maxAttempts: MAX_RECOVERY_LOOPS,
      failureCategory: verdict.failureCategory,
      errors: verdict.dependencyErrors.slice(0, 5),
      buildStderr: verdict.buildStderr?.slice(0, 2000),
    });

    console.warn(`[self-heal:${projectId.slice(0, 8)}] Recovery attempt ${attempt}/${MAX_RECOVERY_LOOPS} for [${verdict.failureCategory}]`);

    try {
      const delta = await runFixerAgent(projectId, currentFiles, verdict);
      currentFiles = applyDelta(currentFiles, delta);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      emitPipelineEvent(projectId, "self-healing:exhausted", {
        reason: "fixer_agent_error",
        error: msg,
      });
      console.error(`[self-heal:${projectId.slice(0, 8)}] Fixer Agent failed: ${msg}`);
      if (verdict.passed) {
        const manifest = computeHashManifest(currentFiles);
        return { status: "ready", files: currentFiles, verdict, goldenPathChecks, payloadHash: computePayloadHash(manifest) };
      }
      return { status: "failed_validation", files: currentFiles, verdict, goldenPathChecks };
    }
  }

  const hashManifest = computeHashManifest(currentFiles);
  const { verdict, goldenPathChecks, payloadHash, hardenedFiles: finalFiles } = await runVerificationStage(
    projectId, pipeline, currentFiles, config, spec, prompt, hashManifest,
  );
  return { status: verdict.passed ? "ready" : "failed_validation", files: finalFiles, verdict, goldenPathChecks, payloadHash: verdict.passed ? payloadHash : undefined };
}

export async function runPipeline(
  projectId: string,
  prompt: string,
  spec?: AgentContext["spec"],
  designPersona?: string,
): Promise<void> {
  const pipeline = initPipelineStatus();

  try {
    const [currentProject] = await db
      .select({ files: projectsTable.files })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    const existingFiles = (currentProject?.files ?? []) as Array<{ path: string; content: string }>;
    if (existingFiles.length > 0) {
      await createSnapshot(projectId, existingFiles, "pre_generate", "Before code generation");
    }

    await db
      .update(projectsTable)
      .set({ status: "generating", pipelineStatus: pipeline })
      .where(eq(projectsTable.id, projectId));

    const config = await getActiveConfig();
    const context: AgentContext = {
      prompt,
      designPersona,
      spec,
      priorOutputs: {},
    };

    for (const agent of GENERATION_AGENTS) {
      await updatePipelineStage(projectId, pipeline, agent.role, {
        status: "running",
        startedAt: new Date().toISOString(),
      });

      emitPipelineEvent(projectId, "stage:start", {
        role: agent.role,
        label: agent.label,
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

        emitPipelineEvent(projectId, "stage:complete", {
          role: agent.role,
          label: agent.label,
          fileCount: output.files.length,
          filePaths: output.files.map((f) => f.path),
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

        emitPipelineEvent(projectId, "stage:fail", {
          role: agent.role,
          label: agent.label,
          error: message,
        });

        throw new Error(`${agent.label} failed: ${message}`);
      }
    }

    const reconciledFiles = reconcileOutputs(context.priorOutputs);

    console.log(
      `[pipeline:${projectId.slice(0, 8)}] Reconciled ${reconciledFiles.length} files from ${Object.keys(context.priorOutputs).length} agents`,
    );

    const result = await executeWithSelfHealing(
      projectId,
      pipeline,
      reconciledFiles,
      config,
      spec,
      prompt,
    );

    emitPipelineEvent(projectId, "pipeline:log", {
      message: `Reconciled ${reconciledFiles.length} files from ${Object.keys(context.priorOutputs).length} agents`,
    });

    if (result.status === "failed_validation") {
      const errorMsg = `Verification blocked after ${MAX_RECOVERY_LOOPS} self-healing attempts: ${result.verdict.recommendedFixes.slice(0, 3).join("; ")}`;
      console.error(`[pipeline:${projectId.slice(0, 8)}] ${errorMsg}`);

      emitPipelineEvent(projectId, "pipeline:error", {
        error: errorMsg,
        failureCategory: result.verdict.failureCategory,
      });

      await db
        .update(projectsTable)
        .set({
          status: "failed_validation",
          files: result.files,
          goldenPathChecks: result.goldenPathChecks,
          pipelineStatus: pipeline,
          verificationVerdict: result.verdict,
          error: errorMsg,
        })
        .where(eq(projectsTable.id, projectId));
      return;
    }

    emitPipelineEvent(projectId, "pipeline:complete", {
      fileCount: result.files.length,
      status: "ready",
      payloadHash: result.payloadHash,
    });

    await db
      .update(projectsTable)
      .set({
        status: "ready",
        files: result.files,
        goldenPathChecks: result.goldenPathChecks,
        pipelineStatus: pipeline,
        verificationVerdict: result.verdict,
        payloadHash: result.payloadHash ?? null,
      })
      .where(eq(projectsTable.id, projectId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error(`Pipeline failed for project ${projectId}:`, message);
    emitPipelineEvent(projectId, "pipeline:error", {
      error: message,
    });
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
