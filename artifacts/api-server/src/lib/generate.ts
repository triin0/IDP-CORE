import { runPipeline } from "./pipeline";

export async function generateProjectCode(
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
): Promise<void> {
  await runPipeline(projectId, prompt, spec);
}
