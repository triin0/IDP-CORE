# AI-Native Internal Developer Platform (IDP.CORE) — MVP

## Overview

An AI-Native Internal Developer Platform that accepts natural language prompts, uses a multi-agent LLM pipeline to generate complete multi-file applications following "Golden Path" enterprise standards, deploys to live CodeSandbox sandboxes, and provides a real-time observable UI. Secured with Replit Auth multi-tenancy and styled with "The Glass Engine" design system.

## User Preferences

Iterative development. Ask before making major architectural changes or deploying to production. Prioritize clarity and conciseness. Show the overall plan before coding. Do not modify files in `deployed-projects/`.

## System Architecture

The IDP is a pnpm workspace monorepo with an Express 5 API server (orchestration), a React frontend (observation UI), PostgreSQL + Drizzle ORM for persistence, and dual AI providers (Gemini Pro primary, OpenAI fallback).

**Core Backend Systems:**

*   **Orchestration API:** Express 5 server managing the full project lifecycle. Status flow: `pending` → `planning` → `planned` → `generating` → `validating` → `ready` → `deployed` (or `failed` / `failed_checks` / `failed_validation`). Secured with helmet, CORS (`origin: true`), rate limiting (100 req/15min), and `trust proxy`.
*   **Multi-Agent AI Pipeline:** Sequential 6-agent pipeline: Architect → Backend Developer → Frontend Developer → Security Reviewer → Verification & Audit Agent → Fixer Agent (on-demand). The Verification Agent runs Golden Path checks, dependency audit, build verification, and SHA-256 hash computation. On failure, the **Self-Healing Loop** triggers the Fixer Agent with exact error evidence, retrying up to 3 times.
*   **AI Provider Layer:** Dual providers — Gemini Pro (`gemini-2.5-pro`, 65K output tokens) and OpenAI (`gpt-5.2`, 16K output tokens). Built-in retry logic and **token continuation loop** (up to 4 continuations on `MAX_TOKENS`). Agent-specific token limits: Architect 32K, Backend/Frontend 65K, Security 32K, Verification 16K, Fixer 32K.
*   **Orphan Recovery:** On startup, restarts AI processing for projects stuck in `planning`/`generating`/`validating`. Sequential with try/catch — failures update status to `failed`.
*   **Golden Path Engine:** Eleven automated compliance checks covering structure, security, validation (Zod), database, error handling, and TypeScript. Critical checks (Security Headers, Input Validation, No Hardcoded Secrets) block `ready` status. Smart import detection strips comments to avoid false positives. Config-driven via `golden_path_configs` table.
*   **AST-Level Verification (ts-morph):** Parses generated TypeScript via Abstract Syntax Tree to programmatically verify security middleware exists in the execution path. Checks: helmet() CallExpression before routes, cors() invocation, rate-limit import, Zod validation import, global error handler (4-param middleware). Failures trigger `ast_violation` category in self-healing loop. Key file: `ast-verification.ts`.
*   **Dependency Audit (OSV Guard):** Validates AI-generated npm packages: existence (hallucination guard), age (< 30 days = slopsquatting), popularity (< 1000 weekly downloads), CVEs (OSV database). Runs before build. Key file: `dependency-audit.ts`.
*   **Build Verification (Closed-Loop Compiler):** Writes generated files to temp directory, runs `npm install && npm run build`, captures exit code + stderr. On failure, feeds stderr to Fixer Agent for automated repair. 120s timeout. Key file: `build-verification.ts`.
*   **Cryptographic Hash Manifest:** SHA-256 hashes every generated file, compares full tree against Architect spec's `fileStructure` array (match ratio), computes aggregate payload hash for entire project. Payload hash locked in PostgreSQL `payload_hash` column on verification pass. Prevents shadow branches and silently dropped files. Key file: `hash-integrity.ts`.
*   **Authentication & Multi-Tenancy:** Replit Auth (OIDC with PKCE). Server-side PostgreSQL sessions with httpOnly secure cookies. `requireAuth` middleware on all mutation routes. `loadOwnedProject()` helper enforces ownership (IDOR prevention). Project list scoped to authenticated user. Key files: `lib/auth.ts`, `middlewares/authMiddleware.ts`, `routes/auth.ts`.
*   **Credit-Based Billing:** Append-only ledger with cached balance. Reserve→Settle/Refund lifecycle: atomic conditional debit (`UPDATE WHERE balance >= amount`), idempotent settle/refund with `status='pending'` guard. Costs: generation=50, refinement=10, verification_only=2, starter_grant=100. Gate: `POST /approve-spec` (50 credits), `POST /refine` (10 credits). 402 response on insufficient credits. UI: ComputeWallet in header (live balance), cost badges on GENERATE and Refine buttons. Key files: `lib/credits.ts`, `routes/credits.ts`, `schema/credits.ts`. DB tables: `user_credits` (cached balance), `credit_ledger` (append-only log).
*   **Iterative Refinement:** Delta-only regeneration using existing files + spec as context. Saves `previousFiles` snapshot before merge for diff viewing. Full verification stage after refinement. History tracked in `refinements` JSONB array. Key file: `refine.ts`.
*   **Deployment:** CodeSandbox cloud VMs (when `CSB_API_KEY`/`codesandbox_api` set) for live previews at `*.csb.app`. Falls back to static HTML. Key file: `sandbox.ts`.
*   **Sandbox Lifecycle:** Auto-cleanup every 6 hours (projects > 72h old). Manual via `POST /api/projects/cleanup-sandboxes`. Delete endpoint destroys sandbox VM before DB purge.
*   **GitHub Export:** `POST /projects/:id/export-to-github` — creates a new GitHub repo, commits the full file tree + `sha256-manifest.json` + `verification-audit.json` + `.github/workflows/verify.yml` (CI pipeline that re-runs SHA-256 and security checks on every PR). Uses Replit Connectors SDK proxy pattern for GitHub OAuth. Key files: `lib/github.ts`, `routes/export.ts`.
*   **ZIP Export:** `POST /projects/:id/export-zip` — streams a ZIP archive of all project files plus `verification-audit.json` (hashes, golden path results, payload hash comparison) and `sha256-manifest.json`. Uses `archiver` for in-memory ZIP creation. Key file: `routes/export.ts`.
*   **Project Delete:** `DELETE /projects/:id` — destroys sandbox VM + removes DB record. Confirmation dialog in UI prevents accidental deletion.
*   **Real-Time SSE:** `PipelineEventBus` emits structured events: `stage:start/complete/fail`, `verification:start/gate/complete`, `self-healing:attempt/success/exhausted`, `build:output`, `pipeline:log/complete/error`. SSE endpoint auto-closes on terminal events. 15-second heartbeat.

