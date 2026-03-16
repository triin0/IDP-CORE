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

    generateProjectCode(project.id, body.prompt).catch((err) => {
      console.error(`Generation failed for project ${project.id}:`, err);
    });

    res.status(201).json({ id: project.id, status: project.status });
  } catch (err: any) {
    console.error("Failed to create project:", err);
    res.status(400).json({ error: err.message ?? "Invalid request" });
  }
});

router.get("/projects/:id", async (req, res) => {
  try {
    const { id } = GetProjectParams.parse(req.params);

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
  } catch (err: any) {
    console.error("Failed to get project:", err);
    res.status(400).json({ error: err.message ?? "Invalid request" });
  }
});

router.post("/projects/:id/deploy", async (req, res) => {
  try {
    const { id } = DeployProjectParams.parse(req.params);

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
  } catch (err: any) {
    console.error("Failed to deploy project:", err);
    res.status(500).json({ error: err.message ?? "Deployment failed" });
  }
});

export default router;
