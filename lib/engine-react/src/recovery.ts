import { eq, or } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { generateProjectSpec } from "./spec-generator";
import { generateProjectCode } from "./generate";

export async function recoverOrphanedProjects(): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

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

  const recent = orphaned.filter((p) => p.createdAt > cutoff);
  const stale = orphaned.filter((p) => p.createdAt <= cutoff);

  if (stale.length > 0) {
    console.log(`[recovery] Marking ${stale.length} stale orphaned project(s) as failed`);
    for (const p of stale) {
      await db
        .update(projectsTable)
        .set({ status: "failed", error: "Pipeline interrupted (server restart). Project too old for automatic recovery." })
        .where(eq(projectsTable.id, p.id))
        .catch(() => {});
    }
  }

  if (recent.length === 0) {
    return;
  }

  console.log(`[recovery] Found ${recent.length} recent orphaned project(s), restarting...`);

  for (const project of recent) {
    try {
      if (project.status === "planning") {
        console.log(`[recovery] Re-running spec generation for ${project.id.slice(0, 8)}`);
        await db
          .update(projectsTable)
          .set({ status: "pending" })
          .where(eq(projectsTable.id, project.id));
        await generateProjectSpec(project.id, project.prompt);
        console.log(`[recovery] Spec gen completed for ${project.id.slice(0, 8)}`);
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
        await generateProjectCode(project.id, project.prompt, spec ?? undefined);
        console.log(`[recovery] Code gen completed for ${project.id.slice(0, 8)}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[recovery] Recovery failed for ${project.id.slice(0, 8)}: ${message}`);
      await db
        .update(projectsTable)
        .set({ status: "failed", error: `Recovery failed: ${message}` })
        .where(eq(projectsTable.id, project.id))
        .catch((dbErr: unknown) => {
          console.error(`[recovery] Failed to update status for ${project.id.slice(0, 8)}:`, dbErr);
        });
    }
  }
}
