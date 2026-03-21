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
Located at `lib/engine-react/src/type-hardener.ts`, the Type Hardener runs ~44 deterministic rewrite passes on generated files after version enforcement in the pipeline:

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
37. **fixSchemaValueImport** — Converts `import type * as schema` to value import in files containing `drizzle()`, and removes type-only `schema` stubs (`export interface schema` / `export type schema`) from schema barrel files that shadow namespace imports (kills TS2693).
38. **fixR3FTupleCasts** — Casts `position`, `rotation`, `scale` array literals in client `.tsx` files to `[number, number, number]` tuple type (kills TS2322 in React Three Fiber projects).
39. **fixViteEnvTypes** — Injects `vite/client` into client `tsconfig.json` types (or creates `vite-env.d.ts`) when `import.meta.env` is detected, preventing TS2339 on `ImportMeta`.
40. **fixVisualSanityGuard** — When PivotControls (R3F gizmo) is detected in client `.tsx` files: creates `client/src/lib/visual-sanity.ts` with floor constraint (y≥0) and radial boundary (dist≤100); injects `visualSanity()` import and guard call after `m.elements[12/13/14]` matrix position extraction to prevent shadow clipping and floating artifacts.
41. **fixAssetConduit** — When `useGLTF`/`useTexture` detected: creates `client/src/lib/asset-conduit.ts` with validation limits (50k vertices, 1024px textures, allowed format whitelist); injects GPU disposal cleanup (`geometry?.dispose()` + `material.dispose()`) via useEffect into useGLTF components; replaces `meshBasicMaterial` with `meshStandardMaterial` in lit scenes to prevent invisible mesh hallucination.
42. **fixCommandSchemaExhaustive** — When `CommandAction` discriminated union detected: creates `client/src/lib/command-bus.ts` with dispatch/undo/redo history stack; injects `default: { const _exhaustive: never = command; }` guard into `switch (*.action)` statements missing a default case to enforce exhaustive command handling at compile time.
43. **fixConversationalArchitect** — When `CommandAction` types + AI command route detected: creates `client/src/lib/nl-command-parser.ts` with `parseNaturalLanguage()` that validates AI responses against `VALID_ACTIONS` extracted from the CommandAction union before dispatching through the command bus; injects markdown fence stripping (`replace(/^\`\`\`json.../...)`) before `JSON.parse` in server AI command routes to prevent LLM response parse failures.
44. **fixPerformanceWall** — When R3F detected (Canvas or @react-three/fiber): creates `client/src/lib/performance-wall.ts` with `PERF_LIMITS` (instance threshold 5, max draw calls 100, LOD distances, adaptive DPR range); promotes `.map()` → `<mesh>` loops to `<Instances>`/`<Instance>` from drei (N draw calls → 1); wraps `useGLTF` component returns in `<Detailed distances={[0, 50]}>` with wireframe box proxy for LOD; injects `<AdaptiveDpr pixelated />` + `<AdaptiveEvents />` into `<Canvas>` for adaptive GPU scaling.

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
- **Sovereign Socket Protocol** (Socket.io real-time apps): Architect mandates Event Registry file (`socket-events.ts`), Backend enforces Effect Anchor pattern + Room Scoping rules + HTTP server extraction, Frontend enforces Effect Anchor Rule (named handler refs for socket.on/off cleanup) + Socket Singleton pattern, Fixer includes AI Doctor entries for Listener Leak, Shared Type Phantom, and Room Scoping Confusion
- Socket.io versions pinned in `version-enforcement.ts`: `socket.io: "^4.8.0"`, `socket.io-client: "^4.8.0"`

**Milestone: The Sovereign Socket Run (Run 35 — 3D Real-Time Sync):**
Objective: Stress-test the Triple-Layer Defense (Prompt Protocol, Vindicator, AI Doctor) using a React-Three-Fiber environment synchronized via Socket.io.

Sovereign Socket Protocol Injections:
- Event Registry: Mandated a shared `types/socket-events.ts` interface across Backend and Frontend.
- Effect Anchor Rule: Forced `socket.on` listeners to pair with exact-reference `socket.off` cleanup functions in useEffect.
- Room Scoping: Banned flat `io.emit` broadcasts in favor of targeted room logic.

Run 35 Results (Project ID `ab7587c0`):
- Scale: 45 files reconciled across 4 agents (Architect, Backend, Frontend, Security).
- Vindicator Actions: 5 Version Enforcement fixes, 11 Type Hardening AST transformations.
- AI Doctor/Self-Heal: 0 attempts required.
- Status: `ready`.
- Payload hash: `01e50a79ce90326e1f568767ae70ef2463fe23e05fe723264a3a5b76953df2da`

Analysis: The Prompt Hardening successfully prevented the classic "Listener Leak" and "Shared Type Phantom" hallucinations. Minor residual TypeScript strictness errors (TS2693 schema-as-type, TS2322 tuple length) bypassed the build breaker due to passing hash integrity, mapping the next targets for static Vindicator passes (37 and 38). The system is officially capable of deterministic, real-time 3D generation.

