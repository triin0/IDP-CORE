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
import { deployProject, generatePreviewHtml } from "../lib/deploy";
import { deleteSandbox, cleanupStaleSandboxes } from "../lib/sandbox";
import { pipelineEvents, type PipelineEvent } from "../lib/pipeline-events";
import { reserveCredits, settleCredits, refundCredits, CreditError } from "../lib/credits";
import type { CreditReservation } from "../lib/credits";
import { getEngine } from "../lib/engine-router";

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
        engine: p.engine ?? "react",
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
    const engineId = body.engine ?? "react";

    const [project] = await db
      .insert(projectsTable)
      .values({ prompt: body.prompt, userId: req.user!.id, engine: engineId, designPersona: body.designPersona ?? null })
      .returning();

    const engine = getEngine(engineId as "react" | "fastapi" | "mobile-expo");
    engine.generateSpec(project.id, body.prompt, body.designPersona).catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${engine.id}] Spec generation failed for project ${project.id}:`, message);
      await db.update(projectsTable).set({ status: "failed", error: message }).where(eq(projectsTable.id, project.id));
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

    const files = project.files ?? [];
    let annotatedFiles: Array<{ path: string; content: string }> | undefined;
    if (files.length > 0) {
      try {
        const { annotateProjectFiles, mergeAnnotatedFiles } = await import("../lib/source-annotator");
        const annotations = annotateProjectFiles(files);
        if (annotations.length > 0) {
          annotatedFiles = mergeAnnotatedFiles(files, annotations);
        }
      } catch (err) {
        console.warn("[xray] Source annotation failed, serving clean files only:", err instanceof Error ? err.message : err);
      }
    }

    res.json({
      id: project.id,
      prompt: project.prompt,
      engine: project.engine ?? "react",
      status: project.status,
      spec: project.spec ?? undefined,
      files,
      annotatedFiles,
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

    const engine = getEngine((project.engine ?? "react") as "react" | "fastapi" | "mobile-expo");
    engine.runPipeline(project.id, project.prompt, spec ?? undefined, project.designPersona ?? undefined)
      .then(() => {
        const r = pendingReservations.get(id);
        if (r) {
          settleCredits(r).catch(e => console.error(`[credits] Failed to settle for ${id}:`, e));
          pendingReservations.delete(id);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[${engine.id}] Generation failed for project ${project.id}:`, message);
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

    const engine = getEngine((project.engine ?? "react") as "react" | "fastapi" | "mobile-expo");
    engine.generateSpec(project.id, project.prompt, project.designPersona ?? undefined).catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${engine.id}] Spec regeneration failed for project ${project.id}:`, message);
      await db.update(projectsTable).set({ status: "failed", error: message }).where(eq(projectsTable.id, project.id));
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
      const engine = getEngine((project.engine ?? "react") as "react" | "fastapi" | "mobile-expo");
      const result = await engine.refineProject(id, body.prompt);

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
    const { appName, tagline, features, designPersona } = req.body as {
      appName?: string;
      tagline?: string;
      features?: Array<{ category: string; name: string; description: string }>;
      designPersona?: string;
    };

    if (!appName || !features || !Array.isArray(features) || features.length === 0) {
      res.status(400).json({ error: "Missing appName or features" });
      return;
    }

    const { callWithRetry } = await import("../lib/ai-retry");
    const { getPersonaStyleTokens, DESIGN_PERSONAS } = await import("../lib/design-personas");

    const featureList = features
      .map((f) => `- ${f.category}: ${f.name} (${f.description})`)
      .join("\n");

    const personaTokens = getPersonaStyleTokens(designPersona);
    const persona = designPersona ? DESIGN_PERSONAS[designPersona as keyof typeof DESIGN_PERSONAS] : null;

    const voiceDirective = persona ? `

