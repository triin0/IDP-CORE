import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import {
  CreateProjectBody,
  GetProjectParams,
  DeployProjectParams,
  ListProjectsQueryParams,
  ApproveSpecParams,
} from "@workspace/api-zod";
import { generateProjectCode } from "../lib/generate";
import { generateProjectSpec } from "../lib/spec-generator";
import { deployProject } from "../lib/deploy";

const router: IRouter = Router();

interface GoldenPathCheckRecord {
  name: string;
  passed: boolean;
  description: string;
}

interface FileRecord {
  path: string;
  content: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/projects", async (req, res) => {
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
    const [totalResult] = await db.select({ value: count() }).from(projectsTable);
    const total = totalResult?.value ?? 0;

    const projects = await db
      .select()
      .from(projectsTable)
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

router.post("/projects", async (req, res) => {
  try {
    const body = CreateProjectBody.parse(req.body);

    const [project] = await db
      .insert(projectsTable)
      .values({ prompt: body.prompt })
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

router.get("/projects/:id", async (req, res) => {
  try {
    const { id } = GetProjectParams.parse(req.params);

    if (!UUID_REGEX.test(id)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({
      id: project.id,
      prompt: project.prompt,
      status: project.status,
      spec: project.spec ?? undefined,
      files: project.files ?? [],
      goldenPathChecks: project.goldenPathChecks ?? [],
      deployUrl: project.deployUrl,
      createdAt: project.createdAt.toISOString(),
      error: project.error,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    console.error("Failed to get project:", message);
    res.status(400).json({ error: message });
  }
});

router.post("/projects/:id/approve-spec", async (req, res) => {
  try {
    const { id } = ApproveSpecParams.parse(req.params);

    if (!UUID_REGEX.test(id)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (project.status !== "planned") {
      res.status(400).json({
        error: `Cannot approve spec. Project status is '${project.status}', expected 'planned'.`,
      });
      return;
    }

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
      console.error(`Generation failed for project ${project.id}:`, message);
    });

    res.json({ id: project.id, status: "generating" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    console.error("Failed to approve spec:", message);
    res.status(400).json({ error: message });
  }
});

router.post("/projects/:id/deploy", async (req, res) => {
  try {
    const { id } = DeployProjectParams.parse(req.params);

    if (!UUID_REGEX.test(id)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (project.status !== "ready" && project.status !== "deployed") {
      res.status(400).json({
        error: `Project is not ready for deployment. Current status: ${project.status}`,
      });
      return;
    }

    const result = await deployProject(project);

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Deployment failed";
    console.error("Failed to deploy project:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
