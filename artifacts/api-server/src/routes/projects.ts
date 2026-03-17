import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, desc, count, and } from "drizzle-orm";
import { db, projectsTable, CREDIT_COSTS } from "@workspace/db";
import {
  CreateProjectBody,
  GetProjectParams,
  DeployProjectParams,
  ListProjectsQueryParams,
  ApproveSpecParams,
  RegenerateSpecParams,
  UpdateSpecParams,
  UpdateSpecBody,
  RefineProjectParams,
  RefineProjectBody,
} from "@workspace/api-zod";
import { generateProjectCode } from "../lib/generate";
import { generateProjectSpec } from "../lib/spec-generator";
import { deployProject, generatePreviewHtml } from "../lib/deploy";
import { refineProject } from "../lib/refine";
import { deleteSandbox, cleanupStaleSandboxes } from "../lib/sandbox";
import { pipelineEvents, type PipelineEvent } from "../lib/pipeline-events";
import { reserveCredits, settleCredits, refundCredits, CreditError } from "../lib/credits";
import type { CreditReservation } from "../lib/credits";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

async function loadOwnedProject(req: Request, res: Response, id: string) {
  if (!UUID_REGEX.test(id)) {
    res.status(404).json({ error: "Project not found" });
    return null;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return null;
  }

  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  if (project.userId && project.userId !== req.user.id) {
    res.status(403).json({ error: "Access denied" });
    return null;
  }

  return project;
}

const pendingReservations = new Map<string, CreditReservation>();

interface GoldenPathCheckRecord {
  name: string;
  passed: boolean;
  description: string;
  critical?: boolean;
}

router.get("/projects/:id/stream", requireAuth, (req, res) => {
  const { id } = req.params;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`data: ${JSON.stringify({ type: "connected", projectId: id, timestamp: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  const listener = (event: PipelineEvent) => {
    if (event.projectId !== id) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);

    if (event.type === "pipeline:complete" || event.type === "pipeline:error") {
      setTimeout(() => {
        clearInterval(heartbeat);
        res.end();
      }, 500);
    }
  };

  pipelineEvents.onPipeline(listener);

  req.on("close", () => {
    clearInterval(heartbeat);
    pipelineEvents.offPipeline(listener);
  });
});

interface FileRecord {
  path: string;
  content: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/projects", requireAuth, async (req, res) => {
  let limit: number;
  let offset: number;
  try {
    const parsed = ListProjectsQueryParams.parse(req.query);
    limit = parsed.limit ?? 20;
    offset = parsed.offset ?? 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid query parameters";
    res.status(400).json({ error: message });
    return;
  }

  try {
    const userId = req.user!.id;
    const whereClause = eq(projectsTable.userId, userId);

    const [totalResult] = await db.select({ value: count() }).from(projectsTable).where(whereClause);
    const total = totalResult?.value ?? 0;

    const projects = await db
      .select()
      .from(projectsTable)
      .where(whereClause)
      .orderBy(desc(projectsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const summaries = projects.map((p) => {
      const files = (p.files ?? []) as FileRecord[];
      const checks = (p.goldenPathChecks ?? []) as GoldenPathCheckRecord[];
      const passed = checks.filter((c) => c.passed).length;
      const checkTotal = checks.length;

      return {
        id: p.id,
        prompt: p.prompt,
        status: p.status,
        fileCount: files.length,
        goldenPathScore: `${passed}/${checkTotal}`,
        deployUrl: p.deployUrl,
        createdAt: p.createdAt.toISOString(),
        error: p.error,
      };
    });

    res.json({ projects: summaries, total, limit, offset });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list projects";
    console.error("Failed to list projects:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/projects/cleanup-sandboxes", requireAuth, async (_req, res) => {
  try {
    const cleaned = await cleanupStaleSandboxes(72);
    res.json({ cleaned, message: `Cleaned ${cleaned} stale sandbox(es) older than 72 hours` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cleanup failed";
    console.error("Failed to cleanup sandboxes:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/projects", requireAuth, async (req, res) => {
  try {
    const body = CreateProjectBody.parse(req.body);

    const [project] = await db
      .insert(projectsTable)
      .values({ prompt: body.prompt, userId: req.user!.id })
      .returning();

    generateProjectSpec(project.id, body.prompt).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Spec generation failed for project ${project.id}:`, message);
    });

    res.status(201).json({ id: project.id, status: project.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    console.error("Failed to create project:", message);
    res.status(400).json({ error: message });
  }
});