VOICE & CONTENT STYLE — "${persona.name}":
${designPersona === "cupertino" ? `Write copy like Apple: minimal, elegant, confident. Short sentences. "Just works." Premium feel. Use words like "beautiful," "effortless," "designed for." Whitespace IS content.` :
  designPersona === "terminal" ? `Write copy like a hacker's README: terse, technical-sounding, confident. Use code metaphors. Prefix things with ">" or "$". Version numbers in badges. "Engineered for speed." "Zero overhead." Status indicators everywhere.` :
  designPersona === "startup" ? `Write copy like a Y Combinator landing page: bold, punchy, aspirational. Big claims. Social proof numbers. "Join 10,000+ users." "The fastest way to..." Emoji in CTAs. Energy and momentum.` :
  designPersona === "editorial" ? `Write copy like a New York Times feature: sophisticated, measured, literary. Longer sentences with rhythm. Pull-quotes. "A new way to think about..." Understated confidence. Let the typography speak.` :
  designPersona === "brutalist" ? `Write copy like a manifesto: UPPERCASE HEADERS. Short. Blunt. No fluff. "IT WORKS." "NO NONSENSE." Direct imperatives. Counter-cultural tone. Anti-marketing marketing.` :
  "Write copy that fits the selected design persona."}` : "";

    const personaStyleBlock = personaTokens ? `

