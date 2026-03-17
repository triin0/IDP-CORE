# AI-Native Internal Developer Platform (IDP) — MVP

## Overview

This project is an AI-Native Internal Developer Platform (IDP) designed to streamline application development. It functions as a pnpm workspace monorepo that accepts natural language prompts, generates multi-file applications adhering to enterprise "Golden Path" standards, and deploys them to live preview URLs. The platform aims to automate and standardize application creation, significantly reducing development time and ensuring compliance with best practices.

## User Preferences

I want iterative development. Ask before making major architectural changes or before deploying to production. For explanations, prioritize clarity and conciseness. I prefer seeing the overall plan before diving into code. Do not make changes to files in the `deployed-projects/` directory.

## System Architecture

The IDP is built as a pnpm workspace monorepo. It features an Express 5 API server for orchestration and a React frontend for the user interface. Data persistence is handled by PostgreSQL with Drizzle ORM. AI capabilities are supported by both OpenAI and Gemini Pro, with auto-selection based on API key availability.

**Core Technical Implementations:**

*   **Orchestration API:** The API server acts as the central conductor, managing project lifecycle from creation via natural language prompts to deployment. Key endpoints handle project creation, status polling (`pending` → `planning` → `planned` → `generating` → `validating` → `ready` → `deployed`, or `failed` / `failed_checks`), architectural spec approval/regeneration/updates, and deployment.
*   **Multi-Agent AI Pipeline:** Code generation is managed by a sequential 4-agent pipeline: Architect, Backend Developer, Frontend Developer, and Security Reviewer. Each agent builds upon the previous one's output, with a reconciler merging results and the Security Reviewer having final say on conflicts for security hardening.
*   **AI Provider Layer:** Supports dual AI providers (OpenAI `gpt-5.2` or Gemini Pro `gemini-2.5-pro`) with built-in retry logic. Token truncation (`finish_reason=length`) triggers up to 2 retries with 60% token reduction each time and conciseness instructions.
*   **Orphan Recovery:** Automatically restarts AI processing for projects stuck in `planning`, `generating`, or `validating` status due to server interruptions.
*   **Golden Path Engine:** Enforces enterprise standards for AI-generated code, covering structure, security, validation (Zod), database practices, error handling, and TypeScript usage. Eleven automated compliance checks run after generation. Critical checks (Security Headers, Input Validation, No Hardcoded Secrets) block projects from reaching "ready" status — the project transitions to `failed_checks` instead. Smart import detection strips comments before checking import/require patterns to avoid false positives.
*   **Dependency Audit:** Supply chain security check validating every AI-generated npm dependency: hallucination guard (package existence), slopsquatting guard (< 30 days old), low popularity guard (< 1000 weekly downloads), and CVE guard (OSV database). Key file: `dependency-audit.ts`.
*   **Build Verification:** After code generation, writes files to a temp directory and runs `npm install && npm run build` with path traversal protection. Key file: `build-verification.ts`.
*   **Deployment:** Generated projects deploy to live CodeSandbox cloud VMs (when `CSB_API_KEY` or `codesandbox_api` is set) for interactive previews at `*.csb.app` URLs. Falls back to static HTML preview if sandbox creation fails. Key file: `artifacts/api-server/src/lib/sandbox.ts`. DB fields: `sandboxId`, `deployUrl` on projects table.
*   **Frontend (MVP UI):** A React + Vite application using Tailwind CSS, Shadcn UI, and Framer Motion. It provides a terminal-styled prompt input, an architectural spec review interface with editing capabilities, real-time generation status, a results view with file tree and code viewer, Golden Path compliance checklist, quality gate failure display with critical/non-critical separation, and one-click deployment. A dedicated settings page allows for custom Golden Path configuration.

**UI/UX Decisions:**

*   **Design:** Dark mode professional theme with a terminal/developer aesthetic.
*   **Navigation:** Persistent header with clear navigation tabs (Projects, New, Settings).
*   **Information Display:** Real-time polling for generation status, syntax-highlighted code viewer, and clear health indicators for system and LLM connectivity.

**System Design Choices:**

*   **Monorepo Structure:** Uses pnpm workspaces for managing deployable applications and shared libraries.
*   **Database Schema:** `projects` table tracks project metadata, AI generation status, and outputs. `golden_path_configs` table stores customizable enterprise standards.
*   **TypeScript & Composite Projects:** Extensive use of TypeScript with project references for improved type safety and modularity across the monorepo.
*   **Config-Driven Generation:** The Golden Path engine is driven by active configurations stored in the database, allowing dynamic enforcement of standards.

