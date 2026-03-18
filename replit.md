# AI-Native Internal Developer Platform (IDP.CORE) — MVP

## Overview
The AI-Native Internal Developer Platform (IDP.CORE) is an MVP designed to revolutionize application development by leveraging AI. It accepts natural language prompts, uses a multi-agent LLM pipeline to generate complete, multi-file applications adhering to "Golden Path" enterprise standards, and deploys them to live CodeSandbox sandboxes. The platform provides a real-time observable UI, secured with Replit Auth multi-tenancy, and styled with "The Glass Engine" design system. The core vision is to streamline development, enforce best practices, and accelerate deployment through intelligent automation.

## User Preferences
Iterative development. Ask before making major architectural changes or deploying to production. Prioritize clarity and conciseness. Show the overall plan before coding. Do not modify files in `deployed-projects/`.

## System Architecture
The IDP is built as a pnpm workspace monorepo with a **Strategy Pattern engine architecture**. It features an Express 5 API server for orchestration, a React frontend for the observation UI, and uses PostgreSQL with Drizzle ORM for data persistence. It utilizes a dual AI provider strategy, with Gemini Pro as the primary and OpenAI as a fallback.

**Engine Architecture (Phase 2A — Polyglot Pivot):**
*   **`lib/engine-common/`** (`@workspace/engine-common`): Shared engine utilities — `ai-retry.ts` (LLM call infrastructure with retry + continuation), `snapshots.ts` (CAS snapshot engine), `pipeline-events.ts` (SSE event bus), `types.ts` (EngineInterface contract).
*   **`lib/engine-react/`** (`@workspace/engine-react`): React/Express generation engine — extracted from api-server. Contains `pipeline.ts`, `agents.ts`, `golden-path.ts`, `spec-generator.ts`, `refine.ts`, `seed-generator.ts`, `deploy.ts`, `sandbox.ts`, `design-personas.ts`, `source-annotator.ts`, and all verification modules (AST, build, dependency audit, hash integrity, version enforcement).
*   **`artifacts/api-server/src/lib/`**: Now contains thin re-export shims that delegate to `@workspace/engine-common` and `@workspace/engine-react`. Engine-agnostic code (`auth.ts`, `credits.ts`, `github.ts`) remains in api-server. This preserves all existing dynamic `await import()` paths in routes.
*   **`artifacts/api-server/src/lib/engine-router.ts`**: Engine dispatcher — `getEngine()` returns the correct engine implementation based on a project's `engine` column. Supports `react` and `fastapi` engines.

**Phase 2B — Dispatcher (COMPLETE):**
*   **DB:** `engine TEXT NOT NULL DEFAULT 'react'` column added to `projectsTable`.
*   **API:** `CreateProjectBody` accepts optional `engine` field (`"react"` | `"fastapi"`, default `"react"`). All routes (`POST /projects`, `POST /projects/:id/approve-spec`, `POST /projects/:id/regenerate-spec`, `POST /projects/:id/refine`) dispatch through `getEngine()`.
*   **Frontend:** Engine selector toggle in `PromptForm.tsx` (React selected by default, FastAPI fully enabled). `DeconstructorWizard` (design persona) conditionally hidden when engine !== react.
*   **Response:** `engine` field included in both project list and detail GET responses.

**Phase 2C — FastAPI Engine (COMPLETE):**
*   **`lib/engine-fastapi/`** (`@workspace/engine-fastapi`): Full Python/FastAPI generation engine implementing `EngineInterface`. Contains `pipeline.ts` (generateSpec + runPipeline with Gemini), `prompts.ts` (audited Python Architect system prompt with 3 surgical refinements), `golden-path.ts` (11 Python-specific compliance rules), `refine.ts` (delta refinement), and `index.ts` barrel.
*   **Golden Path Rules (11):** pydantic-v2-models, schema-triad, sqlalchemy-2-mapped, async-routes, response-model-declared, health-endpoint, env-database-url, cors-middleware, type-hints, extra-forbid, requirements-pinned.
*   **Frontend:** FastAPI projects use a plain Python code editor (bypasses Sandpack), file browser sidebar, and Swagger preview mode (`buildSwaggerPreview()` HTML renderer). `AppAnatomy.tsx` classifies Python files (main.py → serverRoutes, models → schemas, requirements.txt → configs). `useXRayInspector` hook made safe outside SandpackProvider context.
*   **Engine Router:** `engine-router.ts` wired to real `@workspace/engine-fastapi` functions (no stubs).

