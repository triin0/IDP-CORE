import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, desc, count, and } from "drizzle-orm";
import { db, projectsTable, creditLedgerTable, CREDIT_COSTS } from "@workspace/db";
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
      .values({ prompt: body.prompt, userId: req.user!.id, designPersona: body.designPersona ?? null })
      .returning();

    generateProjectSpec(project.id, body.prompt, body.designPersona).catch((err: unknown) => {
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

    generateProjectCode(project.id, project.prompt, spec ?? undefined, project.designPersona ?? undefined)
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

    generateProjectSpec(project.id, project.prompt, project.designPersona ?? undefined).catch((err: unknown) => {
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

    await db.transaction(async (tx) => {
      await tx
        .update(creditLedgerTable)
        .set({ projectId: null })
        .where(eq(creditLedgerTable.projectId, id));

      await tx
        .delete(projectsTable)
        .where(eq(projectsTable.id, id));
    });

    console.log(`[projects] Deleted project ${id.slice(0, 8)} (sandbox: ${project.sandboxId || "none"})`);

    res.json({ id, deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete project";
    console.error("Failed to delete project:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/ghost-preview", async (req: Request, res: Response) => {
  try {
    const { appName, tagline, features } = req.body as {
      appName?: string;
      tagline?: string;
      features?: Array<{ category: string; name: string; description: string }>;
    };

    if (!appName || !features || !Array.isArray(features) || features.length === 0) {
      res.status(400).json({ error: "Missing appName or features" });
      return;
    }

    const { callWithRetry } = await import("../lib/ai-retry");

    const featureList = features
      .map((f) => `- ${f.category}: ${f.name} (${f.description})`)
      .join("\n");

    const systemPrompt = `You are a UI wireframe generator. Generate a SINGLE self-contained React component that renders a high-fidelity homepage mockup for the described application.

Rules:
- Return ONLY valid JSON: { "code": "..." }
- The "code" field contains a complete React component as a default export
- Use ONLY inline styles (no Tailwind, no CSS imports, no external dependencies)
- Use a dark theme with these colors: background #0a0a12, cards #12121a, borders #1e1e2e, text #e4e4e7, muted text #71717a, accent #22d3ee
- Create a professional landing page / dashboard mockup showing:
  - A navigation bar with the app name and placeholder menu items
  - A hero section with the tagline
  - Feature cards or sections based on the enabled features
  - A call-to-action button
  - A footer
- Make it look like a real product — use realistic placeholder text, not "Lorem ipsum"
- All content must be hardcoded (no props, no API calls, no state management)
- Use modern layout: flexbox or CSS grid via inline styles
- Include visual hierarchy: headings, subheadings, body text
- Add subtle visual details: rounded corners, box shadows, emoji or unicode icons
- The component MUST be declared as: function App() { ... } (NO export keyword — the code runs in a script tag, not a module)
- Keep it under 200 lines`;

    const raw = await callWithRetry(
      {
        model: "gemini-2.5-pro",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a homepage mockup for "${appName}" — ${tagline || ""}

Enabled features:
${featureList}`,
          },
        ],
        response_format: { type: "json_object" },
      },
      "GhostPreview",
    );

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } else {
        throw new Error("AI returned invalid response");
      }
    }

    if (!parsed.code || typeof parsed.code !== "string") {
      throw new Error("AI returned response without code");
    }

    let cleanCode = (parsed.code as string)
      .replace(/export\s+default\s+function/g, "function")
      .replace(/export\s+default\s+/g, "")
      .replace(/export\s+function/g, "function");

    res.json({ code: cleanCode });
  } catch (err: unknown) {
    const internal = err instanceof Error ? err.message : "Unknown error";
    console.error("Ghost Preview error:", internal);
    res.status(500).json({ error: "Failed to generate preview. Please try again." });
  }
});

router.post("/deconstruct", async (req: Request, res: Response) => {
  try {
    const { idea } = req.body as { idea?: string };
    if (!idea || typeof idea !== "string" || idea.trim().length < 3) {
      res.status(400).json({ error: "Please provide an app idea (at least 3 characters)" });
      return;
    }

    const { callWithRetry } = await import("../lib/ai-retry");

    const systemPrompt = `You are the "App Deconstructor" — a Creative Director for software products.

Given a user's app idea (which may be vague, like "something like Airbnb" or "a fitness tracker"), break it down into a modular feature blueprint.

Return ONLY valid JSON matching this exact schema:
{
  "appName": "string — a concise product name suggestion",
  "tagline": "string — one-line elevator pitch",
  "categories": [
    {
      "name": "string — category name (e.g. 'Identity & Auth', 'Core Features', 'Data & Storage')",
      "icon": "string — a single emoji representing this category",
      "features": [
        {
          "name": "string — feature name",
          "description": "string — one-sentence non-technical explanation",
          "complexity": "low" | "medium" | "high",
          "defaultOn": true | false
        }
      ]
    }
  ]
}

Rules:
- Generate 4-7 categories
- Each category should have 2-5 features
- "defaultOn" should be true for essential features, false for nice-to-haves
- Categories should follow this general pattern:
  1. Identity & Auth (user accounts, profiles, roles)
  2. Core Features (the main functionality that defines the app)
  3. Data & Storage (database tables, file uploads, media)
  4. UI & Experience (dashboard, search, filters, responsive design)
  5. Trust & Safety (reviews, moderation, reporting)
  6. Integrations (payments, email, maps, third-party APIs)
  7. Growth (analytics, notifications, sharing, SEO)
- Keep descriptions non-technical — the user may be a non-coder
- "complexity" helps the user understand relative effort
- If the user references a known app ("like Airbnb"), decompose that app's actual feature set
- If the idea is unique, creatively fill in the logical feature modules`;

    const raw = await callWithRetry(
      {
        model: "gemini-2.5-pro",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Deconstruct this app idea: "${idea.trim()}"` },
        ],
        response_format: { type: "json_object" },
      },
      "Deconstructor",
    );

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } else {
        throw new Error("AI returned invalid JSON");
      }
    }

    if (!parsed.appName || !parsed.tagline || !Array.isArray(parsed.categories) || parsed.categories.length === 0) {
      throw new Error("AI returned incomplete response — please try again");
    }

    res.json(parsed);
  } catch (err: unknown) {
    const internal = err instanceof Error ? err.message : "Unknown error";
    console.error("Deconstructor error:", internal);
    const safeMessages = [
      "AI returned invalid JSON",
      "AI returned incomplete response — please try again",
      "Please provide an app idea (at least 3 characters)",
    ];
    const userMessage = safeMessages.find(m => internal.includes(m))
      ?? "Something went wrong while analyzing your idea. Please try again.";
    res.status(500).json({ error: userMessage });
  }
});

export default router;