router.get("/projects/:id", requireAuth, async (req, res) => {
  try {
    const { id } = GetProjectParams.parse(req.params);

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    res.json({
      id: project.id,
      prompt: project.prompt,
      status: project.status,
      spec: project.spec ?? undefined,
      files: project.files ?? [],
      goldenPathChecks: project.goldenPathChecks ?? [],
      pipelineStatus: project.pipelineStatus ?? undefined,
      verificationVerdict: project.verificationVerdict ?? undefined,
      deployUrl: project.deployUrl,
      sandboxId: project.sandboxId,
      refinements: project.refinements ?? [],
      createdAt: project.createdAt.toISOString(),
      error: project.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    console.error("Failed to get project:", message);
    res.status(400).json({ error: message });
  }
});

router.post("/projects/:id/approve-spec", requireAuth, async (req, res) => {
  try {
    const { id } = ApproveSpecParams.parse(req.params);

    const owned = await loadOwnedProject(req, res, id);
    if (!owned) return;

    let reservation: CreditReservation;
    try {
      reservation = await reserveCredits(
        req.user!.id,
        CREDIT_COSTS.generation,
        "generation",
        id,
      );
    } catch (err: unknown) {
      if (err instanceof CreditError) {
        res.status(402).json({
          error: "Insufficient credits",
          required: err.requiredAmount,
          balance: err.currentBalance,
        });
        return;
      }
      throw err;
    }

    pendingReservations.set(id, reservation);

    const result = await db
      .update(projectsTable)
      .set({ status: "generating" })
      .where(
        and(
          eq(projectsTable.id, id),
          eq(projectsTable.status, "planned"),
        ),
      )
      .returning();

    if (result.length === 0) {
      await refundCredits(reservation, "spec_not_planned");
      pendingReservations.delete(id);

      const [existing] = await db
        .select({ status: projectsTable.status })
        .from(projectsTable)
        .where(eq(projectsTable.id, id));

      if (!existing) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      res.status(400).json({
        error: `Cannot approve spec. Project status is '${existing.status}', expected 'planned'.`,
      });
      return;
    }

    const project = result[0];

    const spec = project.spec as {
      overview: string;
      fileStructure: string[];
      apiEndpoints: Array<{ method: string; path: string; description: string }>;
      databaseTables: Array<{ name: string; columns: string[] }>;
      middleware: string[];
      architecturalDecisions: string[];
    } | null;

    generateProjectCode(project.id, project.prompt, spec ?? undefined)
      .then(() => {
        const r = pendingReservations.get(id);
        if (r) {
          settleCredits(r).catch(e => console.error(`[credits] Failed to settle for ${id}:`, e));
          pendingReservations.delete(id);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Generation failed for project ${project.id}:`, message);
        const r = pendingReservations.get(id);
        if (r) {
          refundCredits(r, `generation_failed: ${message.slice(0, 200)}`).catch(e =>
            console.error(`[credits] Failed to refund for ${id}:`, e),
          );
          pendingReservations.delete(id);
        }
      });

    res.json({ id: project.id, status: "generating", creditsReserved: CREDIT_COSTS.generation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    console.error("Failed to approve spec:", message);
    res.status(400).json({ error: message });
  }
});

router.post("/projects/:id/regenerate-spec", requireAuth, async (req, res) => {
  try {
    const { id } = RegenerateSpecParams.parse(req.params);

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    if (project.status !== "planned" && project.status !== "failed" && project.status !== "failed_checks" && project.status !== "failed_validation") {
      res.status(400).json({
        error: `Cannot regenerate spec. Project status is '${project.status}', expected 'planned', 'failed', 'failed_checks', or 'failed_validation'.`,
      });
      return;
    }

    await db
      .update(projectsTable)
      .set({ status: "pending", spec: null, error: null })
      .where(eq(projectsTable.id, id));

    generateProjectSpec(project.id, project.prompt).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Spec regeneration failed for project ${project.id}:`, message);
    });

    res.json({ id: project.id, status: "planning" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    console.error("Failed to regenerate spec:", message);
    res.status(400).json({ error: message });
  }
});

router.patch("/projects/:id/update-spec", requireAuth, async (req, res) => {
  try {
    const { id } = UpdateSpecParams.parse(req.params);
    const updates = UpdateSpecBody.parse(req.body);

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    if (project.status !== "planned") {
      res.status(400).json({
        error: `Cannot update spec. Project status is '${project.status}', expected 'planned'.`,
      });
      return;
    }

    type SpecShape = {
      overview: string;
      fileStructure: string[];
      apiEndpoints: Array<{ method: string; path: string; description: string }>;
      databaseTables: Array<{ name: string; columns: string[] }>;
      middleware: string[];
      architecturalDecisions: string[];
    };
    const currentSpec = (project.spec ?? {}) as SpecShape;
    const mergedSpec: SpecShape = { ...currentSpec };
    if (updates.overview !== undefined) mergedSpec.overview = updates.overview;
    if (updates.fileStructure !== undefined) mergedSpec.fileStructure = updates.fileStructure;
    if (updates.apiEndpoints !== undefined) mergedSpec.apiEndpoints = updates.apiEndpoints;
    if (updates.databaseTables !== undefined) mergedSpec.databaseTables = updates.databaseTables;
    if (updates.middleware !== undefined) mergedSpec.middleware = updates.middleware;
    if (updates.architecturalDecisions !== undefined) mergedSpec.architecturalDecisions = updates.architecturalDecisions;

    const [updated] = await db
      .update(projectsTable)
      .set({ spec: mergedSpec })
      .where(eq(projectsTable.id, id))
      .returning();

    res.json({
      id: updated.id,
      prompt: updated.prompt,
      status: updated.status,
      spec: updated.spec ?? undefined,
      files: updated.files ?? [],
      goldenPathChecks: updated.goldenPathChecks ?? [],
      deployUrl: updated.deployUrl,
      createdAt: updated.createdAt.toISOString(),
      error: updated.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    console.error("Failed to update spec:", message);
    res.status(400).json({ error: message });
  }
});

router.post("/projects/:id/refine", requireAuth, async (req, res) => {
  try {
    let id: string;
    let body: { prompt: string };

    try {
      ({ id } = RefineProjectParams.parse(req.params));
      body = RefineProjectBody.parse(req.body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid request";
      res.status(400).json({ error: message });
      return;
    }

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    if (project.status !== "ready" && project.status !== "deployed") {
      res.status(400).json({
        error: `Cannot refine project. Status is '${project.status}', expected 'ready' or 'deployed'.`,
      });
      return;
    }

    let reservation: CreditReservation;
    try {
      reservation = await reserveCredits(
        req.user!.id,
        CREDIT_COSTS.refinement,
        "refinement",
        id,
      );
    } catch (err: unknown) {
      if (err instanceof CreditError) {
        res.status(402).json({
          error: "Insufficient credits",
          required: err.requiredAmount,
          balance: err.currentBalance,
        });
        return;
      }
      throw err;
    }

    try {
      const result = await refineProject(id, body.prompt);

      await settleCredits(reservation);

      res.json({
        id,
        status: result.status,
        filesChanged: result.filesChanged,
        previousFiles: result.previousFiles,
        files: result.files,
        goldenPathChecks: result.goldenPathChecks,
        refinement: result.refinement,
        verificationVerdict: result.verificationVerdict,
        creditsCharged: CREDIT_COSTS.refinement,
      });
    } catch (innerErr: unknown) {
      await refundCredits(reservation, `refinement_failed: ${innerErr instanceof Error ? innerErr.message.slice(0, 200) : "unknown"}`);
      throw innerErr;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Refinement failed";
    console.error("Failed to refine project:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/projects/:id/deploy", requireAuth, async (req, res) => {
  try {
    const { id } = DeployProjectParams.parse(req.params);

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    if (project.status !== "ready" && project.status !== "deployed") {
      res.status(400).json({
        error: `Project is not ready for deployment. Current status: ${project.status}`,
      });
      return;
    }

    const result = await deployProject(project);

    res.json({
      id: result.id,
      status: result.status,
      deployUrl: result.deployUrl,
      sandboxId: result.sandboxId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Deployment failed";
    console.error("Failed to deploy project:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/projects/:id/preview", requireAuth, async (req, res) => {
  try {
    const { id } = GetProjectParams.parse(req.params);

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const files = (project.files as Array<{ path: string; content: string }>) || [];
    const checks = (project.goldenPathChecks as Array<{ name: string; passed: boolean; description?: string }>) || [];

    if (files.length === 0) {
      res.status(400).json({ error: "Project has no generated files" });
      return;
    }

    const html = generatePreviewHtml(project, files, checks);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Preview failed";
    console.error("Failed to generate preview:", message);
    res.status(500).json({ error: message });
  }
});

router.delete("/projects/:id", requireAuth, async (req, res) => {
  try {
    const { id } = GetProjectParams.parse(req.params);

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    if (project.sandboxId) {
      const sandboxDeleted = await deleteSandbox(project.sandboxId);
      if (!sandboxDeleted) {
        console.warn(`[projects] Sandbox deletion failed for ${id.slice(0, 8)}, proceeding with DB deletion`);
      }
    }

    await db
      .delete(projectsTable)
      .where(eq(projectsTable.id, id));

    console.log(`[projects] Deleted project ${id.slice(0, 8)} (sandbox: ${project.sandboxId || "none"})`);

    res.json({ id, deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete project";
    console.error("Failed to delete project:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
