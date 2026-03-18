export interface EngineSpec {
  overview: string;
  fileStructure: string[];
  apiEndpoints: Array<{ method: string; path: string; description: string }>;
  databaseTables: Array<{ name: string; columns: string[] }>;
  middleware: string[];
  architecturalDecisions: string[];
}

export interface RefineResult {
  status: string;
  filesChanged: string[];
  previousFiles: Array<{ path: string; content: string }>;
  files: Array<{ path: string; content: string }>;
  goldenPathChecks: Array<{ name: string; passed: boolean; description: string; critical?: boolean }>;
  refinement: {
    prompt: string;
    response: string;
    timestamp: string;
    filesChanged: string[];
    goldenPathScore: string;
    previousFiles: Array<{ path: string; content: string }>;
  };
  verificationVerdict?: unknown;
}

export interface SandpackConfig {
  template: string;
  files: Record<string, { code: string }>;
}

export interface GoldenPathRule {
  name: string;
  description: string;
  promptInstruction: string;
  critical?: boolean;
  check: {
    type: string;
    pattern?: string;
    file?: string;
  };
}

export interface EngineInterface {
  id: "react" | "fastapi";
  label: string;
  generateSpec(projectId: string, prompt: string, persona?: string): Promise<void>;
  runPipeline(projectId: string, prompt: string, spec?: EngineSpec, persona?: string): Promise<void>;
  refineProject(projectId: string, prompt: string): Promise<RefineResult>;
  getSandpackSupport(): boolean;
  getGoldenPathRules(): GoldenPathRule[];
}
