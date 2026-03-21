# AI-Native Internal Developer Platform (IDP.CORE) — MVP

## Overview
The AI-Native Internal Developer Platform (IDP.CORE) is an MVP designed to revolutionize application development by leveraging AI. It accepts natural language prompts, uses a multi-agent LLM pipeline to generate complete, multi-file applications adhering to "Golden Path" enterprise standards, and deploys them to live CodeSandbox sandboxes. The platform provides a real-time observable UI, secured with Replit Auth multi-tenancy, and styled with "The Glass Engine" design system. The core vision is to streamline development, enforce best practices, and accelerate deployment through intelligent automation.

## User Preferences
Iterative development. Ask before making major architectural changes or deploying to production. Prioritize clarity and conciseness. Show the overall plan before coding. Do not modify files in `deployed-projects/`.

## System Architecture
The IDP is built as a pnpm workspace monorepo with a Strategy Pattern engine architecture. It features an Express 5 API server for orchestration, a React frontend for the observation UI, and uses PostgreSQL with Drizzle ORM for data persistence. It utilizes a dual AI provider strategy, with Gemini Pro as the primary and OpenAI as a fallback.

**Engine Architecture (Polyglot Pivot):**
The system supports multiple generation engines: `engine-react` (React/Express), `engine-fastapi` (Python/FastAPI), and `engine-mobile` (React Native/Expo). Each engine implements a common `EngineInterface` and includes its own generation pipeline, prompts, and specific Golden Path compliance rules. A dispatcher (`engine-router.ts`) selects the appropriate engine based on project configuration.

**Core Architectural Decisions:**
*   **Orchestration API:** An Express 5 server manages the project lifecycle.
*   **Multi-Agent AI Pipeline:** A sequential 6-agent pipeline (Architect, Backend, Frontend, Security Reviewer, Verification & Audit Agent, Fixer Agent) drives application generation, featuring a Self-Healing Loop for error correction and Version Enforcement for dependency management.
*   **App Deconstructor Wizard:** A pre-creation tool using AI to modularize user app ideas, featuring Complexity Energy Bars, Credit Estimation, Ghost Preview, Design Persona System (6 personas: Sovereign default, Cupertino, Terminal, Startup, Editorial, Brutalist), Analogy-Driven Architect, and Magic Wand Suggestions.
*   **AI Provider Layer:** Supports Gemini Pro and OpenAI with robust retry and token continuation logic.
*   **Golden Path Engine:** Enforces automated compliance checks covering structure, security, validation, database, and TypeScript, utilizing config-driven rules and AST-Level Verification.
*   **Dependency Audit:** Validates npm packages for existence, age, popularity, and CVEs using OSV Guard.
*   **Build Verification:** Runs `npm install && npm run build` in a clean environment, feeding errors to the Fixer Agent.
*   **Cryptographic Hash Manifest:** Ensures file integrity for core configuration files.
*   **Authentication & Multi-Tenancy:** Implemented with Replit Auth (OIDC with PKCE) and server-side PostgreSQL sessions.
*   **Credit-Based Billing:** Manages user credits with an append-only ledger.
*   **Iterative Refinement:** Allows delta-only regeneration with natural language chat for conversational interaction.
*   **Automatic Admin Dashboard:** Every generated app includes a built-in Admin Mode for CRUD operations.
*   **Deployment:** Deploys to CodeSandbox cloud VMs for live previews.
*   **GitHub Export & ZIP Export:** Provides options for project export.
*   **Real-Time SSE:** `PipelineEventBus` emits structured events for real-time frontend updates.

