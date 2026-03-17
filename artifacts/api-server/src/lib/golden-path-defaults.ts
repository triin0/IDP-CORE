import type { GoldenPathConfigRules } from "@workspace/db";

export const DEFAULT_GOLDEN_PATH_CONFIG: GoldenPathConfigRules = {
  techStack: {
    backend: "Express",
    frontend: "React",
    language: "TypeScript",
    orm: "Drizzle",
    validation: "Zod",
  },
  folderStructure: {
    backend: ["server/src/routes/", "server/src/middleware/", "server/src/schema/"],
    frontend: ["client/src/components/", "client/src/hooks/"],
    shared: ["types/"],
    root: ["package.json", ".env.example", "tsconfig.json"],
  },
  security: {
    requireHelmet: true,
    requireCors: true,
    requireRateLimiting: true,
    noHardcodedSecrets: true,
  },
  codeQuality: {
    strictTypeScript: true,
    noAnyTypes: true,
    explicitReturnTypes: true,
    esmImports: true,
  },
  database: {
    requireSchema: true,
    requireConnectionPooling: true,
    requireParameterizedQueries: true,
  },
  errorHandling: {
    requireGlobalHandler: true,
    structuredResponses: true,
    noStackTraceLeaks: true,
  },
  checks: [
    {
      name: "Folder Structure",
      description: "Uses organized server/ and client/ directory structure with package.json",
      promptInstruction: "Use server/src/ for backend and client/src/ for frontend code",
      check: { type: "file_pattern", pattern: "server/,client/,package.json" },
    },
    {
      name: "Security Headers",
      description: "Imports and uses Helmet for security headers and CORS configuration",
      promptInstruction: "Use helmet for security headers and configure CORS",
      critical: true,
      check: { type: "content_match", pattern: "helmet,cors" },
    },
    {
      name: "Input Validation",
      description: "Imports and uses Zod schema-based input validation on API routes",
      promptInstruction: "Every API route MUST use Zod for input validation",
      critical: true,
      check: { type: "content_match", pattern: "zod,z.object,z.string" },
    },
    {
      name: "Environment Config",
      description: "Configuration loaded from environment variables with .env.example provided",
      promptInstruction: "Use process.env for all configuration, provide .env.example",
      check: { type: "content_match", pattern: "process.env,.env" },
    },
    {
      name: "No Hardcoded Secrets",
      description: "No hardcoded secrets, passwords, or API keys detected in source",
      promptInstruction: "NO hardcoded secrets; use process.env.VAR_NAME",
      critical: true,
      check: {
        type: "content_not_match",
        pattern: "(?:password|secret|api_key|apikey|token)\\s*[:=]\\s*[\"'][A-Za-z0-9+/=]{8,}[\"']",
      },
    },
    {
      name: "Error Handling",
      description: "Includes structured error handling with global middleware",
      promptInstruction: "Implement global error handler middleware with structured responses",
      check: { type: "content_match", pattern: "error,catch,middleware" },
    },
    {
      name: "TypeScript",
      description: "Uses TypeScript with strict configuration",
      promptInstruction: "Use TypeScript with strict mode for all code",
      check: { type: "file_pattern", pattern: ".ts,.tsx,tsconfig" },
    },
    {
      name: "Rate Limiting",
      description: "API endpoints protected with rate limiting",
      promptInstruction: "Implement rate limiting on API endpoints",
      check: { type: "content_match", pattern: "rateLimit,rateLimiter,rate-limit" },
    },
    {
      name: "Database Schema",
      description: "Database schema defined in dedicated schema directory",
      promptInstruction: "Define database schema in server/src/schema/ directory",
      check: { type: "file_pattern", pattern: "schema/" },
    },
  ],
};
