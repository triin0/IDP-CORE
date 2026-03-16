import { eq } from "drizzle-orm";
import { db, projectsTable, type Project } from "@workspace/db";
import * as fs from "fs/promises";
import * as path from "path";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../../..");
const DEPLOY_BASE_DIR = path.resolve(WORKSPACE_ROOT, "deployed-projects");

export interface DeployResult {
  id: string;
  status: "deployed";
  deployUrl: string;
}

export async function deployProject(project: Project): Promise<DeployResult> {
  const files = project.files as Array<{ path: string; content: string }> | null;
  if (!files || files.length === 0) {
    throw new Error("No files to deploy");
  }

  const projectDir = path.join(DEPLOY_BASE_DIR, project.id);
  await fs.mkdir(projectDir, { recursive: true });

  for (const file of files) {
    const filePath = path.join(projectDir, file.path);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, file.content, "utf-8");
  }

  const domains = process.env["REPLIT_DOMAINS"] ?? process.env["REPLIT_DEV_DOMAIN"] ?? "localhost";
  const primaryDomain = domains.split(",")[0]?.trim() ?? "localhost";
  const protocol = primaryDomain === "localhost" ? "http" : "https";
  const deployUrl = `${protocol}://${primaryDomain}/deployed/${project.id}`;

  await db
    .update(projectsTable)
    .set({ status: "deployed", deployUrl })
    .where(eq(projectsTable.id, project.id));

  return {
    id: project.id,
    status: "deployed",
    deployUrl,
  };
}
