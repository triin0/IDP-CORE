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
*   **App Deconstructor Wizard:** A pre-creation tool using AI to modularize user app ideas, featuring Complexity Energy Bars, Credit Estimation, Ghost Preview, Design Persona System, and Analogy-Driven Architect.
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

**Tier 5 — SHA-256 Cryptographic Root of Trust:**
- Frontend (`canonicalize()`, `sha256()`, `verifiedFetch()` with `X-Payload-Hash`).
- Backend (`IntegrityMiddleware` for `400 Integrity Fault` on hash mismatch).
- Audit trail via `payload_hash` column.

**Tier 5 — Shadow Branch Eradication (State Versioning):**
- `State Arbiter` for monotonic version counters and conflict detection (`409 Conflict`).
- Authoritative Manifest for client reconciliation.
- Frontend tracks state versions and handles conflicts.

**Tier 5 — Identity Forgery Elimination (JWT WebSocket Auth):**
- HS256 JWT generation and verification for secure WebSocket connections.
- Strict user ID matching and various forgery detection mechanisms.

**Type Hardening (Vindicator Engines):**
A critical component that runs deterministic rewrite passes on generated code (TypeScript/Python/React Native) to fix common LLM hallucinations and enforce best practices. This includes:
- **React/TypeScript Hardener:** 46 passes to fix module resolution, import issues, Drizzle ORM specific types, Express V5 parameters, React hooks, Framer Motion props, and more.
- **FastAPI/Python Hardener:** 12 passes for SQLAlchemy 2.0 migration, Pydantic V2 patterns, async route handlers, SQL injection prevention, environment variable usage, requirements pinning, pagination, eager loading, and response compression.
- **Mobile/React Native Hardener:** 12 passes for StyleSheet.create to NativeWind, localStorage to AsyncStorage, SafeAreaProvider injection, dependency pinning, asset limits, Expo Router integration, FlatList enforcement, image optimization, React.memo usage, and Reanimated for animations.
- **Runtime Error Classifier & Targeted Repair Engine:** Parses 10 error patterns into 9 categories and applies corrective code transforms within an iterative feedback loop.

**Prompt Hardening ("Sovereign Coding Protocol"):**
System prompts include explicit "Sovereign Coding Protocol" sections for all agents (Architect, Backend, Frontend, Fixer) with build-critical rules to reduce stochastic LLM errors, covering issues like duplicate identifiers, barrel exports, Drizzle usage, Express Request augmentation, and specific rules for Socket.io applications (Sovereign Socket Protocol).

**Engine B: The Native Foundry (Pydantic→UE5 Transpiler):**
A transpilation pipeline generating type-safe C++/UE5 code from Pydantic schemas with SHA-256 parity.
- **Sovereign C++ Serializer:** Self-contained header with SHA-256, canonical JSON serializer, and offline queue.
- **USTRUCT Transpiler:** Parses Pydantic definitions and maps Python types to UE5 types, generating `USTRUCT(BlueprintType)` headers with `UPROPERTY` macros.
- **Sovereign Transport & Auth Bridge:** Native C++ communication layer enforcing Tier 5 Root of Trust with `USovereignHttpClient` for request interception and `UAuthService` for secure token management.
- **Chronos Engine ("The Memory"):** Intelligent persistence bridge with crash recovery, 409 conflict handling, state machine, and connectivity awareness.
- **Biological Forge ("The Asset Assembler"):** Deterministic genetic-to-visual mapper that reads SHA-256 hashes and manifests UE5 visual assets based on a "Genome Parser" for material properties and morphology.
- **Sovereign Showroom ("The Cinematic Layer"):** Dynamic cinematic environment where visual mood is derived from the 256-bit genome, including adaptive camera rigs and lighting profiles.
- **Sovereign Arena ("The Deterministic Interaction Layer"):** Deterministic combat simulation where material properties become combat stats, featuring deterministic RNG, round-level hashing, replay instruction system, hitbox-genome collision mapping, and a scar system for combat chronicles.
- **Sovereign Spawner ("The Evolutionary Engine"):** Deterministic hereditary logic for genetic recombination, mutation, and lineage tracking.
- **Sovereign Ownership & The Economic Layer:** Complete ownership, atomic swap, marketplace, and royalty system with Chronos persistence and a Marketplace API.
- **Genesis Event:** Tool for minting a founding population of 100 deterministic Sovereign entities with rarity distribution and collision detection.
- **World Weaver — Sovereign Habitats:** Introduces deterministic environment generation using genome architecture, biome classification, and a synergy coefficient for entity performance.
- **Sovereign Intel — DNA-Driven Behavioral AI:** Behavioral weights derived directly from the 32-byte creature genome for archetypes and actions, with integration of synergy and thermal effects.
- **Sovereign Bridge — Universal Export & Visual Manifest:** Converts internal genome data into explicit rendering instructions via a "Digital Passport" (FSovereignPassport) containing visual, behavioral, and environmental information.
- **High-Fidelity Forge — SDF Mesh Synthesizer & Sovereign Shader Library:** Transforms VMO instructions into real-time 3D synthesis using SDF blending, procedural meshes, HLSL shader parameters, and VFX descriptors.
- **The Sovereign Synapse — Logic & Intent Pipeline:** Intercepts, sanitizes, and validates natural language "Intent Strings" into Sovereign Action Structs, enforcing a 10-pass "Reality Check" (Pass 50) and a behavioral mirror for prediction reconciliation.
- **The Sovereign Nexus — Multi-Entity Orchestration & Sync:** High-concurrency fleet orchestrator with entity registry, "Quantum Lock" (Pass 51) for LWW conflict resolution, delta compression, "Ghost Reconciliation" (Pass 52) for smooth sync, and SHA-256 integrity.