VISUAL STYLE — Apply this persona's design language:
${personaTokens}
The entire mockup MUST use this style. Colors, typography, spacing, borders, and component shapes must all match this persona.` : `
Use a dark theme with these colors: background #0a0a12, cards #12121a, borders #1e1e2e, text #e4e4e7, muted text #71717a, accent #22d3ee`;

    const systemPrompt = `You are a UI mockup generator that creates VIVID, REALISTIC previews. Your job is to make creators SEE their vision come alive — not just empty wireframes, but a living, breathing preview of what their app COULD be.

Return ONLY valid JSON with this structure:
{
  "code": "...",
  "userPersonas": [
    {
      "name": "string — a realistic first name",
      "age": "string — age range like '28' or '34'",
      "role": "string — their relationship to the app (e.g., 'Power Lender', 'Weekend Borrower', 'Neighborhood Admin')",
      "emoji": "string — a single emoji representing this persona",
      "story": "string — 1-2 sentences: who they are and why they'd use this app. Make it vivid and specific.",
      "painPoint": "string — the ONE problem this app solves for them",
      "delight": "string — the ONE thing about this app that would make them smile"
    }
  ]
}

CODE RULES:
- The "code" field contains a SINGLE React component
- Use ONLY inline styles (no Tailwind, no CSS imports)
- The component MUST be declared as: function App() { ... } (NO export keyword)
- All content hardcoded (no props, no API calls, no state)
- Keep it under 250 lines
${personaStyleBlock}${voiceDirective}

CONTENT RULES — "Hallucinate Vividly":
- DO NOT use "Lorem ipsum" or "Sample text" — every piece of text should feel REAL
- Generate realistic user profiles with names, avatars (use emoji faces), and believable bios
- Generate realistic data: product listings, prices, ratings, dates, locations, metrics
- For a tool rental app: show specific tools ("DeWalt 20V Drill", "$5/day"), real-seeming neighbor names, star ratings
- For a social app: show realistic posts, follower counts, engagement metrics
- For a dashboard: show plausible KPIs, charts (as styled divs), trend indicators
- The mockup should make the user think "YES, that's exactly what I imagined"

LAYOUT REQUIREMENTS:
- Create a professional app mockup (landing page or dashboard view)
- Navigation bar with the app name
- Hero section with tagline
- At least 2-3 content sections showing REALISTIC data for the app's features
- Feature highlights with realistic content
- Social proof or testimonials section with hallucinated user quotes
- Call-to-action
- Footer

USER PERSONAS:
Generate 2-3 user personas — fictional but believable people who would LOVE this app.
Make them diverse in age, background, and use-case. Their stories should make the creator think "I'm building this for real people."`;

    const raw = await callWithRetry(
      {
        model: "gemini-2.5-pro",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a vivid homepage mockup for "${appName}" — ${tagline || ""}

Enabled features:
${featureList}${persona ? `\n\nDesign Persona: ${persona.name} — ${persona.tagline}` : ""}`,
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

    const userPersonas = Array.isArray(parsed.userPersonas) ? parsed.userPersonas : [];

    res.json({ code: cleanCode, userPersonas });
  } catch (err: unknown) {
    const internal = err instanceof Error ? err.message : "Unknown error";
    console.error("Ghost Preview error:", internal);
    res.status(500).json({ error: "Failed to generate preview. Please try again." });
  }
});

router.post("/deconstruct", async (req: Request, res: Response) => {
  try {
    const { idea, analogy } = req.body as { idea?: string; analogy?: string };
    if (!idea || typeof idea !== "string" || idea.trim().length < 3) {
      res.status(400).json({ error: "Please provide an app idea (at least 3 characters)" });
      return;
    }

    const { callWithRetry } = await import("../lib/ai-retry");

    const hasAnalogy = analogy && typeof analogy === "string" && analogy.trim().length > 0;

    const analogySection = hasAnalogy ? `

ANALOGY HANDLING:
The user has also provided a real-world analogy/metaphor for their idea. This is CRUCIAL context.
Parse the analogy and include two extra fields in your response:

"analogyTranslations": [
  {
    "metaphor": "string — a key concept from their analogy (e.g. 'Library', 'Books talk back')",
    "techTranslation": "string — what this maps to technically, explained simply (e.g. 'Searchable database with categories', 'AI-powered chat responses')"
  }
]
Extract 2-5 key metaphors from the analogy and translate each one.
Use the analogy to DEEPLY influence which features you generate — if they say "farmers market" the features should feel like a marketplace, not a generic app.

"magicSuggestions": [
  {
    "name": "string — suggested feature name",
    "description": "string — non-technical explanation",
    "category": "string — which category this belongs to",
    "complexity": "low" | "medium" | "high",
    "whyItHelps": "string — a 'whispered suggestion' explaining why users with this type of app love this feature"
  }
]
Generate 2-4 magic suggestions — features the user probably hasn't thought of but would make their app feel professional and polished. Frame "whyItHelps" like a helpful friend: "Users with marketplace apps love this because..."` : `

MAGIC SUGGESTIONS:
Also include a "magicSuggestions" array with 2-4 bonus feature ideas the user probably hasn't considered:
"magicSuggestions": [
  {
    "name": "string — suggested feature name",
    "description": "string — non-technical explanation",
    "category": "string — which category this belongs to",
    "complexity": "low" | "medium" | "high",
    "whyItHelps": "string — a friendly 'whispered suggestion' explaining why apps like this benefit from this feature"
  }
]
These should feel like a creative partner finishing the user's sentences — professional polish ideas they didn't know were possible.`;

    const systemPrompt = `You are the "App Deconstructor" — a Creative Director for software products who speaks the language of dreamers, not developers.

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
  ]${hasAnalogy ? `,
  "analogyTranslations": [...],` : ""}
  "magicSuggestions": [...]
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
- If the idea is unique, creatively fill in the logical feature modules${analogySection}`;

    const userMessage = hasAnalogy
      ? `Deconstruct this app idea: "${idea.trim()}"\n\nThe user describes it like this: "${analogy!.trim()}"`
      : `Deconstruct this app idea: "${idea.trim()}"`;

    const raw = await callWithRetry(
      {
        model: "gemini-2.5-pro",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
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

router.post("/projects/:id/seed-data", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { rowsPerTable = 5, format = "json", inject = false } = req.body as {
      rowsPerTable?: number;
      format?: "json" | "sql" | "typescript";
      inject?: boolean;
    };

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const spec = project.spec as { overview?: string; databaseTables?: Array<{ name: string; columns: string[] }> } | null;
    if (!spec?.databaseTables || spec.databaseTables.length === 0) {
      res.status(400).json({ error: "This project has no database tables to generate seed data for" });
      return;
    }

    const {
      generateSeedData, seedDataToSQL, seedDataToTypeScript,
      generateClientSeedFile, generateServerSeedFile,
    } = await import("../lib/seed-generator");

    const seedData = await generateSeedData(
      spec.databaseTables,
      spec.overview || project.prompt,
      Math.min(rowsPerTable, 20),
      id,
    );

    if (inject) {
      const clientSeedContent = generateClientSeedFile(seedData);
      const serverSeedContent = generateServerSeedFile(seedData, spec.databaseTables);
      const currentFiles = (project.files ?? []) as Array<{ path: string; content: string }>;

      if (currentFiles.length > 0) {
        const { createSnapshot } = await import("../lib/snapshots");
        await createSnapshot(id, currentFiles, "pre_inject", "Before seed data injection");
      }

      const SEED_PATHS = ["client/src/data/seed-data.ts", "server/src/db/seed.ts"];
      const cleanedFiles = currentFiles.filter((f) => !SEED_PATHS.includes(f.path));

      cleanedFiles.push(
        { path: "client/src/data/seed-data.ts", content: clientSeedContent },
        { path: "server/src/db/seed.ts", content: serverSeedContent },
      );

      await db
        .update(projectsTable)
        .set({ files: cleanedFiles })
        .where(eq(projectsTable.id, id));

      res.json({
        tables: seedData,
        injected: true,
        filesAdded: SEED_PATHS,
      });
      return;
    }

    if (format === "sql") {
      const sql = seedDataToSQL(seedData);
      res.json({ tables: seedData, sql });
    } else if (format === "typescript") {
      const ts = seedDataToTypeScript(seedData);
      res.json({ tables: seedData, typescript: ts });
    } else {
      res.json({ tables: seedData });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate seed data";
    console.error("Seed data error:", err);
    if (message.includes("Circular dependency detected")) {
      res.status(422).json({
        error: "Your database schema contains a circular foreign key dependency. Seed data generation is aborted to prevent constraint violations.",
        detail: message,
      });
      return;
    }
    res.status(500).json({ error: message });
  }
});

router.post("/projects/:id/wipe-seed-data", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const currentFiles = (project.files ?? []) as Array<{ path: string; content: string }>;
    const clientSeedFile = currentFiles.find((f) => f.path === "client/src/data/seed-data.ts");
    const serverSeedFile = currentFiles.find((f) => f.path === "server/src/db/seed.ts");

    if (!clientSeedFile && !serverSeedFile) {
      res.status(400).json({ error: "No seed data files found in this project" });
      return;
    }

    if (currentFiles.length > 0) {
      const { createSnapshot } = await import("../lib/snapshots");
      await createSnapshot(id, currentFiles, "pre_wipe", "Before seed data wipe");
    }

    const { generateEmptyServerSeedFile } = await import("../lib/seed-generator");

    let emptyClientContent: string;
    if (clientSeedFile?.content) {
      emptyClientContent = clientSeedFile.content
        .replace(/^(\/\/ =+)$/m, "// ============================================================")
        .replace(
          /AUTO-GENERATED SEED DATA/,
          "SEED DATA CLEARED",
        )
        .replace(
          /This file provides realistic mock data for the Sandpack preview\./,
          "All mock data has been wiped. Arrays are empty.",
        )
        .replace(
          /export const (\w+): (\w+)\[\] = \[[\s\S]*?\];/g,
          "export const $1: $2[] = [];",
        );
    } else {
      emptyClientContent = "// Seed data cleared.\n";
    }
    const emptyServerContent = generateEmptyServerSeedFile();

    const updatedFiles = currentFiles.map((f) => {
      if (f.path === "client/src/data/seed-data.ts") {
        return { path: f.path, content: emptyClientContent };
      }
      if (f.path === "server/src/db/seed.ts") {
        return { path: f.path, content: emptyServerContent };
      }
      return f;
    });

    await db
      .update(projectsTable)
      .set({ files: updatedFiles })
      .where(eq(projectsTable.id, id));

    res.json({ wiped: true });
  } catch (err: unknown) {
    console.error("Wipe seed data error:", err);
    res.status(500).json({ error: "Failed to wipe seed data" });
  }
});

router.post("/projects/:id/rollback", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { refinementIndex } = req.body as { refinementIndex: number };

    if (typeof refinementIndex !== "number" || refinementIndex < 0) {
      res.status(400).json({ error: "Invalid refinement index" });
      return;
    }

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const refinements = (project.refinements ?? []) as Array<{
      prompt: string;
      response: string;
      timestamp: string;
      filesChanged: string[];
      goldenPathScore?: string;
      previousFiles?: Array<{ path: string; content: string }>;
    }>;

    if (refinementIndex >= refinements.length) {
      res.status(400).json({ error: "Refinement index out of range" });
      return;
    }

    let restoredFiles = project.files ? [...project.files] : [];

    for (let i = refinements.length - 1; i > refinementIndex; i--) {
      const ref = refinements[i];
      if (ref.previousFiles && ref.previousFiles.length > 0) {
        for (const prev of ref.previousFiles) {
          const idx = restoredFiles.findIndex((f) => f.path === prev.path);
          if (idx >= 0) {
            restoredFiles[idx] = { path: prev.path, content: prev.content };
          } else {
            restoredFiles.push({ path: prev.path, content: prev.content });
          }
        }

        for (const changed of ref.filesChanged ?? []) {
          if (!ref.previousFiles.some((p) => p.path === changed)) {
            restoredFiles = restoredFiles.filter((f) => f.path !== changed);
          }
        }
      }
    }

    const trimmedRefinements = refinements.slice(0, refinementIndex + 1);

    await db.update(projectsTable).set({
      files: restoredFiles,
      refinements: trimmedRefinements,
      status: "ready",
    }).where(eq(projectsTable.id, id));

    res.json({
      id,
      status: "ready",
      fileCount: restoredFiles.length,
      restoredToIndex: refinementIndex,
      message: `Rolled back to version ${refinementIndex + 1}`,
    });
  } catch (err: unknown) {
    console.error("Rollback error:", err);
    res.status(500).json({ error: "Failed to rollback project" });
  }
});

router.post("/projects/:id/snapshot", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { label = "Manual snapshot" } = req.body as { label?: string };

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const files = (project.files ?? []) as Array<{ path: string; content: string }>;
    if (files.length === 0) {
      res.status(400).json({ error: "Cannot snapshot a project with no files" });
      return;
    }

    const { createSnapshot } = await import("../lib/snapshots");
    const snapshotId = await createSnapshot(id, files, "manual", label);

    res.json({ id: snapshotId, trigger: "manual", label });
  } catch (err: unknown) {
    console.error("Snapshot create error:", err);
    res.status(500).json({ error: "Failed to create snapshot" });
  }
});

router.get("/projects/:id/snapshots", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const { listSnapshots } = await import("../lib/snapshots");
    const snapshots = await listSnapshots(id);

    res.json({ snapshots });
  } catch (err: unknown) {
    console.error("Snapshot list error:", err);
    res.status(500).json({ error: "Failed to list snapshots" });
  }
});

router.post("/projects/:id/restore/:snapshotId", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const snapshotId = req.params.snapshotId as string;

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const currentFiles = (project.files ?? []) as Array<{ path: string; content: string }>;

    const { createSnapshot, restoreSnapshot } = await import("../lib/snapshots");

    if (currentFiles.length > 0) {
      await createSnapshot(id, currentFiles, "pre_restore", "Before restoring snapshot");
    }

    const restoredFiles = await restoreSnapshot(id, snapshotId);

    await db
      .update(projectsTable)
      .set({ files: restoredFiles })
      .where(eq(projectsTable.id, id));

    res.json({
      restored: true,
      snapshotId,
      fileCount: restoredFiles.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to restore snapshot";
    console.error("Snapshot restore error:", err);
    if (message.includes("not found") || message.includes("corrupted")) {
      res.status(404).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

router.post("/projects/:id/decrypt-error", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { error, files } = req.body as {
      error: { message: string; line?: number; column?: number; path?: string };
      files: Array<{ path: string; content: string }>;
    };

    if (!error?.message) {
      res.status(400).json({ error: "Missing error.message" });
      return;
    }

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const { callWithRetry } = await import("../lib/ai-retry");

    const fileContext = (files || [])
      .slice(0, 8)
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    const systemPrompt = `You are a code error diagnostician. Your ONLY job is to:
1. Explain the error in plain English (2-3 sentences max)
2. Identify the root cause file and line
3. Provide the MINIMAL fix as a full file replacement

STRICT RULES:
- Fix ONLY the reported error. Do not refactor, optimize, or add features.
- Do not change any file that is not directly causing the error.
- If you cannot determine the fix, set "fixes" to null.
- Return ONLY valid JSON matching this exact schema:
{
  "explanation": "string - 2-3 sentence plain English explanation",
  "rootCause": { "path": "string - file path", "line": number },
  "fixes": [ { "path": "string - file path", "content": "string - complete corrected file content" } ] | null
}`;

    const userPrompt = `ERROR:
${error.message}
${error.line ? `Line: ${error.line}` : ""}
${error.column ? `Column: ${error.column}` : ""}
${error.path ? `File: ${error.path}` : ""}

PROJECT FILES:
${fileContext}`;

    const raw = await callWithRetry(
      {
        model: "gemini-2.5-pro",
        temperature: 0.0,
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      },
      "error-decryptor",
    );

    let parsed: {
      explanation?: string;
      rootCause?: { path?: string; line?: number };
      fixes?: Array<{ path: string; content: string }> | null;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { explanation: raw.slice(0, 500), rootCause: undefined, fixes: null };
    }

    res.json({
      explanation: parsed.explanation || "Could not determine the cause of this error.",
      rootCause: parsed.rootCause || null,
      fixes: parsed.fixes || null,
    });
  } catch (err: unknown) {
    console.error("Error decryptor failed:", err);
    res.status(500).json({ error: "Failed to decrypt error" });
  }
});

router.post("/projects/:id/apply-decrypt-fix", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { fixes } = req.body as {
      fixes: Array<{ path: string; content: string }>;
    };

    if (!fixes || !Array.isArray(fixes) || fixes.length === 0) {
      res.status(400).json({ error: "No fixes provided" });
      return;
    }

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const currentFiles = (project.files ?? []) as Array<{ path: string; content: string }>;

    const { createSnapshot } = await import("../lib/snapshots");

    let snapshotId: string | null = null;
    if (currentFiles.length > 0) {
      snapshotId = await createSnapshot(id, currentFiles, "pre_decrypt", "Before error fix applied");
    }

    const fixMap = new Map(fixes.map((f) => [f.path, f.content]));
    const mergedFiles = currentFiles.map((f) => {
      const fixContent = fixMap.get(f.path);
      if (fixContent !== undefined) {
        return { path: f.path, content: fixContent };
      }
      return f;
    });

    for (const fix of fixes) {
      if (!currentFiles.some((f) => f.path === fix.path)) {
        mergedFiles.push({ path: fix.path, content: fix.content });
      }
    }

    await db
      .update(projectsTable)
      .set({ files: mergedFiles })
      .where(eq(projectsTable.id, id));

    const filesChanged = fixes.map((f) => f.path);

    res.json({
      applied: true,
      snapshotId,
      filesChanged,
      fileCount: mergedFiles.length,
    });
  } catch (err: unknown) {
    console.error("Apply decrypt fix error:", err);
    res.status(500).json({ error: "Failed to apply fix" });
  }
});

router.delete("/projects/:id/snapshots/:snapshotId", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const snapshotId = req.params.snapshotId as string;

    const project = await loadOwnedProject(req, res, id);
    if (!project) return;

    const { deleteSnapshot } = await import("../lib/snapshots");
    const deleted = await deleteSnapshot(id, snapshotId);

    if (!deleted) {
      res.status(404).json({ error: "Snapshot not found" });
      return;
    }

    res.json({ deleted: true });
  } catch (err: unknown) {
    console.error("Snapshot delete error:", err);
    res.status(500).json({ error: "Failed to delete snapshot" });
  }
});

export default router;