**Frontend (Observable UI):**
*   **Sandpack-Powered Workspace:** Uses `@codesandbox/sandpack-react` for an embedded code editor.
*   **Preview Modes:** Sandpack, Live Sandbox, Info, and Expo Snack for mobile projects.
*   **App Anatomy Dashboard ("X-Ray" v2):** A visual metaphor view breaking the project into logical components.
*   **Snapshot Time Travel ("Timeline" tab):** Git-style content-addressable storage for project state history, allowing restoration.
*   **Magic Seed Data Generator ("Seeds" tab):** Schema-aware, deterministic seed engine for data generation.
*   **Error Decryptor (LLM-Powered):** Intercepts Sandpack errors, extracts context, and sends to Gemini for deterministic diagnosis and 1-click fixes with undo capability via snapshots.
*   **Live Pipeline Visualization & Agent Trajectory Dashboard:** Displays agent activity and progress.
*   **Live Terminal:** Displays colorized SSE output.
*   **Build Verification Gate & Git-Style Diff Viewer:** Provides visual feedback and code comparison.

**UI/UX — "The Glass Engine" Design System:**
A design system featuring a "deep space black" canvas with frosted glass panels, Inter and JetBrains Mono typography, a color state machine for various states, a global HUD, and Framer Motion animations.

