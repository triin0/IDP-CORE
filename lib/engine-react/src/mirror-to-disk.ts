import { db, projectsTable } from "../../../lib/db/src/index.ts";
import { desc, eq } from "drizzle-orm";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "active-build");

async function mirror() {
  const projectId = process.argv[2];

  let project;
  if (projectId) {
    const [row] = await db
      .select({ id: projectsTable.id, status: projectsTable.status, files: projectsTable.files })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    project = row;
  } else {
    const [row] = await db
      .select({ id: projectsTable.id, status: projectsTable.status, files: projectsTable.files })
      .from(projectsTable)
      .orderBy(desc(projectsTable.createdAt))
      .limit(1);
    project = row;
  }

  if (!project) {
    console.error("No project found.");
    process.exit(1);
  }

  const files = (project.files ?? []) as Array<{ path: string; content: string }>;
  if (files.length === 0) {
    console.error(`Project ${project.id} has no files.`);
    process.exit(1);
  }

  console.log(`Mirroring project ${project.id} (status: ${project.status}) — ${files.length} files`);

  try {
    await rm(OUTPUT_DIR, { recursive: true, force: true });
  } catch {}

  for (const file of files) {
    const fullPath = join(OUTPUT_DIR, file.path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content, "utf-8");
  }

  console.log(`Wrote ${files.length} files to ${OUTPUT_DIR}/`);
  process.exit(0);
}

mirror().catch((err) => {
  console.error("Mirror failed:", err);
  process.exit(1);
});
