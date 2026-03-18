import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import type { GoldenPathConfigRules } from "@workspace/db";
import { callWithRetry } from "./ai-retry";
import { getActiveConfig } from "./golden-path";

function buildSpecPrompt(config: GoldenPathConfigRules): string {
  const { techStack, folderStructure, security, codeQuality, database } = config;

  const securityItems: string[] = [];
  if (security.requireHelmet) securityItems.push("helmet");
  if (security.requireCors) securityItems.push("cors");
  if (security.requireRateLimiting) securityItems.push("express-rate-limit");

  const backendDirs = folderStructure.backend.join(", ");
  const frontendDirs = folderStructure.frontend.join(", ");
  const rootFiles = folderStructure.root.join(", ");

  const rules: string[] = [];
  rules.push(`- Follow Golden Path structure: ${backendDirs}, ${frontendDirs}`);
  rules.push(`- Include: ${rootFiles}`);
  if (securityItems.length > 0) {
    rules.push(`- Security: ${securityItems.join(", ")}`);
  }
  rules.push(`- Validation: ${techStack.validation} on all routes`);
  if (database.requireSchema) {
    const schemaDir = folderStructure.backend.find(p => p.includes("schema")) ?? "server/src/schema/";
    rules.push(`- Database: ${techStack.orm} with schema in ${schemaDir}`);
  }
  rules.push("- MANDATORY dependency versions: express ^5.1.0, vite ^6.3.0, react ^19.1.0, typescript ^5.8.0, zod ^3.25.0, drizzle-orm ^0.44.0");
  rules.push("- Use npm workspaces with server/ and client/ directories");
  rules.push("- Keep fileStructure concise (20-40 key files, not every single file)");
  rules.push("- Return ONLY the JSON object, no other text.");

  return `You are the "Golden Path" Architect. Create an architectural spec for a full-stack app (${techStack.backend} + ${techStack.frontend} + ${techStack.language}).

Return ONLY a JSON object with this structure:
{
  "overview": "2-3 sentence summary",
  "fileStructure": ["server/src/index.ts", "server/src/routes/users.ts", "client/src/App.tsx", ...],
  "apiEndpoints": [{"method": "GET", "path": "/api/users", "description": "List all users"}],
  "databaseTables": [{"name": "users", "columns": ["id UUID PK", "email TEXT NOT NULL", "created_at TIMESTAMP"]}],
  "middleware": [${securityItems.map(s => `"${s}"`).join(", ")}],
  "architecturalDecisions": ["${techStack.orm} for type-safe DB access", "${techStack.validation} for validation"]
}

Rules:
${rules.join("\n")}`;
}

interface ProjectSpec {
  overview: string;
  fileStructure: string[];
  apiEndpoints: Array<{ method: string; path: string; description: string }>;
  databaseTables: Array<{ name: string; columns: string[] }>;
  middleware: string[];
  architecturalDecisions: string[];
}

export async function generateProjectSpec(
  projectId: string,
  prompt: string,
): Promise<void> {
  try {
    await db
      .update(projectsTable)
      .set({ status: "planning" })
      .where(eq(projectsTable.id, projectId));

    const config = await getActiveConfig();
    const specPrompt = buildSpecPrompt(config);

    const rawContent = await callWithRetry(
      {
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: specPrompt },
          {
            role: "user",
            content: `Create an architectural specification for: ${prompt}`,
          },
        ],
        response_format: { type: "json_object" },
      },
      `spec-gen:${projectId.slice(0, 8)}`,
    );

    let spec: ProjectSpec;
    try {
      spec = JSON.parse(rawContent) as ProjectSpec;
    } catch {
      throw new Error("AI model returned invalid JSON for spec");
    }

    if (!spec.overview || !spec.fileStructure || !spec.apiEndpoints) {
      throw new Error("AI spec response missing required fields");
    }

    await db
      .update(projectsTable)
      .set({
        status: "planned",
        spec,
      })
      .where(eq(projectsTable.id, projectId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown spec generation error";
    console.error(`Spec generation failed for project ${projectId}:`, message);
    await db
      .update(projectsTable)
      .set({
        status: "failed",
        error: message,
      })
      .where(eq(projectsTable.id, projectId));
  }
}
