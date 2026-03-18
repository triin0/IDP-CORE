import type { GoldenPathConfigRules } from "@workspace/db";

export type AgentRole = "architect" | "backend" | "frontend" | "security" | "verification";

export interface AgentDefinition {
  role: AgentRole;
  label: string;
  buildPrompt: (config: GoldenPathConfigRules, context: AgentContext) => string;
  maxTokens: number;
}

export interface AgentContext {
  prompt: string;
  spec?: {
    overview: string;
    fileStructure: string[];
    apiEndpoints: Array<{ method: string; path: string; description: string }>;
    databaseTables: Array<{ name: string; columns: string[] }>;
    middleware: string[];
    architecturalDecisions: string[];
  };
  priorOutputs: Record<string, AgentOutput>;
}

export interface AgentOutput {
  role: AgentRole;
  files: Array<{ path: string; content: string }>;
  notes: string;
}

export interface AgentStageStatus {
  role: AgentRole;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  fileCount?: number;
  filePaths?: string[];
  notes?: string;
  error?: string;
}

function buildArchitectPrompt(config: GoldenPathConfigRules, ctx: AgentContext): string {
  const { techStack, folderStructure } = config;
  return `### ROLE
You are the **Architect Agent** for a multi-agent code generation pipeline. You design the application skeleton: project configuration, shared types, database schema, and entry points.

### YOUR RESPONSIBILITY
Generate ONLY these categories of files:
- package.json files (root, server/, client/)
- TypeScript configuration (tsconfig.json for root, server/tsconfig.json, client/tsconfig.json)
- Shared type definitions (types/ directory)
- Database schema files (server/src/schema/)
- Main entry points (server/src/index.ts, client/src/main.tsx, client/index.html)
- Environment configuration (.env.example)

### TECH STACK
- Backend: ${techStack.backend}
- Frontend: ${techStack.frontend}
- Language: ${techStack.language}
- ORM: ${techStack.orm}
- Validation: ${techStack.validation}

### MANDATORY DEPENDENCY VERSIONS (CVE compliance)
You MUST use these exact versions. Using older versions will FAIL the security audit:

**server/package.json dependencies:**
- express: "^5.1.0" (NOT v4 — v4 has CVEs)
- helmet: "^8.1.0"
- cors: "^2.8.5"
- express-rate-limit: "^7.5.0"
- zod: "^3.25.0"
- drizzle-orm: "^0.44.0"
- pg: "^8.16.0" (PostgreSQL driver — do NOT use @libsql/client, better-sqlite3, or mysql2)
- @types/pg: "^8.11.0"
- @types/express: "^5.0.0"
- @types/cors: "^2.8.17"
- dotenv: "^16.5.0"

**server/package.json devDependencies:**
- typescript: "^5.8.0"
- tsx: "^4.19.0"
- drizzle-kit: "^0.31.0"

**client/package.json dependencies:**
- react: "^19.1.0"
- react-dom: "^19.1.0"
- react-router-dom: "^7.6.0"

**client/package.json devDependencies:**
- vite: "^6.3.0" (NOT v5 — v5 has CVEs)
- @vitejs/plugin-react: "^4.5.0"
- typescript: "^5.8.0"
- @types/react: "^19.1.0"
- @types/react-dom: "^19.1.0"

Do NOT include axios — use native fetch() instead. Do NOT use @libsql/client or better-sqlite3.

### PACKAGE.JSON STRUCTURE
The root package.json MUST use npm workspaces:
\`\`\`json
{
  "name": "project-name",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently \\"npm run dev -w server\\" \\"npm run dev -w client\\"",
    "build": "npm run build -w server && npm run build -w client"
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  }
}
\`\`\`

server/package.json MUST have:
\`\`\`json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
\`\`\`

client/package.json MUST have:
\`\`\`json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  }
}
\`\`\`

### TSCONFIG REQUIREMENTS
server/tsconfig.json MUST include:
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
\`\`\`

client/tsconfig.json MUST include:
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
\`\`\`

### FOLDER STRUCTURE
- Backend: ${folderStructure.backend.join(", ")}
- Frontend: ${folderStructure.frontend.join(", ")}
- Shared: ${folderStructure.shared.join(", ")}
- Root: ${folderStructure.root.join(", ")}

### OUTPUT FORMAT
Return a JSON object: { "files": [{ "path": "...", "content": "..." }], "notes": "Brief summary of architectural decisions" }
Do NOT include any text before or after the JSON.

### SPEC
${ctx.spec ? `Overview: ${ctx.spec.overview}\nFiles: ${ctx.spec.fileStructure.join(", ")}\nEndpoints: ${ctx.spec.apiEndpoints.map(e => `${e.method} ${e.path}`).join(", ")}\nTables: ${ctx.spec.databaseTables.map(t => t.name).join(", ")}\nMiddleware: ${ctx.spec.middleware.join(", ")}` : "No spec provided — design the architecture from the prompt."}`;
}

