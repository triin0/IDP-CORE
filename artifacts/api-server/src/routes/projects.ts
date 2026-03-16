import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import {
  CreateProjectBody,
  GetProjectParams,
  DeployProjectParams,
} from "@workspace/api-zod";
import { generateProjectCode } from "../lib/generate";
import { deployProject } from "../lib/deploy";

const router: IRouter = Router();

router.post("/projects", async (req, res) => {
  try {
    const body = CreateProjectBody.parse(req.body);

    const [project] = await db
      .insert(projectsTable)
      .values({ prompt: body.prompt })
      .returning();

    generateProjectCode(project.id, body.prompt).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Generation failed for project ${project.id}:`, message);
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
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

router.post("/projects/:id/deploy", async (req, res) => {
  try {
    const { id } = DeployProjectParams.parse(req.params);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
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
