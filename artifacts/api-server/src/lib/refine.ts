import { eq } from "drizzle-orm";
import { db, projectsTable, type Project } from "@workspace/db";
import { callWithRetry } from "./ai-retry";
import { getActiveConfig, runGoldenPathChecks, getCriticalFailures, buildSystemPrompt } from "./golden-path";
import type { GoldenPathCheck } from "./golden-path";
import { validateAllManifests } from "./dependency-audit";

interface RefinementRecord {
  prompt: string;
  response: string;
  timestamp: string;
  filesChanged: string[];
  goldenPathScore: string;
}

interface RefinementResult {
  files: Array<{ path: string; content: string }>;
  goldenPathChecks: GoldenPathCheck[];
  filesChanged: string[];
  status: string;
  refinement: RefinementRecord;
}

function sanitizePath(filePath: string): string | null {
  const normalized = filePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");

  if (
    normalized.includes("..") ||
    normalized.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.includes("\0")
  ) {
    return null;
  }

  if (normalized.length === 0 || normalized === ".") {
    return null;
  }

  return normalized;
}

function buildRefinementPrompt(
  existingFiles: Array<{ path: string; content: string }>,
  refinementPrompt: string,
  goldenPathSystemPrompt: string,
): string {
  const fileList = existingFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  return `${goldenPathSystemPrompt}

### REFINEMENT MODE
You are refining an EXISTING project. The user wants to modify or extend it.

### EXISTING PROJECT FILES
${fileList}

### USER'S REFINEMENT REQUEST
"${refinementPrompt}"

### INSTRUCTIONS
1. Analyze the existing project and the user's request
2. Return ONLY the files that need to be CHANGED or ADDED — do NOT include unchanged files
3. For modified files, return the COMPLETE new content (not a diff)
4. Preserve existing patterns, naming conventions, and architecture
5. Ensure all Golden Path compliance rules are still met after your changes
6. If adding a new feature, integrate it with existing code (update routes, types, etc.)

### OUTPUT FORMAT
Return a JSON object with a \`files\` array. Each object must have \`path\` (string) and \`content\` (string).
Only include files you are changing or creating. Do NOT include files that remain unchanged.
Do NOT include any text before or after the JSON. Only output the JSON object.`;
}

