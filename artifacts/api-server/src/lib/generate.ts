import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { GOLDEN_PATH_SYSTEM_PROMPT, runGoldenPathChecks } from "./golden-path";
import { callWithRetry } from "./ai-retry";

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
          { role: "system", content: GOLDEN_PATH_SYSTEM_PROMPT },
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

    const goldenPathChecks = runGoldenPathChecks(parsed.files);

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
