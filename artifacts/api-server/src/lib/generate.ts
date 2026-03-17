import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { getActiveConfig, buildSystemPrompt, runGoldenPathChecks } from "./golden-path";
import { callWithRetry } from "./ai-retry";
import { validateAllManifests } from "./dependency-audit";

export async function generateProjectCode(
  projectId: string,
  prompt: string,
  spec?: {
    overview: string;
    fileStructure: string[];
    apiEndpoints: Array<{ method: string; path: string; description: string }>;
    databaseTables: Array<{ name: string; columns: string[] }>;
    middleware: string[];
    architecturalDecisions: string[];
  },
): Promise<void> {
  try {
    await db
      .update(projectsTable)
      .set({ status: "generating" })
      .where(eq(projectsTable.id, projectId));

    const config = await getActiveConfig();
    const systemPrompt = buildSystemPrompt(config);

    let userContent = `Build the following application:\n\n${prompt}\n\n`;

    if (spec) {
      userContent += `### APPROVED ARCHITECTURAL SPEC\nYou MUST follow this approved specification exactly:\n\n`;
      userContent += `**Overview:** ${spec.overview}\n\n`;
      userContent += `**File Structure:** Generate exactly these files:\n${spec.fileStructure.map(f => `- ${f}`).join("\n")}\n\n`;
      userContent += `**API Endpoints:**\n${spec.apiEndpoints.map(e => `- ${e.method} ${e.path} — ${e.description}`).join("\n")}\n\n`;
      userContent += `**Database Tables:**\n${spec.databaseTables.map(t => `- ${t.name}: ${t.columns.join(", ")}`).join("\n")}\n\n`;
      userContent += `**Middleware:** ${spec.middleware.join(", ")}\n\n`;
      userContent += `**Architectural Decisions:** ${spec.architecturalDecisions.join("; ")}\n\n`;
    }

    userContent += `Generate ALL files needed for a complete, working application. Include package.json, server code, client code, and configuration files. Follow the Golden Path rules strictly.`;

    const rawContent = await callWithRetry(
      {
        model: "gpt-5.2",
        max_completion_tokens: 32768,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      },
      `code-gen:${projectId.slice(0, 8)}`,
    );

    let parsed: { files: Array<{ path: string; content: string }> };
    try {
      parsed = JSON.parse(rawContent) as { files: Array<{ path: string; content: string }> };
    } catch {
      throw new Error("AI model returned invalid JSON");
    }

    if (!parsed.files || !Array.isArray(parsed.files)) {
      throw new Error("AI response missing 'files' array");
    }

    const goldenPathChecks = runGoldenPathChecks(parsed.files, config);

    let depAuditCheck = { name: "Dependency Audit", passed: true, description: "All dependencies verified against npm registry and OSV vulnerability database" };
    try {
      const auditResult = await validateAllManifests(parsed.files);
      if (!auditResult.passed) {
        console.warn(`[code-gen:${projectId.slice(0, 8)}] Dependency audit flagged issues:\n${auditResult.errors.join("\n")}`);
        depAuditCheck = {
          name: "Dependency Audit",
          passed: false,
          description: auditResult.errors.join("; "),
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[code-gen:${projectId.slice(0, 8)}] Dependency audit error:`, msg);
      depAuditCheck = { name: "Dependency Audit", passed: false, description: `Audit failed: ${msg}` };
    }
    goldenPathChecks.push(depAuditCheck);

    const hasHallucinatedDeps = depAuditCheck.description.includes("[Hallucination]");
    if (hasHallucinatedDeps) {
      throw new Error(`Dependency audit blocked generation: ${depAuditCheck.description}`);
    }

    await db
      .update(projectsTable)
      .set({
        status: "ready",
        files: parsed.files,
        goldenPathChecks,
      })
      .where(eq(projectsTable.id, projectId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown generation error";
    console.error(`Code generation failed for project ${projectId}:`, message);
    await db
      .update(projectsTable)
      .set({
        status: "failed",
        error: message,
      })
      .where(eq(projectsTable.id, projectId));
  }
}
