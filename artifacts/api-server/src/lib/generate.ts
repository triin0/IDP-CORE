import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { GOLDEN_PATH_SYSTEM_PROMPT, runGoldenPathChecks } from "./golden-path";

export async function generateProjectCode(
  projectId: string,
  prompt: string,
): Promise<void> {
  try {
    await db
      .update(projectsTable)
      .set({ status: "generating" })
      .where(eq(projectsTable.id, projectId));

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 16384,
      messages: [
        { role: "system", content: GOLDEN_PATH_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Build the following application:\n\n${prompt}\n\nGenerate ALL files needed for a complete, working application. Include package.json, server code, client code, and configuration files. Follow the Golden Path rules strictly.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("No response from AI model");
    }

    let parsed: { files: Array<{ path: string; content: string }> };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error("AI model returned invalid JSON");
    }

    if (!parsed.files || !Array.isArray(parsed.files)) {
      throw new Error("AI response missing 'files' array");
    }

    const goldenPathChecks = runGoldenPathChecks(parsed.files);

    await db
      .update(projectsTable)
      .set({
        status: "ready",
        files: parsed.files,
        goldenPathChecks,
      })
      .where(eq(projectsTable.id, projectId));
  } catch (err: any) {
    console.error(`Code generation failed for project ${projectId}:`, err);
    await db
      .update(projectsTable)
      .set({
        status: "failed",
        error: err.message ?? "Unknown generation error",
      })
      .where(eq(projectsTable.id, projectId));
  }
}
