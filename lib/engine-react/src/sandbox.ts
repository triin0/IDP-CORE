import { CodeSandbox } from "@codesandbox/sdk";
import { eq, and, lt } from "drizzle-orm";
import { db, projectsTable, type Project } from "@workspace/db";

let sdkInstance: CodeSandbox | null = null;

function getSandboxApiKey(): string | undefined {
  return process.env["CSB_API_KEY"] || process.env["codesandbox_api"];
}

function getSDK(): CodeSandbox {
  const apiKey = getSandboxApiKey();
  if (!apiKey) {
    throw new Error("CodeSandbox API key not set (CSB_API_KEY or codesandbox_api)");
  }
  if (!sdkInstance) {
    sdkInstance = new CodeSandbox(apiKey);
  }
  return sdkInstance;
}

export function isSandboxConfigured(): boolean {
  return !!getSandboxApiKey();
}

export interface SandboxResult {
  sandboxId: string;
  previewUrl: string;
}

function sanitizePath(p: string): string {
  return p.replace(/[^a-zA-Z0-9_./-]/g, "");
}

export async function createSandboxForProject(project: Project): Promise<SandboxResult> {
  const sdk = getSDK();
  const files = project.files as Array<{ path: string; content: string }> | null;

  if (!files || files.length === 0) {
    throw new Error("No files to deploy to sandbox");
  }

  console.log(`[sandbox] Creating sandbox for project ${project.id.slice(0, 8)}...`);

  const sandbox = await sdk.sandboxes.create({
    privacy: "public" as "public",
    hibernationTimeoutSeconds: 3600,
  });

  const sandboxId = sandbox.id;
  console.log(`[sandbox] Sandbox created: ${sandboxId}`);

  let client;
  try {
    client = await sandbox.connect();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sandbox] Failed to connect to sandbox ${sandboxId}: ${msg}`);
    await shutdownSandbox(sandboxId);
    throw new Error(`Sandbox connection failed: ${msg}`);
  }

  try {
    const batchFiles = files.map((f) => ({
      path: sanitizePath(f.path),
      content: f.content,
    }));

    await client.fs.batchWrite(batchFiles);
    console.log(`[sandbox] Wrote ${batchFiles.length} files to sandbox`);

    const pkgFile = files.find(
      (f) => f.path === "package.json" || f.path === "server/package.json",
    );

    if (pkgFile) {
      const pkgDir = pkgFile.path.includes("/")
        ? sanitizePath(pkgFile.path.substring(0, pkgFile.path.lastIndexOf("/")))
        : ".";

      console.log(`[sandbox] Running npm install in ${pkgDir}...`);
      try {
        await client.commands.run("npm install", {
          cwd: `/project/workspace/${pkgDir}`,
        });
        console.log(`[sandbox] npm install completed`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[sandbox] npm install warning: ${msg}`);
      }
    }

    const clientPkgFile = files.find((f) => f.path === "client/package.json");
    if (clientPkgFile) {
      console.log(`[sandbox] Running npm install in client/...`);
      try {
        await client.commands.run("npm install", {
          cwd: "/project/workspace/client",
        });
        console.log(`[sandbox] client npm install completed`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[sandbox] client npm install warning: ${msg}`);
      }
    }

    const previewUrl = `https://${sandboxId}-3000.csb.app`;

    const startScript = files.find((f) => f.path === "package.json");
    if (startScript) {
      try {
        const pkg = JSON.parse(startScript.content);
        if (pkg.scripts?.dev || pkg.scripts?.start) {
          const cmd = pkg.scripts.dev ? "npm run dev" : "npm start";
          console.log(`[sandbox] Starting app with: ${cmd}`);
          client.commands.run(cmd, {
            cwd: "/project/workspace",
          }).catch(() => {});
        }
      } catch {}
    }

    await db
      .update(projectsTable)
      .set({
        status: "deployed",
        sandboxId,
        deployUrl: previewUrl,
      })
      .where(eq(projectsTable.id, project.id));

    console.log(`[sandbox] Project ${project.id.slice(0, 8)} deployed to ${previewUrl}`);

    return { sandboxId, previewUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sandbox] Sandbox setup failed for ${sandboxId}: ${msg}`);
    await shutdownSandbox(sandboxId);
    throw err;
  }
}

export async function shutdownSandbox(sandboxId: string): Promise<void> {
  try {
    const sdk = getSDK();
    await sdk.sandboxes.shutdown(sandboxId);
    console.log(`[sandbox] Shutdown sandbox: ${sandboxId}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[sandbox] Failed to shutdown sandbox ${sandboxId}: ${msg}`);
  }
}

export async function deleteSandbox(sandboxId: string): Promise<boolean> {
  if (!isSandboxConfigured()) return true;
  try {
    const sdk = getSDK();
    await sdk.sandboxes.shutdown(sandboxId);
    console.log(`[sandbox] Deleted sandbox: ${sandboxId}`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sandbox] Failed to delete sandbox ${sandboxId}: ${msg}`);
    return false;
  }
}

export async function cleanupStaleSandboxes(maxAgeHours: number = 72): Promise<number> {
  if (!isSandboxConfigured()) return 0;

  const { isNotNull } = await import("drizzle-orm");
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const staleProjects = await db
    .select({ id: projectsTable.id, sandboxId: projectsTable.sandboxId })
    .from(projectsTable)
    .where(
      and(
        lt(projectsTable.createdAt, cutoff),
        eq(projectsTable.status, "deployed"),
        isNotNull(projectsTable.sandboxId),
      ),
    );

  let cleaned = 0;
  for (const project of staleProjects) {
    if (!project.sandboxId) continue;

    const deleted = await deleteSandbox(project.sandboxId);
    if (deleted) {
      await db
        .update(projectsTable)
        .set({
          status: "ready",
          sandboxId: null,
          deployUrl: null,
        })
        .where(eq(projectsTable.id, project.id));
      cleaned++;
      console.log(`[sandbox-cleanup] Cleaned stale sandbox for project ${project.id.slice(0, 8)}`);
    } else {
      console.warn(`[sandbox-cleanup] Skipped DB cleanup for project ${project.id.slice(0, 8)} — sandbox deletion failed`);
    }
  }

  console.log(`[sandbox-cleanup] Cleaned ${cleaned} stale sandboxes (cutoff: ${cutoff.toISOString()})`);
  return cleaned;
}