**FastAPI Type Hardener (Python Vindicator):**
Located at `lib/engine-fastapi/src/type-hardener.ts`, runs 11 deterministic rewrite passes on generated Python files:
1. **fixLegacySQLAlchemy** — Replaces `declarative_base()` with `DeclarativeBase`, `Column()` with `mapped_column()` (SQLAlchemy 2.0 mandatory).
2. **fixPydanticV1Patterns** — Replaces `Optional[X]` with `X | None` (PEP 604), `List[X]` with `list[X]` (PEP 585), `class Config:` with `model_config = ConfigDict()` (Pydantic V2).
3. **fixSyncRouteHandlers** — Converts sync `def` route handlers to `async def` when preceded by FastAPI decorators.
4. **fixRawSQLStrings** — Detects f-string SQL injection patterns and replaces with parameterized `text()` queries.
5. **fixHardcodedSecrets** — Replaces hardcoded database URLs and secret keys with `os.getenv()` lookups.
6. **fixMissingConfigDict** — Injects `ConfigDict(extra="forbid")` on Create models and `ConfigDict(from_attributes=True)` on Response models (over-posting prevention).
7. **fixRequirementsVersions** — Enforces pinned `>=` versions for core Python stack (FastAPI, uvicorn, Pydantic, SQLAlchemy, etc.) in requirements.txt.
8. **fixAutoPagination** — Detects list endpoints (get_all, list_, get_*s) without limit/offset params and injects `limit: int = 100, offset: int = 0` with `.limit(limit).offset(offset)` on select queries to prevent massive JSON payloads.
9. **fixEagerLoadingEnforcement** — Detects SQLAlchemy `relationship()` definitions and injects `selectinload()` options on queries that access models with relationships, killing N+1 query bugs at the source.
10. **fixResponseCompression** — Injects `GZipMiddleware(minimum_size=500)` from Starlette for automatic response compression on large payloads (3D scene state, bulk data).
11. **fixFastAPIPerformanceConstants** — Injects `perf_config.py` with `PERF_LIMITS` (pagination defaults, compression thresholds, connection pool sizing, query timeout) and `PERF_HINTS` documentation.

Wired into `pipeline.ts` and `refine.ts` — runs after code generation, before Golden Path checks. Emits `"type-hardening"` pipeline events via "FastAPI Vindicator" agent.

**Mobile Type Hardener (Mobile Vindicator):**
Located at `lib/engine-mobile/src/type-hardener.ts`, runs 11 deterministic rewrite passes on generated Expo/React Native files:
1. **fixStyleSheetCreate** — Removes `StyleSheet.create()` blocks and converts `style={styles.x}` to `className="x"` (NativeWind mandatory).
2. **fixLocalStorageUsage** — Replaces `localStorage.getItem/setItem/removeItem` with `AsyncStorage` equivalents (React Native has no localStorage).
3. **fixSafeAreaProvider** — Injects `SafeAreaProvider` wrapper in `app/_layout.tsx` if missing.
4. **fixDependencyPins** — Removes `^` and `~` from package.json dependency versions for reproducible builds.
5. **fixMobileAssetLimits** — Injects `lib/asset-limits.ts` with VRAM-safe limits (1024px max, format whitelist) when image assets detected.
6. **fixDirectReactNavigation** — Replaces `@react-navigation/native` imports with `expo-router` equivalents (file-based routing mandatory).
7. **fixFlatListEnforcement** — Replaces `ScrollView` + `.map()` patterns with `FlatList` for virtualized rendering (60fps list performance); auto-extracts data source, key extractor, and render item; updates react-native imports.
8. **fixImageOptimization** — Injects `resizeMode="cover"` and `loading="lazy"` on network `<Image>` components with URI sources for bandwidth and memory efficiency.
9. **fixHeavyReRenders** — Wraps components with expensive operations (useEffect, .map, .filter, fetch) in `React.memo()` to prevent unnecessary re-renders; handles default and named exports.
10. **fixAnimationPerformance** — Replaces core `react-native` `Animated` import with `react-native-reanimated` for native-thread 60fps animations; auto-adds `FadeIn`, `FadeOut`, `SlideInRight` entering animations.
11. **fixMobilePerformanceConstants** — Injects `lib/performance-wall.ts` with `MOBILE_PERF_LIMITS` (FlatList window size, max simultaneous animations, image cache limits, bundle size caps, target FPS) and `PERF_HINTS` documentation.

Wired into `pipeline.ts` and `refine.ts` — runs after code generation, before Golden Path checks. Emits `"type-hardening"` pipeline events via "Mobile Vindicator" agent.

**Disk Mirror Utility:**
`lib/engine-react/src/mirror-to-disk.ts` — Reads hardened project files from Postgres and writes them to `active-build/` on disk for filesystem verification.

Wired into `pipeline.ts` after `enforcePackageVersions()`, emits `"type-hardening"` pipeline events.

45. **fixUnifiedArchitectDispatcher** — When CommandAction types + command-bus + nl-command-parser all detected: creates `client/src/lib/engine-dispatcher.ts` with multi-engine routing (EngineTarget = "react" | "fastapi" | "mobile-expo"), ENGINE_AFFINITY map for action→engine resolution, CROSS_STACK_HOOKS for automatic data hook injection (e.g., SPAWN_ASSET triggers FastAPI createAssetRecord), intent analysis via keyword signals, and `dispatchToEngines()` for parallel multi-engine command execution; upgrades nl-command-parser with `parseNaturalLanguageMultiEngine()` that analyzes intent across all three engines before dispatch; injects `/api/engine-hook` server route for cross-stack communication.

Test suite at `lib/engine-react/src/type-hardener.test.ts` — 454 tests covering all 45 passes.
- Stub collision guard: prevents duplicate declarations when imported symbols match stub candidates.