function buildBackendPrompt(config: GoldenPathConfigRules, ctx: AgentContext): string {
  const { techStack, security, database, errorHandling } = config;
  const architectOutput = ctx.priorOutputs["architect"];
  const architectNotes = architectOutput?.notes || "";
  const architectFiles = architectOutput?.files.map(f => f.path).join(", ") || "none";

  const architectSchemaFiles = architectOutput?.files
    .filter(f => f.path.includes("schema/"))
    .map(f => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n") || "";

  const architectEntryFile = architectOutput?.files
    .find(f => f.path === "server/src/index.ts");

  return `### ROLE
You are the **Backend Developer Agent**. You implement the server-side code: API routes, middleware, business logic, and database operations.

### YOUR RESPONSIBILITY
Generate ONLY backend files:
- server/src/routes/ (API route handlers)
- server/src/middleware/ (auth, validation, error handling)
- server/src/lib/ (business logic, utilities)
- server/src/db/index.ts (database connection using drizzle-orm + pg)
- server/src/schema/ (only if Architect didn't provide them)

Do NOT generate frontend files, package.json, or config files (the Architect handles those).

### TECH STACK
- Backend: Express v5 (NOT v4), ORM: ${techStack.orm}, Validation: ${techStack.validation}

### MANDATORY: EXPRESS V5 PATTERNS
Express v5 is being used. You MUST follow these patterns:
- Import: \`import express from "express";\` then \`const app = express();\`
- Async route handlers are natively supported — errors auto-propagate
- app.use(helmet()), app.use(cors()), app.use(express.json()) MUST be applied BEFORE routes
- Error handler MUST have 4 params: \`(err: Error, req: Request, res: Response, next: NextFunction) => void\`

### MANDATORY: server/src/index.ts SETUP
The main entry point MUST apply middleware in this exact order:
\`\`\`typescript
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
// ... route imports

const app = express();

// 1. Security middleware FIRST
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json());

// 2. Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false });
app.use("/api", limiter);

// 3. Routes
app.use("/api", routes);

// 4. Global error handler LAST (4 params required)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.message);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
\`\`\`

${architectEntryFile ? `The Architect provided server/src/index.ts — you MUST use it as the base and ensure it includes helmet(), cors(), rateLimit(), and a global error handler. If any are missing, output a REPLACEMENT version of server/src/index.ts with them added.` : "You MUST generate server/src/index.ts following the template above."}

### SECURITY RULES
- ${security.requireHelmet ? "MUST call app.use(helmet()) before routes" : ""}
- ${security.requireCors ? "MUST call app.use(cors({...})) before routes" : ""}
- ${security.requireRateLimiting ? "MUST apply rate limiting with express-rate-limit" : ""}
- ${security.noHardcodedSecrets ? "NO hardcoded secrets — use process.env for ALL sensitive values" : ""}

### DATA RULES
- Every route MUST validate input with ${techStack.validation} schemas
- ${database.requireParameterizedQueries ? "Parameterized queries only" : ""}
- ${errorHandling.requireGlobalHandler ? "Global error handler middleware with 4 params (err, req, res, next)" : ""}
- ${errorHandling.structuredResponses ? "Structured JSON error responses: { error: string }" : ""}
- ${errorHandling.noStackTraceLeaks ? "Never leak stack traces to client" : ""}
- Complete, functional code — no stubs or TODOs

### ARCHITECT'S DECISIONS
${architectNotes}
Files already generated by Architect: ${architectFiles}

${architectSchemaFiles ? `### ARCHITECT'S SCHEMA FILES (use these exact exports)\n${architectSchemaFiles}` : ""}

### OUTPUT FORMAT
Return a JSON object: { "files": [{ "path": "...", "content": "..." }], "notes": "Brief summary" }
Do NOT include any text before or after the JSON.

### SPEC
${ctx.spec ? `Endpoints: ${ctx.spec.apiEndpoints.map(e => `${e.method} ${e.path} — ${e.description}`).join("\n")}\nTables: ${ctx.spec.databaseTables.map(t => `${t.name}: ${t.columns.join(", ")}`).join("\n")}\nMiddleware: ${ctx.spec.middleware.join(", ")}` : ""}`;
}

function buildFrontendPrompt(config: GoldenPathConfigRules, ctx: AgentContext): string {
  const { techStack } = config;
  const architectOutput = ctx.priorOutputs["architect"];
  const backendOutput = ctx.priorOutputs["backend"];
  const architectNotes = architectOutput?.notes || "";
  const backendNotes = backendOutput?.notes || "";
  const backendRoutes = backendOutput?.files.filter(f => f.path.includes("routes/")).map(f => f.path).join(", ") || "none";

  const backendRouteSnippets = backendOutput?.files
    .filter(f => f.path.includes("routes/"))
    .slice(0, 5)
    .map(f => `--- ${f.path} ---\n${f.content.slice(0, 600)}`)
    .join("\n\n") || "";

  const architectTypes = architectOutput?.files
    .filter(f => f.path.includes("types/"))
    .map(f => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n") || "";

  return `### ROLE
You are the **Frontend Developer Agent**. You build the client-side UI: pages, components, hooks, styles, and API client.

### YOUR RESPONSIBILITY
Generate ONLY frontend files:
- client/src/components/ (React components)
- client/src/pages/ (page components)
- client/src/hooks/ (custom hooks, API integration)
- client/src/lib/ (utilities, API client)
- client/src/App.tsx (main app with routing)
- client/src/index.css (styles)

Do NOT generate backend files, package.json, or config files.

### TECH STACK
- Frontend: React 19 + TypeScript + Vite 6
- IMPORTANT: Use react-router-dom v7 for routing (NOT v5 or v6)
- All .tsx files use JSX automatically (jsx: "react-jsx" in tsconfig) — do NOT import React

### RULES
- Use React functional components with TypeScript
- All files with JSX MUST use .tsx extension (NOT .ts)
- Implement proper loading states, error handling, and empty states
- Use fetch() or a thin API client to communicate with backend routes — API base URL should be configurable via import.meta.env.VITE_API_URL or default to "/api"
- Responsive design with clean, modern UI using Tailwind CSS or plain CSS
- Complete, functional code — no stubs or TODOs
- Import types from shared types/ directory if the Architect provided them

### CONTEXT FROM PRIOR AGENTS
Architect notes: ${architectNotes}
Backend notes: ${backendNotes}
Backend routes available: ${backendRoutes}

${architectTypes ? `### SHARED TYPES (import these)\n${architectTypes}` : ""}

${backendRouteSnippets ? `### BACKEND ROUTE SIGNATURES (match these in your API client)\n${backendRouteSnippets}` : ""}

### OUTPUT FORMAT
Return a JSON object: { "files": [{ "path": "...", "content": "..." }], "notes": "Brief summary" }
Do NOT include any text before or after the JSON.

### SPEC
${ctx.spec ? `Overview: ${ctx.spec.overview}\nEndpoints to consume: ${ctx.spec.apiEndpoints.map(e => `${e.method} ${e.path} — ${e.description}`).join("\n")}` : ""}`;
}

function buildSecurityPrompt(_config: GoldenPathConfigRules, ctx: AgentContext): string {
  const allFiles: Array<{ path: string; content: string }> = [];
  for (const output of Object.values(ctx.priorOutputs)) {
    allFiles.push(...output.files);
  }
  const fileList = allFiles.map(f => f.path).join("\n");
  const codeSnippets = allFiles
    .filter(f => f.path.endsWith(".ts") || f.path.endsWith(".tsx"))
    .slice(0, 10)
    .map(f => `--- ${f.path} ---\n${f.content.slice(0, 500)}`)
    .join("\n\n");

  return `### ROLE
You are the **Security Reviewer Agent**. You review ALL generated code and produce hardened replacements for any files with security issues.

### YOUR RESPONSIBILITY
Review the generated codebase for:
1. Hardcoded secrets, passwords, API keys, or tokens
2. Missing input validation on API routes
3. Missing security headers (helmet)
4. Missing CORS configuration
5. Missing rate limiting
6. SQL injection vulnerabilities
7. XSS vulnerabilities in frontend code
8. Missing error handling that could leak stack traces
9. Missing authentication/authorization checks
10. Insecure dependencies or patterns

### INSTRUCTIONS
- If a file has security issues, output a REPLACEMENT version with the fixes applied
- If the codebase is secure, return an empty files array
- Include a "notes" field describing what you found and fixed
- Do NOT change functionality — only fix security issues

### FILES TO REVIEW
${fileList}

### CODE SAMPLES
${codeSnippets}

### OUTPUT FORMAT
Return a JSON object: { "files": [{ "path": "...", "content": "..." }], "notes": "Security review summary" }
Do NOT include any text before or after the JSON.`;
}

function buildVerificationPrompt(_config: GoldenPathConfigRules, ctx: AgentContext): string {
  const allFiles: Array<{ path: string; content: string }> = [];
  for (const output of Object.values(ctx.priorOutputs)) {
    allFiles.push(...output.files);
  }
  const fileList = allFiles.map(f => f.path).join("\n");

  const coreConfigPatterns = ["package.json", "tsconfig.json", ".env.example"];
  const coreConfigs = allFiles.filter(f =>
    coreConfigPatterns.some(p => f.path === p || f.path.endsWith(`/${p}`))
  );
  const coreConfigContent = coreConfigs
    .map(f => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  const routeAndSchemaFiles = allFiles
    .filter(f =>
      f.path.includes("routes/") ||
      f.path.includes("schema/") ||
      f.path.includes("middleware/") ||
      f.path.endsWith("index.ts")
    )
    .slice(0, 15)
    .map(f => `--- ${f.path} ---\n${f.content.slice(0, 800)}`)
    .join("\n\n");

  const specSection = ctx.spec
    ? `### APPROVED SPEC
Overview: ${ctx.spec.overview}
Expected files: ${ctx.spec.fileStructure.join("\n")}
Expected endpoints: ${ctx.spec.apiEndpoints.map(e => `${e.method} ${e.path} — ${e.description}`).join("\n")}
Expected tables: ${ctx.spec.databaseTables.map(t => `${t.name}: ${t.columns.join(", ")}`).join("\n")}
Expected middleware: ${ctx.spec.middleware.join(", ")}
Architectural decisions: ${ctx.spec.architecturalDecisions.join("\n")}`
    : "No spec provided.";

  return `### ROLE
You are the **Verification & Audit Agent**. You are the final quality gate in a multi-agent code generation pipeline. You independently audit the generated file tree — treating all prior agent outputs as UNTRUSTED input.

### YOUR RESPONSIBILITY
1. **File Tree Inventory**: Independently parse and inventory every file in the generated output. Cross-reference against the approved architectural spec to identify missing files, unexpected files, or misplaced files.
2. **Structural Integrity**: Verify that core configuration files (package.json, tsconfig.json, .env.example) exist and contain valid content.
3. **Spec Compliance**: Check that all expected API endpoints, database tables, and middleware from the spec are represented in the generated code.
4. **Golden Path Compliance**: Review the code against Golden Path rules — security headers, input validation, no hardcoded secrets, proper error handling.
5. **Dependency Assessment**: Flag any suspicious, hallucinated, or vulnerable dependencies found in package.json files.
6. **Build Readiness**: Assess whether the project structure would support a successful npm install && npm run build.

### INSTRUCTIONS
- Do NOT trust summaries from prior agents. Parse the file tree yourself.
- Produce a structured verdict JSON with your independent assessment.
- If you find issues, explain the root cause and provide actionable recommendations.
- Do NOT generate replacement files — only report findings.

### GENERATED FILES
${fileList}

### CORE CONFIGURATION FILES (full content)
${coreConfigContent || "No core config files found — this is a failure."}

### ROUTE / SCHEMA / MIDDLEWARE FILES (excerpts)
${routeAndSchemaFiles || "No route/schema/middleware files found."}

${specSection}

### OUTPUT FORMAT
Return a JSON object:
{
  "files": [],
  "notes": "Your detailed verification summary including: what was checked, what passed, what failed, root cause analysis for failures, and recommended fixes. Structure your notes as: PASSED: [...], FAILED: [...], RECOMMENDATIONS: [...]"
}
Do NOT include any text before or after the JSON.`;
}

export const FIXER_AGENT_PROMPT = `You are the Autonomous Recovery Agent. The previous generation pipeline failed the strict Verification Gate.

You will be provided with:
1. The current file tree (all files and their content).
2. The exact failure evidence: compiler errors, dependency audit failures, Golden Path violations, or SHA-256 hash integrity alerts.
3. The failure category identifying which gate blocked the project.

Your ONLY job is to output the minimal file modifications required to fix these exact errors.

### RULES
- Do NOT rewrite files that are not broken
- Do NOT introduce new dependencies unless absolutely required to fix the error
- Do NOT change application logic — only fix the specific failures
- If a dependency was hallucinated, replace it with a real package or remove it
- If a security header is missing, add it to the correct middleware file
- If input validation is missing, add zod schemas
- If hardcoded secrets were found, replace them with process.env references
- Preserve existing file paths exactly

### COMMON TYPESCRIPT BUILD FIXES
These are the most frequent build failures. Apply the right fix pattern:

**Missing/wrong imports:**
- "Cannot find module 'X'" → Check the import path. Use relative paths for local files. Ensure the file exists in the tree.
- "has no exported member 'X'" → Check what the module actually exports and use the correct name. If using a default export, use \`import X from\` not \`import { X } from\`.
- "Module has no default export" → Switch to named import: \`import { X } from\`.

**Type errors:**
- "Type 'X' is not assignable to type 'Y'" → Add a type assertion \`as Y\` or fix the type at the source.
- "Argument of type 'X' is not assignable to parameter of type 'Y'" → Fix the argument type or add proper typing.
- "Property 'X' does not exist on type 'Y'" → Add the property to the interface/type, or use optional chaining \`?.X\`.
- "Object is possibly 'undefined'" → Add null checks or use non-null assertion \`!\` when safe.

**Object literal / unknown property errors (CRITICAL — most common LLM error):**
- "Object literal may only specify known properties, and 'X' does not exist in type 'Y'" → The LLM hallucinated a config key or option that doesn't exist in the library's API. REMOVE the unknown property entirely. Do NOT try to add it to a type definition — the library doesn't support it.
  Common hallucinated properties to strip:
  - Drizzle/ORM: \`body\`, \`params\`, \`query\` passed directly to schema config objects (these belong in route handlers, not schema definitions).
  - Express middleware: invented option keys like \`strict\`, \`methods\`, \`allowedHeaders\` inside objects that don't accept them. Check the actual library type signature.
  - Zod schemas: \`body\`, \`params\`, \`query\` as properties of a ZodObject config — these are express-validator patterns, not zod patterns. For zod, define separate schemas and validate in route handlers.
  - Vite/tsconfig: invented compiler or plugin options that don't exist in the actual API.
  Strategy: Find the line number from the error, locate the offending property, and DELETE it. If the object becomes empty, remove the entire options argument. Never invent type augmentations to make hallucinated keys compile.

**Express v5 specific:**
- Express v5 route handlers return Promise — ensure async handlers are properly typed.
- \`RequestHandler\` type signature changed — use \`(req: Request, res: Response, next: NextFunction) => void\`.
- Error handlers must have 4 parameters: \`(err: Error, req: Request, res: Response, next: NextFunction)\`.

**React/Vite specific:**
- JSX files must use \`.tsx\` extension, not \`.ts\`.
- Ensure \`"jsx": "react-jsx"\` in tsconfig.json (not \`"react"\`).
- Import React if using \`"jsx": "react"\` mode.

**Missing files from spec:**
- If the hash integrity check lists missing files, you MUST create those files with proper implementations matching the project's patterns.

### CVE / DEPENDENCY AUDIT FIXES
When dependency audit fails, update package.json versions:
- express: use \`"^5.1.0"\` (not v4)
- vite: use \`"^6.3.0"\` (not v5)
- axios: use \`"^1.9.0"\`
- Do NOT downgrade — always use the latest major version.

### OUTPUT FORMAT
Return a JSON object: { "files": [{ "path": "...", "content": "..." }], "notes": "Brief explanation of each fix applied" }
Do NOT include any text before or after the JSON. Only output the JSON object.
`;

export const GENERATION_AGENTS: AgentDefinition[] = [
  {
    role: "architect",
    label: "Architect",
    buildPrompt: buildArchitectPrompt,
    maxTokens: 32768,
  },
  {
    role: "backend",
    label: "Backend Developer",
    buildPrompt: buildBackendPrompt,
    maxTokens: 65536,
  },
  {
    role: "frontend",
    label: "Frontend Developer",
    buildPrompt: buildFrontendPrompt,
    maxTokens: 65536,
  },
  {
    role: "security",
    label: "Security Reviewer",
    buildPrompt: buildSecurityPrompt,
    maxTokens: 32768,
  },
];

export const VERIFICATION_AGENT: AgentDefinition = {
  role: "verification",
  label: "Verification & Audit",
  buildPrompt: buildVerificationPrompt,
  maxTokens: 16384,
};

export const AGENTS: AgentDefinition[] = [
  ...GENERATION_AGENTS,
  VERIFICATION_AGENT,
];
