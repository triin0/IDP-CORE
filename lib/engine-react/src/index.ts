export { generateProjectCode } from "./generate";
export { generateProjectSpec } from "./spec-generator";
export { refineProject } from "./refine";

export { deployProject, generatePreviewHtml } from "./deploy";
export type { DeployResult } from "./deploy";

export { deleteSandbox, cleanupStaleSandboxes, createSandboxForProject, isSandboxConfigured, shutdownSandbox } from "./sandbox";
export type { SandboxResult } from "./sandbox";

export {
  generateSeedData,
  seedDataToSQL,
  seedDataToTypeScript,
  generateClientSeedFile,
  generateServerSeedFile,
  generateEmptyClientSeedFile,
  generateEmptyServerSeedFile,
} from "./seed-generator";
export type { SchemaTable, ColumnDef, SeedData, SeedRecord } from "./seed-generator";

export { AGENTS, GENERATION_AGENTS, VERIFICATION_AGENT, FIXER_AGENT_PROMPT } from "./agents";
export type { AgentRole, AgentDefinition, AgentContext, AgentOutput, AgentStageStatus } from "./agents";

export { annotateFileSource, annotateProjectFiles, mergeAnnotatedFiles } from "./source-annotator";
export type { AnnotatedFile } from "./source-annotator";

export { DESIGN_PERSONAS, getPersonaStyleTokens } from "./design-personas";
export type { DesignPersonaId, DesignPersona } from "./design-personas";

export {
  getActiveConfig,
  buildSystemPrompt,
  runGoldenPathChecks,
  getCriticalFailures,
  GOLDEN_PATH_SYSTEM_PROMPT,
} from "./golden-path";
export type { GoldenPathCheck } from "./golden-path";

export { DEFAULT_GOLDEN_PATH_CONFIG } from "./golden-path-defaults";

export { validateAllManifests } from "./dependency-audit";
export { runBuildVerification } from "./build-verification";
export { runASTVerification } from "./ast-verification";
export type { ASTVerificationResult } from "./ast-verification";
export { computeHashManifest, compareHashManifests, computeFullTreeHash, computeFullTreeManifest, computePayloadHash, computeSHA256 } from "./hash-integrity";
export type { HashManifest, FullTreeHashResult } from "./hash-integrity";
export { enforcePackageVersions } from "./version-enforcement";
export { hardenGeneratedTypes } from "./type-hardener";
export { recoverOrphanedProjects } from "./recovery";

export { runPipeline, initPipelineStatus, executeWithSelfHealing, buildExpectedHashManifest, runVerificationStage } from "./pipeline";
export type { FailureCategory, VerificationVerdict, PipelineStatus } from "./pipeline";
