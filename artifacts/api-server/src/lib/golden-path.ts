export const GOLDEN_PATH_SYSTEM_PROMPT = `### ROLE
You are the "Golden Path" Architect for a high-end Internal Developer Platform. Your goal is to generate full-stack, production-ready applications (Express backend + React frontend) that follow strict enterprise standards.

### OUTPUT FORMAT
You must return a JSON object with a \`files\` array. Each object in the array must have a \`path\` (string) and \`content\` (string).
Example: { "files": [{ "path": "src/index.ts", "content": "..." }] }

### ENFORCED "GOLDEN PATH" RULES
1. **Structure**: 
   - Backend: \`server/src/routes/\`, \`server/src/middleware/\`, \`server/src/schema/\`.
   - Frontend: \`client/src/components/\`, \`client/src/hooks/\`.
   - Shared: \`types/\` for shared TypeScript interfaces.
   - Root: \`package.json\`, \`.env.example\`, \`tsconfig.json\`.
2. **Security**: 
   - Use \`helmet\` for security headers.
   - NO hardcoded secrets; use \`process.env.VAR_NAME\`.
   - Implement CORS with a restricted origin (placeholder: \`process.env.CLIENT_URL\`).
   - Rate limiting on API endpoints.
3. **Validation**: Every API route MUST use \`Zod\` for input validation (request body and params).
4. **Consistency**: 
   - Use TypeScript for both Frontend and Backend.
   - Use a shared \`types/\` directory for cross-boundary types.
   - ESM imports throughout.
   - Explicit return types on exported functions.
   - No \`any\` types.
5. **Database**: Use an ORM (Drizzle or Prisma) with a defined schema in \`server/src/schema/\`.
   - Connection pooling.
   - Parameterized queries only.
   - Proper connection error handling.
6. **Error Handling**:
   - Global error handler middleware.
   - Structured error responses with status codes.
   - No stack traces leaked to clients in production.
   - Graceful shutdown handling.
7. **Code Quality**:
   - TypeScript strict mode.
   - Complete, functional code — no stubs or TODOs.
   - Modular file organization.

### TASK
Generate the requested application following these rules. Ensure the code is modular, documented with brief inline comments, and ready to be built via \`npm install && npm run build\`.

Do NOT include any text before or after the JSON. Only output the JSON object.`;

export interface GoldenPathCheck {
  name: string;
  passed: boolean;
  description: string;
}

export function runGoldenPathChecks(files: Array<{ path: string; content: string }>): GoldenPathCheck[] {
  const filePaths = files.map(f => f.path);
  const allContent = files.map(f => f.content).join("\n");

  const checks: GoldenPathCheck[] = [
    {
      name: "Folder Structure",
      passed: filePaths.some(p => p.includes("server/")) && filePaths.some(p => p.includes("client/")) && filePaths.some(p => p.includes("package.json")),
      description: "Uses organized server/ and client/ directory structure with package.json",
    },
    {
      name: "Security Headers",
      passed: allContent.includes("helmet") && allContent.includes("cors"),
      description: "Includes Helmet for security headers and CORS configuration",
    },
    {
      name: "Input Validation",
      passed: allContent.includes("zod") || allContent.includes("z.object") || allContent.includes("z.string"),
      description: "Uses Zod schema-based input validation on API routes",
    },
    {
      name: "Environment Config",
      passed: allContent.includes("process.env") && filePaths.some(p => p.includes(".env")),
      description: "Configuration loaded from environment variables with .env.example provided",
    },
    {
      name: "No Hardcoded Secrets",
      passed: !allContent.match(/(?:password|secret|api_key|apikey|token)\s*[:=]\s*["'][A-Za-z0-9+/=]{8,}["']/i),
      description: "No hardcoded secrets, passwords, or API keys detected in source",
    },
    {
      name: "Error Handling",
      passed: allContent.includes("errorHandler") || (allContent.includes("catch") && allContent.includes("middleware")),
      description: "Includes structured error handling with global middleware",
    },
    {
      name: "TypeScript",
      passed: filePaths.some(p => p.endsWith(".ts") || p.endsWith(".tsx")) && (filePaths.some(p => p.includes("tsconfig")) || allContent.includes("typescript")),
      description: "Uses TypeScript with strict configuration",
    },
    {
      name: "Rate Limiting",
      passed: allContent.includes("rate") && allContent.includes("limit"),
      description: "API endpoints protected with rate limiting",
    },
    {
      name: "Database Schema",
      passed: filePaths.some(p => p.includes("schema/") || p.includes("schema.")),
      description: "Database schema defined in dedicated schema directory",
    },
  ];

  return checks;
}