**Lexus RX300 Showroom (artifacts/showroom-web):**
- GLB model pipeline: CC0 car models at `public/models/` with content-type validation (HEAD probe rejects Vite SPA HTML fallback).
- PBR materials: metalness 0.9, roughness 0.1, clearcoat 1.0 (paint); transmission 0.9 (glass); chrome envMapIntensity 2.5.
- WASD/Arrow key input via Synapse action dispatch: `MOVE_ACTION(forward|backward)`, `TURN_ACTION(left|right)`.
- Behavioral Mirror HUD: real-time X/Z/ROT/SPD telemetry, throttled at 20Hz to avoid React state thrashing.
- Pre-allocated vectors in useFrame (zero per-frame GC). Focus-loss handler clears latched keys.
- No emoji fallback. WebGL error boundary is text-only. Canvas mounts unconditionally (failIfMajorPerformanceCaveat: false).
- HDR city env map, ACES Filmic tone mapping, ContactShadows, MeshReflectorMaterial floor.

## UIR Core (Nexus Bridge — Phase 1)
The Unified Intermediate Representation (UIR) is the shared schema that connects Engine A and Engine B. Located at `lib/uir-core/`.

**What it does:**
- Defines a platform-agnostic JSON schema for entities, relationships, spatial constraints, genome mappings, materials, endpoints, and business rules
- Validates UIR documents for structural correctness (Zod) and semantic correctness (cross-references, genome bounds, spatial consistency)
- SHA-256 integrity hashing via deterministic canonicalization (sorted keys, stable JSON)
- Sign/verify workflow for tamper detection
- Emitter interface: the contract that Engine A (web-emitter) and Engine B (native-emitter) adapters implement
- Orchestrator: parallel dispatch to multiple emitters from a single UIR document

**Key files:**
- `lib/uir-core/src/schema.ts` — Zod schemas for all UIR types (UIRDocument, UIREntity, UIRField, UIRGenome, UIRSpatialConstraint, etc.)
- `lib/uir-core/src/validator.ts` — Semantic validation (duplicate detection, reference resolution, genome bounds, spatial consistency, target coherence)
- `lib/uir-core/src/integrity.ts` — Deterministic canonicalization, SHA-256 hashing, sign/verify
- `lib/uir-core/src/emitter.ts` — Emitter interface and orchestrator (parallel dispatch)
- `lib/uir-core/src/emitters/web-emitter.ts` — WebEmitter: UIR → TypeScript interfaces, Zod schemas, Drizzle table defs, Express routes, server.ts
- `lib/uir-core/src/emitters/native-emitter.ts` — NativeEmitter: UIR → C++ USTRUCT headers, UPROPERTY macros, constraint validators, ToSovereignJson serializers, genome derivers
- `lib/uir-core/tests/uir.test.ts` — 85 tests covering schema, validation, integrity, orchestration, web-emitter, native-emitter, and cross-emitter bridge proofs

**Entity kinds:** data, spatial, actor, component, system
**Emit targets:** web, native, asset, mobile, api
**Spatial constraints:** gravity, collision, clearance, support, containment, alignment, attachment, reachability
**Genome transforms:** linear, exponential, step, modulo, lookup

**Test command:** `pnpm --filter @workspace/uir-core run test`

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