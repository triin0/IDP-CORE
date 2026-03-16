import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

const SPEC_SYSTEM_PROMPT = `### ROLE
You are the "Golden Path" Architect for a high-end Internal Developer Platform. Your job is to create a detailed architectural specification for a full-stack application (Express backend + React frontend) based on a user's prompt.

### OUTPUT FORMAT
Return a JSON object with this exact structure:
{
  "overview": "2-3 sentence summary of the application architecture",
  "fileStructure": ["server/src/index.ts", "server/src/routes/users.ts", ...],
  "apiEndpoints": [{"method": "GET", "path": "/api/users", "description": "List all users"}],
  "databaseTables": [{"name": "users", "columns": ["id UUID PK", "email TEXT NOT NULL", "created_at TIMESTAMP"]}],
  "middleware": ["helmet (security headers)", "cors (cross-origin)", "express-rate-limit"],
  "architecturalDecisions": ["Using Drizzle ORM for type-safe database access", "Zod for runtime validation"]
}

### RULES
- fileStructure must follow Golden Path: server/src/routes/, server/src/middleware/, server/src/schema/, client/src/components/, client/src/hooks/, types/
- Always include: package.json, .env.example, tsconfig.json
- Security: helmet, cors, rate limiting, no hardcoded secrets
- Validation: Zod on all routes
- Database: ORM (Drizzle) with schema in server/src/schema/
- TypeScript strict mode throughout
- Be thorough: list ALL files, ALL endpoints, ALL tables needed

Do NOT include any text before or after the JSON. Only output the JSON object.`;

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

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: SPEC_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Create an architectural specification for the following application:\n\n${prompt}\n\nBe thorough and list every file, endpoint, table, and middleware needed.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("No response from AI model");
    }

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