**Phase 3A — Mobile Engine (COMPLETE):**
*   **`lib/engine-mobile/`** (`@workspace/engine-mobile`): React Native/Expo generation engine implementing `EngineInterface`. Contains `pipeline.ts` (generateSpec + runPipeline with Gemini), `prompts.ts` (Mobile Architect system prompt with Expo Router, NativeWind, dark-first design system), `golden-path.ts` (11 mobile-specific compliance rules), `refine.ts` (delta refinement preserving mobile constraints), and `index.ts` barrel.
*   **Golden Path Rules (11):** expo-router, nativewind-styling, typed-navigation, safe-area-provider, lucide-icons, async-storage-state, typescript-strict, platform-adaptive, haptic-feedback, app-json-config, package-json-pinned.
*   **Mobile Constraints:** Expo SDK 52+, Expo Router (file-based `app/` dir), NativeWind (className, never StyleSheet.create), lucide-react-native icons, expo-haptics, AsyncStorage, SafeAreaProvider, react-native-reanimated, dark-first design (zinc-950 backgrounds, cyan-400 accents).
*   **Frontend:** Mobile engine option in PromptForm ("Mobile — Expo + NativeWind"). `AppAnatomy.tsx` classifies RN files (app/*.tsx → pages, components/ → components, hooks/lib → serverLogic, types/constants → schemas, app.json/babel.config.js → configs). Mobile projects default to Expo Snack "Device" preview.
*   **Engine Router:** `engine-router.ts` wired to real `@workspace/engine-mobile` functions.
*   **Type System:** `engine` field added to `ProjectDetails`, `ProjectSummary`, `CreateProjectBody` types across all layers (DB, Zod, api-client-react, frontend). Removed all `as unknown as` casts for engine field. `RefineResult` interface made compatible (optional `previousFiles` and `goldenPathScore`).

**Phase 3B — Expo Snack Bridge (COMPLETE):**
*   **`ExpoSnackEmbed.tsx`**: Full Expo Snack integration component. Transforms project files into Snack format, saves via Expo's public API (`exp.host/--/api/v2/snack/save`), and renders a live virtual device iframe.
*   **File Transformation:** Strips config files (package.json, tsconfig), generates `App.js` entry point for Expo Router projects, extracts dependencies from package.json with fallback defaults.
*   **Platform Toggle:** iOS / Android / Web buttons with color-coded active states (blue/emerald/violet). Each platform switches the Snack iframe to render the corresponding device.
*   **UX:** Loading state with "Uploading to Expo Snack" spinner, error state with retry button, "Open in Expo Snack" external link, maximize/minimize, and rebuild button.
*   **Auto-sync:** Detects file changes via hash comparison and automatically re-creates the Snack when files are updated (refinement, seed injection, etc.).
*   **Workspace Integration:** "Device" tab appears in preview pane for mobile-expo projects (replaces Sandpack/Swagger tabs). Mobile projects bypass SandpackProvider wrapping. PreviewMode type extended with "snack".

**Core Architectural Decisions:**
*   **Orchestration API:** An Express 5 server manages the project lifecycle, including `pending` through `deployed` (or `failed`) states.
*   **Multi-Agent AI Pipeline:** A sequential 6-agent pipeline (Architect, Backend, Frontend, Security Reviewer, Verification & Audit Agent, Fixer Agent) drives application generation. A **Self-Healing Loop** triggers the Fixer Agent with error evidence on failure, retrying up to 3 times. **Version Enforcement** post-processes `package.json` versions and performs package substitution. A **Source-Code Post-Processor** rewrites import statements and API usage in `.ts` files when packages are substituted.
*   **App Deconstructor Wizard:** A pre-creation tool that breaks a user's app idea into a modular feature blueprint using AI. It includes **Complexity Energy Bars**, **Credit Estimation**, **Ghost Preview** (single-file React mockup), **Design Persona System** (users pick visual styles that influence generation), **Analogy-Driven Architect** (AI parses metaphors into technical concepts), and **Magic Wand Suggestions** (AI-suggested bonus features).
*   **AI Provider Layer:** Supports Gemini Pro and OpenAI with retry logic and token continuation for large responses.
*   **Golden Path Engine:** Enforces eleven automated compliance checks covering structure, security, validation, database, and TypeScript, utilizing config-driven rules and AST-Level Verification.
*   **Dependency Audit:** Validates npm packages for existence, age, popularity, and CVEs using OSV Guard.
*   **Build Verification:** Runs `npm install && npm run build` in a clean environment, captures output, and feeds cleaned build errors to the Fixer Agent on failure.
*   **Cryptographic Hash Manifest:** Ensures file integrity by computing and comparing SHA-256 hashes of core config files against the Architect's specification.
*   **Authentication & Multi-Tenancy:** Implemented with Replit Auth (OIDC with PKCE) and server-side PostgreSQL sessions.
*   **Credit-Based Billing:** Manages user credits with an append-only ledger.
*   **Iterative Refinement:** Allows delta-only regeneration using existing files as context, with a **Natural Language Refinement Chat** for conversational interaction.
*   **Automatic Admin Dashboard:** Every generated app includes a built-in Admin Mode for full CRUD operations on database tables.
*   **Deployment:** Deploys to CodeSandbox cloud VMs for live previews.
*   **GitHub Export:** Exports projects to GitHub, including a CI workflow.
*   **ZIP Export:** Provides a ZIP archive of all project files.
*   **Real-Time SSE:** `PipelineEventBus` emits structured events for real-time updates to the frontend.

**Frontend (Observable UI):**
*   **Sandpack-Powered Workspace:** Uses `@codesandbox/sandpack-react` for an embedded code editor with a split-pane layout.
*   **Preview Modes:** Three modes: Sandpack, Live Sandbox, and Info (static HTML overview).
*   **App Anatomy Dashboard ("X-Ray" v2):** A visual metaphor view breaking the project into organs (UI, API, Database, Security, Architecture).
*   **Snapshot Time Travel ("Timeline" tab):** Git-style content-addressable storage (CAS) for project state history. Uses SHA-256 hashed file blobs with composite PK `(projectId, hash)` and `ON CONFLICT DO NOTHING` for deduplication. Snapshots are automatically created before code generation, refinement, seed injection, seed wipe, and restore operations. Manual snapshots are also supported. Restoration reconstructs files from blob storage and forces a clean SandpackProvider remount via React key change. Both `file_blobs` and `snapshots` tables CASCADE on project deletion (zero-pollution guarantee). Schema: `lib/db/src/schema/snapshots.ts`, Engine: `artifacts/api-server/src/lib/snapshots.ts`, Timeline UI: `artifacts/idp-frontend/src/components/SnapshotTimeline.tsx`.
*   **Magic Seed Data Generator ("Seeds" tab):** Schema-aware, deterministic seed engine with column type parsing (ColumnDef), Kahn's topological sort for FK-safe ordering, temperature 0.0 determinism with project fingerprint, two-tiered auto-injection (`client/src/data/seed-data.ts` typed arrays for Sandpack, `server/src/db/seed.ts` SQL INSERTs for deployment), and wipe mechanism that overwrites with empty arrays (preserving module imports).
*   **Error Decryptor (LLM-Powered):** Intercepts Sandpack bundler/runtime errors via `useSandpackErrorWatcher` hook (SHA dedup, 1500ms debounce, AbortController single-flight, dismissedHashes race condition guard). A 3-tier context extractor (`error-context-extractor.ts`) sends only the crash file + immediate imports + TS type files (max 8 files, 30k chars) to the backend. `POST /projects/:id/decrypt-error` calls Gemini at temperature 0.00 for deterministic diagnosis returning explanation + root cause + file-level fixes. `POST /projects/:id/apply-decrypt-fix` creates a `pre_decrypt` snapshot (Task #13 CAS engine) before applying the LLM patch, making every auto-fix undoable via the Timeline. The `ErrorDecryptorOverlay` component renders a bottom-anchored panel with human-readable explanation and 1-click "Fix Issue" button. Also includes the original regex-based `error-decryptor.ts` for pipeline build error translation.
*   **Live Pipeline Visualization:** Displays agent activity with animations.
*   **Agent Trajectory Dashboard:** Vertical sidebar showing per-agent stage cards and verification gates.
*   **Live Terminal:** Displays colorized SSE output.
*   **Build Verification Gate:** A visual checklist for various checks.
*   **Git-Style Diff Viewer:** Provides unified diffs for code changes.

**UI/UX — "The Glass Engine" Design System:**
*   **Design:** "Deep space black" canvas with frosted glass panels.
*   **Typography:** Inter for UI, JetBrains Mono for code/logs.
*   **Color State Machine:** Defines brand, success, warning, and destructive states.
*   **Global HUD:** Cockpit-style frosted header with telemetry badges.
*   **Animations:** Uses Framer Motion for enhanced interactivity.

## External Dependencies
*   **Monorepo Tool:** pnpm workspaces
*   **Database:** PostgreSQL, Drizzle ORM (`drizzle-orm`, `drizzle-zod`, `drizzle-kit`)
*   **API Framework:** Express 5, helmet, cors, express-rate-limit, cookie-parser, archiver
*   **Authentication:** openid-client (OIDC/PKCE)
*   **GitHub Integration:** `@replit/connectors-sdk`
*   **Validation:** Zod (`zod/v4`)
*   **API Codegen:** Orval
*   **AI Providers:** `@google/generative-ai` (Gemini), OpenAI SDK
*   **AST Tooling:** @babel/core, @babel/parser, @babel/traverse, @babel/generator, @babel/types, @babel/plugin-syntax-typescript, @babel/plugin-syntax-jsx
*   **Build Tools:** esbuild, tsx
*   **Frontend Libraries:** React 19, Vite 7, Tailwind CSS v4, Shadcn UI, Framer Motion, Lucide React, react-syntax-highlighter, diff (v7)
*   **Vulnerability Database:** OSV