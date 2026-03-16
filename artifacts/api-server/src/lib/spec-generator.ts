import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { callWithRetry } from "./ai-retry";

const SPEC_SYSTEM_PROMPT = `You are the "Golden Path" Architect. Create an architectural spec for a full-stack app (Express + React + TypeScript).

Return ONLY a JSON object with this structure:
{
  "overview": "2-3 sentence summary",
  "fileStructure": ["server/src/index.ts", "server/src/routes/users.ts", "client/src/App.tsx", ...],
  "apiEndpoints": [{"method": "GET", "path": "/api/users", "description": "List all users"}],
  "databaseTables": [{"name": "users", "columns": ["id UUID PK", "email TEXT NOT NULL", "created_at TIMESTAMP"]}],
  "middleware": ["helmet", "cors", "express-rate-limit"],
  "architecturalDecisions": ["Drizzle ORM for type-safe DB access", "Zod for validation"]
}

Rules:
- Follow Golden Path structure: server/src/routes/, server/src/middleware/, server/src/schema/, client/src/components/, client/src/hooks/
- Include: package.json, .env.example, tsconfig.json
- Security: helmet, cors, rate limiting
- Validation: Zod on all routes
- Database: Drizzle ORM with schema in server/src/schema/
- Keep fileStructure concise (20-40 key files, not every single file)
- Return ONLY the JSON object, no other text.`;

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

    const rawContent = await callWithRetry(
      {
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: SPEC_SYSTEM_PROMPT },
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
