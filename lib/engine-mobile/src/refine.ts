import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { callWithRetry } from "@workspace/engine-common";
import type { RefineResult } from "@workspace/engine-common";
import { runMobileGoldenPathChecks } from "./golden-path";
import { hardenMobileTypes } from "./type-hardener";

export async function refineProject(
  projectId: string,
  refinementPrompt: string,
): Promise<RefineResult> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) throw new Error(`Project ${projectId} not found`);

  const currentFiles = (project.files ?? []) as Array<{ path: string; content: string }>;
  if (currentFiles.length === 0) throw new Error("No files to refine");

  const previousFiles = currentFiles.map((f) => ({ path: f.path, content: f.content }));

  const filesContext = currentFiles
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  const rawContent = await callWithRetry(
    {
      model: "gemini-2.5-pro",
      max_completion_tokens: 32768,
      messages: [
        {
          role: "system",
          content: `You are a React Native/Expo refinement agent. You will receive existing mobile app files and a user's refinement request.
Apply the requested changes while preserving all existing functionality.

Rules:
- Maintain Expo Router file-based navigation in app/ directory
- Keep NativeWind className styling — never use StyleSheet.create
- Keep SafeAreaProvider wrapping in root layout
- Keep lucide-react-native for all icons
- Keep expo-haptics for tactile feedback
- Keep AsyncStorage for local persistence
- Keep TypeScript strict mode with typed props
- Keep app.json Expo configuration intact
- Keep dark-first design system (zinc-950 backgrounds)

Return a JSON object:
{
  "files": [{ "path": "...", "content": "..." }],
  "filesChanged": ["app/index.tsx"],
  "notes": "Summary of changes made"
}
Do NOT include any text before or after the JSON.`,
        },
        {
          role: "user",
          content: `Current files:\n${filesContext}\n\nRefinement request: ${refinementPrompt}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.0,
    },
    "mobile-refine",
  );

  let result: { files: Array<{ path: string; content: string }>; filesChanged: string[]; notes: string };
  try {
    result = JSON.parse(rawContent);
  } catch {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse refinement JSON");
    result = JSON.parse(jsonMatch[0]);
  }

  const hardened = hardenMobileTypes(result.files);
  result.files = hardened.files;

  const goldenPathChecks = runMobileGoldenPathChecks(result.files);
  const passed = goldenPathChecks.filter((c) => c.passed).length;
  const total = goldenPathChecks.length;

  const refinements = (project.refinements ?? []) as Array<{
    prompt: string;
    response: string;
    timestamp: string;
    filesChanged: string[];
    goldenPathScore: string;
    previousFiles: Array<{ path: string; content: string }>;
  }>;

  const refinement = {
    prompt: refinementPrompt,
    response: result.notes,
    timestamp: new Date().toISOString(),
    filesChanged: result.filesChanged,
    goldenPathScore: `${passed}/${total}`,
    previousFiles,
  };

  refinements.push(refinement);

  await db
    .update(projectsTable)
    .set({
      files: result.files,
      goldenPathChecks,
      refinements,
    })
    .where(eq(projectsTable.id, projectId));

  return {
    status: "refined",
    filesChanged: result.filesChanged,
    previousFiles,
    files: result.files,
    goldenPathChecks,
    refinement,
  };
}
