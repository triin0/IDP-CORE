import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { callWithRetry, emitPipelineEvent } from "@workspace/engine-common";
import { buildMobilePipelinePrompt, MOBILE_SPEC_PROMPT } from "./prompts";
import { runMobileGoldenPathChecks } from "./golden-path";

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
      agent: "Mobile Architect",
      message: "Generating React Native/Expo architectural specification...",
    });

    const rawContent = await callWithRetry(
      {
        model: "gemini-2.5-pro",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: MOBILE_SPEC_PROMPT },
          {
            role: "user",
            content: `Create an architectural specification for a React Native/Expo mobile app: ${prompt}`,
          },
        ],
        response_format: { type: "json_object" },
      },
      "mobile-spec",
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

    if (!spec.overview || !spec.fileStructure) {
      throw new Error("Invalid spec: missing required fields (overview, fileStructure)");
    }

    await db
      .update(projectsTable)
      .set({ status: "planned", spec })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "stage:complete", {
      stage: "spec",
      agent: "Mobile Architect",
      message: "Mobile specification complete",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mobile] Spec generation failed for ${projectId}:`, message);

    await db
      .update(projectsTable)
      .set({ status: "failed", error: `Spec generation failed: ${message}` })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "pipeline:error", {
      stage: "spec",
      agent: "Mobile Architect",
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
      agent: "Mobile Architect",
      message: "Generating React Native/Expo application code...",
    });

    const systemPrompt = buildMobilePipelinePrompt(prompt, spec);

    const rawContent = await callWithRetry(
      {
        model: "gemini-2.5-pro",
        max_completion_tokens: 32768,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate the complete React Native/Expo mobile application. Return ONLY a JSON object with "files" and "notes" keys.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.0,
      },
      "mobile-generate",
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

    const hasLayout = result.files.some((f) => f.path === "app/_layout.tsx");
    const hasPackageJson = result.files.some((f) => f.path === "package.json");
    const hasAppJson = result.files.some((f) => f.path === "app.json");
    if (!hasLayout) throw new Error("Generation failed: app/_layout.tsx is missing from output");
    if (!hasPackageJson) throw new Error("Generation failed: package.json is missing from output");
    if (!hasAppJson) throw new Error("Generation failed: app.json is missing from output");

    emitPipelineEvent(projectId, "stage:start", {
      stage: "golden-path",
      agent: "Mobile Golden Path",
      message: "Running Mobile Golden Path compliance checks...",
    });

    const goldenPathChecks = runMobileGoldenPathChecks(result.files);
    const criticalFailures = goldenPathChecks.filter((c) => c.critical && !c.passed);
    const passed = goldenPathChecks.filter((c) => c.passed).length;
    const total = goldenPathChecks.length;

    emitPipelineEvent(projectId, criticalFailures.length > 0 ? "stage:fail" : "stage:complete", {
      stage: "golden-path",
      agent: "Mobile Golden Path",
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
            { role: "Mobile Architect", label: "Spec", status: "completed" },
            { role: "Mobile Architect", label: "Code Generation", status: "completed" },
            { role: "Mobile Golden Path", label: "Golden Path", status: criticalFailures.length > 0 ? "failed" : "completed" },
          ],
        },
      })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "pipeline:complete", {
      status: finalStatus,
      message: `Mobile pipeline ${finalStatus === "ready" ? "completed successfully" : "completed with failures"}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mobile] Pipeline failed for ${projectId}:`, message);

    await db
      .update(projectsTable)
      .set({ status: "failed", error: `Pipeline failed: ${message}` })
      .where(eq(projectsTable.id, projectId));

    emitPipelineEvent(projectId, "pipeline:error", {
      stage: "generation",
      agent: "Mobile Architect",
      error: message,
    });
  }
}
