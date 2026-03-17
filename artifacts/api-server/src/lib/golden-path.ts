import { eq } from "drizzle-orm";
import { db, goldenPathConfigsTable } from "@workspace/db";
import type { GoldenPathConfigRules, GoldenPathRule } from "@workspace/db";
import { DEFAULT_GOLDEN_PATH_CONFIG } from "./golden-path-defaults";

export interface GoldenPathCheck {
  name: string;
  passed: boolean;
  description: string;
}

export async function getActiveConfig(): Promise<GoldenPathConfigRules> {
  try {
    const [active] = await db
      .select()
      .from(goldenPathConfigsTable)
      .where(eq(goldenPathConfigsTable.isActive, true))
      .limit(1);

    if (active?.rules) {
      return active.rules;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_GOLDEN_PATH_CONFIG;
}

export function buildSystemPrompt(config: GoldenPathConfigRules): string {
  const { techStack, folderStructure, security, codeQuality, database, errorHandling } = config;

  const securityRules: string[] = [];
  if (security.requireHelmet) securityRules.push("Use `helmet` for security headers.");
  if (security.noHardcodedSecrets) securityRules.push("NO hardcoded secrets; use `process.env.VAR_NAME`.");
  if (security.requireCors) securityRules.push("Implement CORS with a restricted origin (placeholder: `process.env.CLIENT_URL`).");
  if (security.requireRateLimiting) securityRules.push("Rate limiting on API endpoints.");

  const codeRules: string[] = [];
  if (codeQuality.strictTypeScript) codeRules.push("TypeScript strict mode.");
  if (codeQuality.noAnyTypes) codeRules.push("No `any` types.");
  if (codeQuality.explicitReturnTypes) codeRules.push("Explicit return types on exported functions.");
  if (codeQuality.esmImports) codeRules.push("ESM imports throughout.");

  const dbRules: string[] = [];
  if (database.requireSchema) dbRules.push(`Defined schema in \`${folderStructure.backend.find(p => p.includes("schema")) ?? "server/src/schema/"}\`.`);
  if (database.requireConnectionPooling) dbRules.push("Connection pooling.");
  if (database.requireParameterizedQueries) dbRules.push("Parameterized queries only.");

  const errorRules: string[] = [];
  if (errorHandling.requireGlobalHandler) errorRules.push("Global error handler middleware.");
  if (errorHandling.structuredResponses) errorRules.push("Structured error responses with status codes.");
  if (errorHandling.noStackTraceLeaks) errorRules.push("No stack traces leaked to clients in production.");

  return `### ROLE
You are the "Golden Path" Architect for a high-end Internal Developer Platform. Your goal is to generate full-stack, production-ready applications (${techStack.backend} backend + ${techStack.frontend} frontend) that follow strict enterprise standards.

### OUTPUT FORMAT
You must return a JSON object with a \`files\` array. Each object in the array must have a \`path\` (string) and \`content\` (string).
Example: { "files": [{ "path": "src/index.ts", "content": "..." }] }

### ENFORCED "GOLDEN PATH" RULES
1. **Structure**: 
   - Backend: ${folderStructure.backend.map(p => `\`${p}\``).join(", ")}.
   - Frontend: ${folderStructure.frontend.map(p => `\`${p}\``).join(", ")}.
   - Shared: ${folderStructure.shared.map(p => `\`${p}\``).join(", ")}.
   - Root: ${folderStructure.root.map(p => `\`${p}\``).join(", ")}.
2. **Security**: 
${securityRules.map(r => `   - ${r}`).join("\n")}
3. **Validation**: Every API route MUST use \`${techStack.validation}\` for input validation (request body and params).
4. **Consistency**: 
${codeRules.map(r => `   - ${r}`).join("\n")}
   - Use a shared \`types/\` directory for cross-boundary types.
5. **Database**: Use ${techStack.orm} ORM with:
${dbRules.map(r => `   - ${r}`).join("\n")}
   - Proper connection error handling.
6. **Error Handling**:
${errorRules.map(r => `   - ${r}`).join("\n")}
   - Graceful shutdown handling.
7. **Code Quality**:
   - Complete, functional code — no stubs or TODOs.
   - Modular file organization.

### TASK
Generate the requested application following these rules. Ensure the code is modular, documented with brief inline comments, and ready to be built via \`npm install && npm run build\`.

Do NOT include any text before or after the JSON. Only output the JSON object.`;
}

function runCheckRule(
  rule: GoldenPathRule,
  filePaths: string[],
  allContent: string,
): boolean {
  const { type, pattern } = rule.check;
  const patterns = pattern.split(",").map(p => p.trim());

  switch (type) {
    case "file_pattern":
      return patterns.every(p => filePaths.some(fp => fp.includes(p)));
    case "content_match":
      return patterns.every(p => allContent.toLowerCase().includes(p.toLowerCase()));
    case "content_not_match":
      try {
        const regex = new RegExp(pattern, "i");
        return !regex.test(allContent);
      } catch {
        return !allContent.toLowerCase().includes(pattern.toLowerCase());
      }
    default:
      return false;
  }
}

export function runGoldenPathChecks(
  files: Array<{ path: string; content: string }>,
  config?: GoldenPathConfigRules,
): GoldenPathCheck[] {
  const rules = config ?? DEFAULT_GOLDEN_PATH_CONFIG;
  const filePaths = files.map(f => f.path);
  const allContent = files.map(f => f.content).join("\n");

  return rules.checks.map(rule => ({
    name: rule.name,
    passed: runCheckRule(rule, filePaths, allContent),
    description: rule.description,
  }));
}

export const GOLDEN_PATH_SYSTEM_PROMPT = buildSystemPrompt(DEFAULT_GOLDEN_PATH_CONFIG);
