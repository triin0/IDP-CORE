import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import archiver from "archiver";
import { db, projectsTable } from "@workspace/db";
import { computeFullTreeManifest, computePayloadHash } from "../lib/hash-integrity";
import {
  getAuthenticatedUser,
  createRepository,
  commitFileTree,
  generateVerifyWorkflow,
} from "../lib/github";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

async function loadOwnedProject(req: Request, res: Response, id: string) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return null;
  }

  if (project.userId && project.userId !== req.user!.id) {
    res.status(403).json({ error: "Not authorized to access this project" });
    return null;
  }

  return project;
}

function getProjectFiles(project: { files: unknown }): Array<{ path: string; content: string }> {
  const files = project.files as Array<{ path: string; content: string }> | null;
  if (!files || files.length === 0) {
    throw new Error("Project has no generated files");
  }
  return files;
}

function buildVerificationAudit(
  project: { id: string; prompt: string; goldenPathChecks: unknown; payloadHash: unknown; spec: unknown },
  files: Array<{ path: string; content: string }>,
) {
  const manifest = computeFullTreeManifest(files);
  const payloadHash = computePayloadHash(manifest);

  return {
    projectId: project.id,
    prompt: project.prompt,
    exportedAt: new Date().toISOString(),
    verification: {
      payloadHash,
      storedPayloadHash: project.payloadHash ?? null,
      hashMatch: project.payloadHash === payloadHash,
      fileCount: files.length,
      sha256Manifest: manifest,
    },
    goldenPathChecks: project.goldenPathChecks ?? [],
  };
}

router.post("/projects/:id/export-zip", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    if (project.status !== "ready" && project.status !== "deployed") {
      res.status(400).json({
        error: `Cannot export project. Status is '${project.status}', expected 'ready' or 'deployed'.`,
      });
      return;
    }

    const files = getProjectFiles(project);
    const audit = buildVerificationAudit(project, files);
    const manifest = computeFullTreeManifest(files);

    const projectName = project.prompt.slice(0, 40).replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "project";

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${projectName}-${id.slice(0, 8)}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    for (const file of files) {
      archive.append(file.content, { name: file.path });
    }

    archive.append(JSON.stringify(audit, null, 2), { name: "verification-audit.json" });
    archive.append(JSON.stringify(manifest, null, 2), { name: "sha256-manifest.json" });

    await archive.finalize();

    console.log(`[export] ZIP export completed for project ${id.slice(0, 8)} (${files.length} files)`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed";
    console.error("Failed to export ZIP:", message);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

router.post("/projects/:id/export-to-github", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    if (project.status !== "ready" && project.status !== "deployed") {
      res.status(400).json({
        error: `Cannot export project. Status is '${project.status}', expected 'ready' or 'deployed'.`,
      });
      return;
    }

    const files = getProjectFiles(project);
    const audit = buildVerificationAudit(project, files);
    const manifest = computeFullTreeManifest(files);

    let ghUser;
    try {
      ghUser = await getAuthenticatedUser();
    } catch {
      res.status(401).json({
        error: "GitHub not connected. Please connect your GitHub account via the integrations panel.",
      });
      return;
    }

    const derivedName = project.prompt
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
    const repoName =
      (req.body?.repoName as string) ??
      (derivedName || `idp-project-${id.slice(0, 8)}`);

    const isPrivate = req.body?.private !== false;

    let repo;
    try {
      repo = await createRepository(
        repoName,
        `Generated by IDP.CORE — ${project.prompt.slice(0, 100)}`,
        isPrivate,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("422") || msg.includes("name already exists")) {
        res.status(409).json({
          error: `Repository '${repoName}' already exists. Choose a different name.`,
          suggestion: `${repoName}-${id.slice(0, 8)}`,
        });
        return;
      }
      throw err;
    }

    const allFiles: Array<{ path: string; content: string }> = [
      ...files,
      { path: "verification-audit.json", content: JSON.stringify(audit, null, 2) },
      { path: "sha256-manifest.json", content: JSON.stringify(manifest, null, 2) },
      { path: ".github/workflows/verify.yml", content: generateVerifyWorkflow() },
    ];

    const result = await commitFileTree(
      ghUser.login,
      repoName,
      allFiles,
      `feat: initial project generated by IDP.CORE\n\nPrompt: ${project.prompt.slice(0, 200)}\nPayload Hash: ${audit.verification.payloadHash}\nGolden Path Score: ${Array.isArray(project.goldenPathChecks) ? `${(project.goldenPathChecks as Array<{ passed: boolean }>).filter((c) => c.passed).length}/${(project.goldenPathChecks as Array<unknown>).length}` : "N/A"}`,
    );

    console.log(`[export] GitHub export completed for project ${id.slice(0, 8)} → ${ghUser.login}/${repoName}`);

    res.json({
      repository: repo.full_name,
      url: result.htmlUrl,
      commitSha: result.sha,
      filesCommitted: allFiles.length,
      branch: "main",
      verificationIncluded: true,
      ciPipelineIncluded: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "GitHub export failed";
    console.error("Failed to export to GitHub:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/github/status", requireAuth, async (_req, res) => {
  try {
    const user = await getAuthenticatedUser();
    res.json({ connected: true, login: user.login, name: user.name });
  } catch {
    res.json({ connected: false });
  }
});

export default router;