## External Dependencies

*   **Monorepo Tool:** pnpm workspaces
*   **Database:** PostgreSQL + Drizzle ORM
*   **API Framework:** Express 5
*   **Validation:** Zod (`zod/v4`), `drizzle-zod`
*   **API Codegen:** Orval (from OpenAPI spec)
*   **AI Providers:** OpenAI (via Replit AI Integrations), Google Gemini Pro (`@google/generative-ai`)
*   **Build Tool:** esbuild
*   **Frontend Frameworks/Libraries:** React, Vite, Tailwind CSS, Shadcn UI, Framer Motion, Lucide React, `react-syntax-highlighter`
*   **Open Source Vulnerability Database:** OSV (for dependency auditing)

## Project Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (orchestration backend)
│   ├── idp-frontend/       # React frontend (MVP UI) — served at /
│   └── mockup-sandbox/     # Component preview sandbox
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/  # OpenAI SDK client (Replit AI Integrations)
├── deployed-projects/      # Generated project files written to disk on deploy
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Database Schema

### `projects` table
- `id` (UUID, PK) — auto-generated
- `prompt` (text) — user's natural language prompt
- `status` (enum: pending/planning/planned/generating/validating/ready/deployed/failed/failed_checks)
- `spec` (JSONB, nullable) — architectural spec `{ overview, fileStructure, apiEndpoints, databaseTables, middleware, architecturalDecisions }`
- `files` (JSONB) — array of `{ path, content }` objects
- `golden_path_checks` (JSONB) — array of `{ name, passed, description, critical? }`
- `sandbox_id` (text, nullable) — CodeSandbox VM ID
- `deploy_url` (text, nullable)
- `pipeline_status` (JSONB, nullable) — per-agent pipeline progress `{ stages: [{ role, label, status, startedAt?, completedAt?, fileCount?, filePaths?, notes?, error? }], currentAgent? }`
- `error` (text, nullable)
- `created_at` (timestamp)

### `golden_path_configs` table
- `id` (UUID, PK) — auto-generated
- `name` (varchar, not null) — config display name
- `description` (text, nullable)
- `rules` (JSONB, not null) — full GoldenPathConfigRules object (techStack, folderStructure, security, codeQuality, database, errorHandling, checks[])
- `is_active` (boolean, default false) — only one active config at a time
- `created_at` / `updated_at` (timestamps)

## Key Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 orchestration server with:
- `src/routes/projects.ts` — Project CRUD + deploy endpoints
- `src/routes/health.ts` — Health check with cached LLM probe (dual provider support)
- `src/lib/golden-path.ts` — Golden Path system prompt + compliance checker
- `src/lib/spec-generator.ts` — AI architectural spec generation (planning phase)
- `src/lib/generate.ts` — AI code generation (uses approved spec as context)
- `src/lib/deploy.ts` — File deployment to disk
- `src/lib/sandbox.ts` — CodeSandbox VM creation and deployment
- `src/lib/ai-retry.ts` — Dual-provider AI wrapper (OpenAI/Gemini) with retry logic
- `src/lib/recovery.ts` — Orphan project recovery on server startup
- `src/lib/build-verification.ts` — Build verification (npm install + npm run build in temp dir)
- `src/lib/dependency-audit.ts` — npm dependency audit (existence, age, downloads, vulnerabilities)
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-openai-ai-server`, `@google/generative-ai`

### `artifacts/idp-frontend` (`@workspace/idp-frontend`)

React + Vite frontend served at `/`:
- Uses generated React Query hooks from `@workspace/api-client-react`
- Dark professional theme with terminal aesthetic
- Framer Motion for animations
- Lucide React for icons

### `lib/db` (`@workspace/db`)

- `src/schema/projects.ts` — Projects table definition
- `src/schema/golden-path-configs.ts` — Golden Path configs table
- Push schema: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec with project orchestration endpoints. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` / `lib/api-client-react`

Generated Zod schemas and React Query hooks from the OpenAPI spec.

## TypeScript & Build

Every lib package extends `tsconfig.base.json` with `composite: true`. The root `tsconfig.json` lists lib packages as project references.

- **Always typecheck from root**: `pnpm run typecheck`
- **Build**: `pnpm run build` — typecheck then build all packages
- **Production**: `pnpm --filter @workspace/idp-frontend run build && pnpm --filter @workspace/api-server run build` then `node artifacts/api-server/dist/index.cjs`