**Generated App Design System ("Sovereign" Default):**
Generated apps now use a "commercial-grade" visual design by default:
- Dark glass theme (#0F172A background, frosted glass panels with backdrop-blur)
- Inter + JetBrains Mono typography (loaded via Google Fonts)
- Tailwind CSS v4 (via @tailwindcss/vite plugin, @import "tailwindcss" syntax)
- framer-motion for micro-animations (page transitions, list stagger, button tap, modal scale)
- Mandatory layout shell: sidebar + top bar + content area
- Preview-mode seed data: in-memory store with realistic mock data, falls back gracefully when no backend
- 6 design personas available: Sovereign (default), Cupertino, Terminal, Startup, Editorial, Brutalist

## External Dependencies
*   **Monorepo Tool:** pnpm workspaces
*   **Database:** PostgreSQL, Drizzle ORM
*   **API Framework:** Express 5
*   **Authentication:** openid-client (OIDC/PKCE)
*   **GitHub Integration:** `@replit/connectors-sdk`
*   **Validation:** Zod
*   **API Codegen:** Orval
*   **AI Providers:** `@google/generative-ai` (Gemini), OpenAI SDK
*   **AST Tooling:** @babel/core and related packages
*   **Build Tools:** esbuild, tsx
*   **Frontend Libraries:** React 19, Vite 7, Tailwind CSS v4, Shadcn UI, Framer Motion, Lucide React, react-syntax-highlighter, diff (v7)
*   **Vulnerability Database:** OSV

## Type Hardener (Deterministic AST Post-Processing)
Located at `lib/engine-react/src/type-hardener.ts`, the Type Hardener runs ~35 deterministic rewrite passes on generated files after version enforcement in the pipeline:

1. **fixServerTsconfig** — Rewrites `moduleResolution: "NodeNext"` → `"bundler"` and `module: "NodeNext"` → `"ES2022"`.
2. **fixBcryptImports** — Swaps `bcrypt` → `bcryptjs` in imports and package.json.
3. **fixMissingTypeDeclarations** — Auto-injects `@types/` counterparts for common Node packages.
4. **fixDrizzleInsertSchemaImports** — Adds missing `createInsertSchema`/`createSelectSchema` from `drizzle-zod`.
5. **fixExpressV5Params** — Adds `as string` casts to `req.params.*` in Express v5.
6. **fixDrizzleEnumFiltering** — Fixes pgEnum + `eq()` literal type mismatches.
7. **fixDrizzleTableFields** — Replaces `table.fields` with `getTableColumns(table)`.
8. **fixAdminRouteTypes** — Fixes `tables[param]` index type errors.
9. **fixFramerMotionPropSpreads** — Casts prop spreads on `motion.*` components.
10. **fixSchemaBarrelExports** — Ensures barrel files exist for schema directories.
11. **fixDrizzleExecuteDestructuring** — Fixes `db.execute()` destructuring + adds `as any[]` for result arrays.
12. **fixSchemaColumnMismatches** — Corrects hallucinated column/relation names via fuzzy matching.
13. **fixExpressRequestAugmentation** — Creates `express.d.ts` augmenting `Request` with `user?: any`.
14. **fixToFixedOnStrings** — Wraps `.toFixed()` calls in `Number()`.
15. **fixDtsModuleExports** — Converts ambient `declare` to `export` in `.d.ts` files.
16. **fixMissingBarrelExports** — Auto-generates `index.ts` barrel exports.
17. **fixMissingDrizzleColumnImports** — Adds missing drizzle-orm/pg-core column type imports.
18. **fixMissingNamedExports** — Adds `export` keyword to un-exported declarations.
19. **fixMissingTypeStubs** — Generates stub type interfaces for imported PascalCase types.
20. **fixSignatureMap** — Fuzzy-matches misnamed imports via Levenshtein distance + synonyms.
21. **fixDrizzleZodRefinementKeys** — Cross-references refinement keys against real pgTable columns.
22. **fixDrizzleZodBooleanRefinements** — Converts `true` values in createInsertSchema refinements to `(s: any) => s` callbacks (drizzle-zod v0.7 compatibility).
23. **fixValidateRequestSchema** — Fixes `validateRequest(schema)` patterns for Zod compliance.
24. **fixCatchErrorUnknown** — Adds explicit `unknown` type to catch clause variables.
25. **fixDrizzleZodRefinementCallbacks** — Wraps non-callback refinements in `(schema) => schema` format + adds `as any` cast.
26. **fixJwtTypeIssues** — Fixes JWT-related type casting issues.
27. **fixMissingDrizzleOrmImports** — Adds missing operators (eq, and, or, lt, gte, etc.) to `drizzle-orm` imports.
28. **fixDrizzleRelationsImport** — Moves `relations` from `drizzle-orm/pg-core` to `drizzle-orm`.
29. **fixMissingModuleFiles** — Creates stub `.ts` files for missing local module imports.
30. **fixDrizzleDbSchemaGeneric** — Adds `{ schema }` to `drizzle(pool)` calls missing the schema generic.
31. **fixMissingTypeExports** — Adds `export` to locally-declared types; respects star re-exports.
32. **fixTypeOnlyNamespaceImports** — Converts `import type * as X` to `import * as X` when used as a value.
33. **fixDuplicateIdentifiers** — Removes duplicate import names and cross-line declarations.
34. **fixMissingPackageDeps** — Strips banned packages (dompurify), adds missing deps.
35. **fixHardcodedSecrets** — Replaces literal secrets with `process.env.*`.
36. **fixUninitializedUseRefs** — Converts `useRef<T>()` → `useRef<T>(null!)` for React 19 compatibility.
37. **fixViteEnvTypes** — Injects `vite/client` into client `tsconfig.json` types (or creates `vite-env.d.ts`) when `import.meta.env` is detected, preventing TS2339 on `ImportMeta`.

**Key hardener details:**
- `req.user` typed as `user?: any` to prevent TS2739 with custom TokenPayload types.
- dompurify/isomorphic-dompurify are **banned** — stripped from ALL package.json files globally.
- Star re-export awareness prevents TS2395/2440 duplicate export conflicts.
- `fixMissingModuleFiles` creates stub files for non-existent local imports with proper type/value exports.

**Prompt Hardening ("Sovereign Coding Protocol"):**
System prompts in `lib/engine-react/src/agents.ts` now include explicit "Sovereign Coding Protocol" sections for all agents (Architect, Backend, Frontend, Fixer) with build-critical rules that reduce stochastic LLM errors at the source:
- No duplicate identifiers, complete barrel exports, db.select() always returns arrays
- Drizzle `relations` from `drizzle-orm` not `pg-core`, createInsertSchema refinement key matching
- Express Request augmentation requirements, dompurify ban, typed catch clauses
- Frontend-specific: no React import with react-jsx, typed event handlers, react-router-dom v7

**Disk Mirror Utility:**
`lib/engine-react/src/mirror-to-disk.ts` — Reads hardened project files from Postgres and writes them to `active-build/` on disk for filesystem verification.

Wired into `pipeline.ts` after `enforcePackageVersions()`, emits `"type-hardening"` pipeline events.

Test suite at `lib/engine-react/src/type-hardener.test.ts` — 286 tests covering all 37 passes.
- Stub collision guard: prevents duplicate declarations when imported symbols match stub candidates.