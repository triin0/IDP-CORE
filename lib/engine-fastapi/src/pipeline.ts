import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { callWithRetry, emitPipelineEvent } from "@workspace/engine-common";
import { buildFastAPIPipelinePrompt, FASTAPI_SPEC_PROMPT } from "./prompts";
import { runFastAPIGoldenPathChecks } from "./golden-path";
import { hardenFastAPITypes } from "./type-hardener";

interface PipelineFile {
  path: string;
  content: string;
}

interface GenerationResult {
  files: PipelineFile[];
  notes: string;
}

export async function generateSpec(
  projectId: string,
  prompt: string,
  _persona?: string,
): Promise<void> {
  try {
    await db
      .update(projectsTable)
      .set({ status: "planning" })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "stage:start", {
      stage: "spec",
      agent: "FastAPI Architect",
      message: "Generating FastAPI architectural specification...",
    });

    const rawContent = await callWithRetry(
      {
        model: "gemini-2.5-pro",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: FASTAPI_SPEC_PROMPT },
          {
            role: "user",
            content: `Create an architectural specification for a Python/FastAPI backend: ${prompt}`,
          },
        ],
        response_format: { type: "json_object" },
      },
      "fastapi-spec",
    );

    let spec: {
      overview: string;
      fileStructure: string[];
      apiEndpoints: Array<{ method: string; path: string; description: string }>;
      databaseTables: Array<{ name: string; columns: string[] }>;
      middleware: string[];
      architecturalDecisions: string[];
    };

    try {
      spec = JSON.parse(rawContent);
    } catch {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to parse spec JSON from LLM response");
      spec = JSON.parse(jsonMatch[0]);
    }

    if (!spec.overview || !spec.fileStructure || !spec.apiEndpoints) {
      throw new Error("Invalid spec: missing required fields (overview, fileStructure, apiEndpoints)");
    }

    await db
      .update(projectsTable)
      .set({ status: "planned", spec })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "stage:complete", {
      stage: "spec",
      agent: "FastAPI Architect",
      message: "FastAPI specification complete",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fastapi] Spec generation failed for ${projectId}:`, message);

    await db
      .update(projectsTable)
      .set({ status: "failed", error: `Spec generation failed: ${message}` })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "pipeline:error", {
      stage: "spec",
      agent: "FastAPI Architect",
      error: message,
    });
  }
}

export async function runPipeline(
  projectId: string,
  prompt: string,
  spec?: {
    overview: string;
    fileStructure: string[];
    apiEndpoints: Array<{ method: string; path: string; description: string }>;
    databaseTables: Array<{ name: string; columns: string[] }>;
    middleware: string[];
    architecturalDecisions: string[];
  },
  _persona?: string,
): Promise<void> {
  try {
    await db
      .update(projectsTable)
      .set({ status: "generating" })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "stage:start", {
      stage: "generation",
      agent: "FastAPI Architect",
      message: "Generating FastAPI application code...",
    });

    const systemPrompt = buildFastAPIPipelinePrompt(prompt, spec);

    const rawContent = await callWithRetry(
      {
        model: "gemini-2.5-pro",
        max_completion_tokens: 32768,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate the complete FastAPI application. Return ONLY a JSON object with "files" and "notes" keys.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.0,
      },
      "fastapi-generate",
    );

    let result: GenerationResult;
    try {
      result = JSON.parse(rawContent);
    } catch {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to parse generation JSON from LLM response");
      result = JSON.parse(jsonMatch[0]);
    }

    if (!result.files || !Array.isArray(result.files) || result.files.length === 0) {
      throw new Error("Invalid generation result: no files produced");
    }

    const hasMainPy = result.files.some((f) => f.path === "main.py");
    const hasRequirements = result.files.some((f) => f.path === "requirements.txt");
    if (!hasMainPy) throw new Error("Generation failed: main.py is missing from output");
    if (!hasRequirements) throw new Error("Generation failed: requirements.txt is missing from output");

    emitPipelineEvent(projectId, "stage:start", {
      stage: "type-hardening",
      agent: "FastAPI Vindicator",
      message: "Running Python type hardener (SQLAlchemy 2.0, Pydantic V2, async, SQL injection)...",
    });

    const hardened = hardenFastAPITypes(result.files);
    result.files = hardened.files;
    const hardeningFixes = hardened.fixes;

    emitPipelineEvent(projectId, "stage:complete", {
      stage: "type-hardening",
      agent: "FastAPI Vindicator",
      message: `Type hardening complete: ${hardeningFixes.length} fixes applied`,
    });

    emitPipelineEvent(projectId, "stage:start", {
      stage: "golden-path",
      agent: "FastAPI Golden Path",
      message: "Running Python Golden Path compliance checks...",
    });

    const goldenPathChecks = runFastAPIGoldenPathChecks(result.files);
    const criticalFailures = goldenPathChecks.filter((c) => c.critical && !c.passed);
    const passed = goldenPathChecks.filter((c) => c.passed).length;
    const total = goldenPathChecks.length;

    emitPipelineEvent(projectId, criticalFailures.length > 0 ? "stage:fail" : "stage:complete", {
      stage: "golden-path",
      agent: "FastAPI Golden Path",
      message: `Golden Path: ${passed}/${total} checks passed${criticalFailures.length > 0 ? ` (${criticalFailures.length} critical failures)` : ""}`,
    });

    const finalStatus = criticalFailures.length > 0 ? "failed_checks" : "ready";
    const errorMsg = criticalFailures.length > 0
      ? `Critical Golden Path failures: ${criticalFailures.map((c) => c.name).join(", ")}`
      : null;

    await db
      .update(projectsTable)
      .set({
        status: finalStatus,
        files: result.files,
        goldenPathChecks,
        error: errorMsg,
        pipelineStatus: {
          stages: [
            { role: "FastAPI Architect", label: "Spec", status: "completed" },
            { role: "FastAPI Architect", label: "Code Generation", status: "completed" },
            { role: "FastAPI Vindicator", label: "Type Hardening", status: "completed" },
            { role: "FastAPI Golden Path", label: "Golden Path", status: criticalFailures.length > 0 ? "failed" : "completed" },
          ],
        },
      })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "pipeline:complete", {
      status: finalStatus,
      message: `FastAPI pipeline ${finalStatus === "ready" ? "completed successfully" : "completed with failures"}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fastapi] Pipeline failed for ${projectId}:`, message);

    await db
      .update(projectsTable)
      .set({ status: "failed", error: `Pipeline failed: ${message}` })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "pipeline:error", {
      stage: "generation",
      agent: "FastAPI Architect",
      error: message,
    });
  }
}
