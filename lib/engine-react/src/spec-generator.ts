import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import type { GoldenPathConfigRules } from "@workspace/db";
import { callWithRetry } from "@workspace/engine-common";
import { getActiveConfig } from "./golden-path";
import { getPersonaStyleTokens } from "./design-personas";

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
  rules.push(`- ADMIN DASHBOARD: Every app MUST include a built-in Admin Dashboard. Add these to apiEndpoints:
    - GET /api/admin/:table — list all rows for a given table
    - GET /api/admin/:table/:id — get single row
    - POST /api/admin/:table — create a new row
    - PUT /api/admin/:table/:id — update a row
    - DELETE /api/admin/:table/:id — delete a row
  Add "client/src/pages/AdminDashboard.tsx" and "server/src/routes/admin.ts" to the fileStructure.
  Add "Built-in Admin Dashboard with form-based CRUD for all database entities" to architecturalDecisions.`);

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
  designPersona?: string,
): Promise<void> {
  try {
    await db
      .update(projectsTable)
      .set({ status: "planning" })
      .where(eq(projectsTable.id, projectId));

    const config = await getActiveConfig();
    const specPrompt = buildSpecPrompt(config);

    const personaTokens = getPersonaStyleTokens(designPersona);
    const userContent = personaTokens
      ? `Create an architectural specification for: ${prompt}\n\n${personaTokens}\n\nInclude the design persona name "${designPersona}" in your architecturalDecisions so downstream agents can reference it.`
      : `Create an architectural specification for: ${prompt}`;

    const rawContent = await callWithRetry(
      {
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: specPrompt },
          {
            role: "user",
            content: userContent,
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

    const adminEndpoints = [
      { method: "GET", path: "/api/admin/:table", description: "List all rows for a database table (Admin)" },
      { method: "GET", path: "/api/admin/:table/:id", description: "Get single row by ID (Admin)" },
      { method: "POST", path: "/api/admin/:table", description: "Create a new row (Admin)" },
      { method: "PUT", path: "/api/admin/:table/:id", description: "Update a row (Admin)" },
      { method: "DELETE", path: "/api/admin/:table/:id", description: "Delete a row (Admin)" },
    ];
    const hasAdminEndpoints = spec.apiEndpoints.some(e => e.path.includes("/admin"));
    if (!hasAdminEndpoints) {
      spec.apiEndpoints.push(...adminEndpoints);
    }

    const adminFiles = ["server/src/routes/admin.ts", "client/src/pages/AdminDashboard.tsx"];
    for (const af of adminFiles) {
      if (!spec.fileStructure.includes(af)) {
        spec.fileStructure.push(af);
      }
    }

    const adminDecision = "Built-in Admin Dashboard with form-based CRUD for all database entities";
    if (!spec.architecturalDecisions) spec.architecturalDecisions = [];
    if (!spec.architecturalDecisions.some(d => d.toLowerCase().includes("admin"))) {
      spec.architecturalDecisions.push(adminDecision);
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
