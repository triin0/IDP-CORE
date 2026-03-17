import { eq, or } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { generateProjectSpec } from "./spec-generator";
import { generateProjectCode } from "./generate";

export async function recoverOrphanedProjects(): Promise<void> {
  const orphaned = await db
    .select()
    .from(projectsTable)
    .where(
      or(
        eq(projectsTable.status, "planning"),
        eq(projectsTable.status, "generating"),
        eq(projectsTable.status, "validating"),
      ),
    );

  if (orphaned.length === 0) {
    return;
  }

  console.log(`[recovery] Found ${orphaned.length} orphaned project(s), restarting...`);

  for (const project of orphaned) {
    if (project.status === "planning") {
      console.log(`[recovery] Re-running spec generation for ${project.id.slice(0, 8)}`);
      await db
        .update(projectsTable)
        .set({ status: "pending" })
        .where(eq(projectsTable.id, project.id));
      generateProjectSpec(project.id, project.prompt).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[recovery] Spec gen failed for ${project.id.slice(0, 8)}:`, message);
      });
    } else if (project.status === "generating" || project.status === "validating") {
      console.log(`[recovery] Re-running code generation for ${project.id.slice(0, 8)}`);
      const spec = project.spec as {
        overview: string;
        fileStructure: string[];
        apiEndpoints: Array<{ method: string; path: string; description: string }>;
        databaseTables: Array<{ name: string; columns: string[] }>;
        middleware: string[];
        architecturalDecisions: string[];
      } | null;
      generateProjectCode(project.id, project.prompt, spec ?? undefined).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[recovery] Code gen failed for ${project.id.slice(0, 8)}:`, message);
      });
    }
  }
}