**Frontend (Observable UI):**

*   **Live Pipeline Visualization:** Horizontal bar with 5 agent nodes (Architect, Backend, Frontend, Security, Verify) that glow neon green with pulse animations as SSE reports active agents. Adds 6th "Fixer" node during self-healing. Key file: `AgentPipelineBar.tsx`.
*   **Agent Trajectory Dashboard:** Vertical sidebar with per-agent stage cards, self-healing indicators, verification gate display. Key file: `TrajectoryDashboard.tsx`.
*   **Live Terminal:** Colorized SSE output with auto-scroll/scroll-lock, line numbers. Key file: `LiveTerminal.tsx`.
*   **Build Verification Gate:** 5-gate visual checklist (Golden Path, Dependencies, Build, Hash Integrity, Security). Key file: `BuildGate.tsx`.
*   **Git-Style Diff Viewer:** Unified diffs with line numbers, add/remove highlighting, per-file collapsible sections, copy-to-clipboard. Auto-shows after refinement, "View Diff" on history items. Key file: `DiffViewer.tsx`.
*   **Other:** Sandbox preview iframe, spec review, file tree + code viewer, Golden Path compliance checklist, one-click deploy, Golden Path config editor (Settings page).

**UI/UX — "The Glass Engine" Design System:**

*   **Design:** Deep space black (#09090b) canvas. Frosted glass panels (`rgba(255,255,255,0.03)` + `backdrop-filter: blur(12px)`). CSS utilities: `.glass-panel`, `.glass-panel-hover`, `.glass-panel-strong`, `.hud-badge`, `.glow-line`. CSS variables: `--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-bg-hover`.
*   **Typography:** Inter (UI), JetBrains Mono (code/logs/terminal/badges). Imported via Google Fonts.
*   **Color State Machine:** Brand/Action = Cyan (`--primary: 192 90% 53%`), Success = Emerald (`--success: 155 80% 44%`), Warning = Amber (`--warning: 38 92% 50%`), Fail = Crimson (`--destructive: 0 84% 60%`).
*   **Global HUD:** Cockpit-style frosted header (`glass-panel-strong`) with `glow-line` separator. Left: logo (icon in ring box) + nav tabs (ring-highlighted active). Center: SYS/LLM/SANDBOX telemetry badges with `hud-pulse` animation. Right: Compute Wallet (Cycles gauge) + user auth.
*   **Animations:** `cursor-blink`, `pulse-glow`, `hud-pulse`, `glass-shimmer`, `slide-up`, `fade-in`. Framer Motion for component transitions.

## External Dependencies

*   **Monorepo:** pnpm workspaces
*   **Database:** PostgreSQL + Drizzle ORM (`drizzle-orm`, `drizzle-zod`, `drizzle-kit`)
*   **API:** Express 5, helmet, cors, express-rate-limit, cookie-parser, archiver (ZIP export)
*   **Auth:** openid-client (OIDC/PKCE)
*   **GitHub:** `@replit/connectors-sdk` (OAuth proxy to GitHub API for repo creation/commit)
*   **Validation:** Zod (`zod/v4`)
*   **API Codegen:** Orval (OpenAPI → React Query hooks + Zod schemas)
*   **AI:** `@google/generative-ai` (Gemini), OpenAI SDK (via Replit AI Integrations)
*   **Build:** esbuild, tsx (dev)
*   **Frontend:** React 19, Vite 7, Tailwind CSS v4, Shadcn UI, Framer Motion, Lucide React, react-syntax-highlighter, diff (v7)
*   **Vulnerability DB:** OSV

## Project Structure

```text
/
├── artifacts/                    # Deployable applications
│   ├── api-server/               # Express 5 orchestration backend (port 8080)
│   │   └── src/
│   │       ├── routes/           # projects.ts, auth.ts, health.ts, credits.ts, export.ts
│   │       ├── lib/              # ai-retry, generate, refine, spec-generator, golden-path,
│   │       │                     # deploy, sandbox, pipeline-events, recovery, credits, github,
│   │       │                     # build-verification, dependency-audit, hash-integrity, auth
│   │       └── middlewares/      # authMiddleware.ts
│   ├── idp-frontend/             # React frontend served at / (port from $PORT)
│   │   └── src/
│   │       ├── pages/            # Dashboard, Home, ProjectView, Settings, Preview
│   │       ├── components/       # AgentPipelineBar, TrajectoryDashboard, LiveTerminal,
│   │       │                     # BuildGate, SandboxPreview, PromptForm, SpecReview,
│   │       │                     # Workspace, DiffViewer, RefinementChat, HealthIndicator
│   │       └── hooks/            # usePipelineStream (SSE consumer), useCredits (balance API)
│   └── mockup-sandbox/           # Component preview sandbox
├── lib/                          # Shared libraries
│   ├── api-spec/                 # OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/         # Generated React Query hooks
│   ├── api-zod/                  # Generated Zod schemas
│   ├── db/                       # Drizzle schema (projects, golden_path_configs, sessions, users, credits)
│   ├── replit-auth-web/          # useAuth() React hook for Replit Auth
│   └── integrations-openai-ai-server/  # OpenAI SDK client
├── deployed-projects/            # Generated project files on disk (do not modify)
├── scripts/                      # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json            # Shared TS options (composite: true)
└── tsconfig.json                 # Root TS project references
```

## Database Schema

### `projects` table
- `id` (UUID, PK)
- `user_id` (text, nullable) — Replit Auth user ID
- `prompt` (text)
- `status` (enum: pending/planning/planned/generating/validating/ready/deployed/failed/failed_checks/failed_validation)
- `spec` (JSONB, nullable) — `{ overview, fileStructure, apiEndpoints, databaseTables, middleware, architecturalDecisions }`
- `files` (JSONB) — `[{ path, content }]`
- `golden_path_checks` (JSONB) — `[{ name, passed, description, critical? }]`
- `sandbox_id` (text, nullable)
- `deploy_url` (text, nullable)
- `pipeline_status` (JSONB, nullable) — `{ stages: [{ role, label, status, startedAt?, completedAt?, fileCount?, error? }], currentAgent? }`
- `refinements` (JSONB) — `[{ prompt, timestamp, filesChanged[], goldenPathScore?, previousFiles? }]`
- `payload_hash` (text, nullable) — SHA-256 aggregate hash of entire file tree, locked on verification pass
- `error` (text, nullable)
- `created_at` (timestamp)

### `sessions` table
- `sid` (varchar, PK) — 64-char hex session ID
- `sess` (JSONB) — user info + OIDC tokens
- `expire` (timestamp)

### `users` table
- `id` (text, PK) — Replit user ID from OIDC `sub`
- `email` (text, nullable)
- `first_name` / `last_name` (text, nullable)
- `profile_image_url` (text, nullable)
- `created_at` / `updated_at` (timestamps)

### `golden_path_configs` table
- `id` (UUID, PK)
- `name` (varchar)
- `description` (text, nullable)
- `rules` (JSONB) — full GoldenPathConfigRules object
- `is_active` (boolean, default false)
- `created_at` / `updated_at` (timestamps)

## Key Commands

- **Typecheck:** `pnpm run typecheck` (from root)
- **Build:** `pnpm run build`
- **Push DB schema:** `pnpm --filter @workspace/db run push`
- **Run codegen:** `pnpm --filter @workspace/api-spec run codegen`
- **Production:** `pnpm --filter @workspace/idp-frontend run build && pnpm --filter @workspace/api-server run build` then `node artifacts/api-server/dist/index.cjs`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `GEMINI_API_KEY` — Google Gemini Pro API key (primary AI provider)
- `CSB_API_KEY` / `codesandbox_api` — CodeSandbox API key (optional, for sandbox deployment)
- `REPL_ID`, `REPLIT_DOMAINS` — Set by Replit environment (used for OIDC redirect)
- `PORT` — Frontend dev server port (set by Replit)

## API Notes

- **Auth endpoints** (`/api/login`, `/api/callback`, `/api/logout`, `/api/auth/user`) and `previousFiles` in refinement responses are NOT in the OpenAPI spec. Frontend uses `ExtendedRefineResponse` to extend generated types. If codegen is re-run, these casts must be preserved.
- **CORS:** `origin: true` (allows all origins for dev).
- **API server port:** 8080. Frontend port: dynamic via `$PORT`.