export async function refineProject(
  projectId: string,
  refinementPrompt: string,
): Promise<RefinementResult> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.status !== "ready" && project.status !== "deployed") {
    throw new Error(
      `Cannot refine project in '${project.status}' status. Project must be 'ready' or 'deployed'.`,
    );
  }

  const existingFiles = (project.files ?? []) as Array<{
    path: string;
    content: string;
  }>;

  if (existingFiles.length === 0) {
    throw new Error("Project has no files to refine");
  }

  const config = await getActiveConfig();
  const systemPrompt = buildSystemPrompt(config);
  const prompt = buildRefinementPrompt(
    existingFiles,
    refinementPrompt,
    systemPrompt,
  );

  console.log(
    `[refine:${projectId.slice(0, 8)}] Starting refinement: "${refinementPrompt.slice(0, 80)}..."`,
  );

  await db
    .update(projectsTable)
    .set({ status: "generating" })
    .where(eq(projectsTable.id, projectId));

  try {
    const rawContent = await callWithRetry(
      {
        model: "gpt-5.2",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 32768,
      },
      "refine",
    );

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI response did not contain valid JSON");
    }

    let parsed: { files: Array<{ path: string; content: string }> };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    if (
      !parsed.files ||
      !Array.isArray(parsed.files) ||
      parsed.files.length === 0
    ) {
      throw new Error(
        "AI response contained no files — the refinement may have been too vague",
      );
    }

    const deltaFiles: Array<{ path: string; content: string }> = [];
    for (const f of parsed.files) {
      if (!f.path || typeof f.path !== "string" || !f.content || typeof f.content !== "string") {
        continue;
      }
      const safePath = sanitizePath(f.path);
      if (!safePath) {
        console.warn(`[refine:${projectId.slice(0, 8)}] Rejected unsafe path: "${f.path}"`);
        continue;
      }
      deltaFiles.push({ path: safePath, content: f.content });
    }

    if (deltaFiles.length === 0) {
      throw new Error("AI returned no valid file changes — try rephrasing your refinement request");
    }

    const changedPaths = deltaFiles.map((f) => f.path);

    const mergedFiles = [...existingFiles];
    for (const delta of deltaFiles) {
      const existingIdx = mergedFiles.findIndex((f) => f.path === delta.path);
      if (existingIdx >= 0) {
        mergedFiles[existingIdx] = delta;
      } else {
        mergedFiles.push(delta);
      }
    }

    console.log(
      `[refine:${projectId.slice(0, 8)}] Merged ${deltaFiles.length} changed files (${changedPaths.join(", ")})`,
    );

    const goldenPathChecks = runGoldenPathChecks(mergedFiles, config);

    let depAuditCheck: GoldenPathCheck = {
      name: "Dependency Audit",
      passed: true,
      description:
        "All dependencies verified against npm registry and OSV vulnerability database",
    };
    try {
      const auditResult = await validateAllManifests(mergedFiles);
      if (!auditResult.passed) {
        depAuditCheck = {
          name: "Dependency Audit",
          passed: false,
          description: auditResult.errors.join("; "),
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      depAuditCheck = {
        name: "Dependency Audit",
        passed: false,
        description: `Audit failed: ${msg}`,
      };
    }
    goldenPathChecks.push(depAuditCheck);

    const passed = goldenPathChecks.filter((c) => c.passed).length;
    const total = goldenPathChecks.length;
    const goldenPathScore = `${passed}/${total}`;

    const modifiedCount = deltaFiles.filter((d) =>
      existingFiles.some((f) => f.path === d.path),
    ).length;
    const addedCount = deltaFiles.length - modifiedCount;
    const responseParts: string[] = [];
    if (modifiedCount > 0) responseParts.push(`Modified ${modifiedCount} file${modifiedCount > 1 ? "s" : ""}`);
    if (addedCount > 0) responseParts.push(`Added ${addedCount} new file${addedCount > 1 ? "s" : ""}`);
    responseParts.push(`(${changedPaths.join(", ")})`);
    responseParts.push(`Golden Path: ${goldenPathScore}`);
    const responseSummary = responseParts.join(". ") + ".";

    const refinement: RefinementRecord = {
      prompt: refinementPrompt,
      response: responseSummary,
      timestamp: new Date().toISOString(),
      filesChanged: changedPaths,
      goldenPathScore,
    };

    const existingRefinements = (project.refinements ?? []) as RefinementRecord[];

    const previousStatus = project.status;
    const criticalFailures = getCriticalFailures(goldenPathChecks);
    const hasHallucinatedDeps = goldenPathChecks.some(
      (c) => c.name === "Dependency Audit" && !c.passed,
    );

    let resolvedStatus: "ready" | "deployed" | "failed_checks";
    if (criticalFailures.length > 0 || hasHallucinatedDeps) {
      resolvedStatus = "failed_checks";
      console.warn(
        `[refine:${projectId.slice(0, 8)}] Critical check failures after refinement: ${criticalFailures.map((c) => c.name).join(", ")}${hasHallucinatedDeps ? " + Dependency Audit" : ""}`,
      );
    } else {
      resolvedStatus = previousStatus === "deployed" ? "deployed" : "ready";
    }

    await db
      .update(projectsTable)
      .set({
        status: resolvedStatus,
        files: mergedFiles,
        goldenPathChecks,
        refinements: [...existingRefinements, refinement],
        error: criticalFailures.length > 0
          ? `Refinement failed critical checks: ${criticalFailures.map((c) => c.name).join(", ")}`
          : null,
      })
      .where(eq(projectsTable.id, projectId));

    console.log(
      `[refine:${projectId.slice(0, 8)}] Refinement complete: ${changedPaths.length} files changed, Golden Path ${goldenPathScore}, status=${resolvedStatus}`,
    );

    return {
      files: mergedFiles,
      goldenPathChecks,
      filesChanged: changedPaths,
      status: resolvedStatus,
      refinement,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[refine:${projectId.slice(0, 8)}] Refinement failed: ${message}`,
    );

    await db
      .update(projectsTable)
      .set({
        status: project.status,
        error: `Refinement failed: ${message}`,
      })
      .where(eq(projectsTable.id, projectId));

    throw err;
  }
}
