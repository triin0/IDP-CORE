# AI-Native Internal Developer Platform (IDP.CORE) — MVP

## Overview
The AI-Native Internal Developer Platform (IDP.CORE) is an MVP designed to revolutionize application development by leveraging AI. It accepts natural language prompts, uses a multi-agent LLM pipeline to generate complete, multi-file applications adhering to "Golden Path" enterprise standards, and deploys them to live CodeSandbox sandboxes. The platform provides a real-time observable UI, secured with Replit Auth multi-tenancy, and styled with "The Glass Engine" design system. The core vision is to streamline development, enforce best practices, and accelerate deployment through intelligent automation.

## User Preferences
Iterative development. Ask before making major architectural changes or deploying to production. Prioritize clarity and conciseness. Show the overall plan before coding. Do not modify files in `deployed-projects/`.

## System Architecture
The IDP is built as a pnpm workspace monorepo. It features an Express 5 API server for orchestration, a React frontend for the observation UI, and uses PostgreSQL with Drizzle ORM for data persistence. It utilizes a dual AI provider strategy, with Gemini Pro as the primary and OpenAI as a fallback.

**Core Architectural Decisions:**
*   **Orchestration API:** An Express 5 server manages the project lifecycle, including `pending` through `deployed` (or `failed`) states. It is secured with helmet, CORS, rate limiting, and `trust proxy`.
*   **Multi-Agent AI Pipeline:** A sequential 6-agent pipeline (Architect, Backend, Frontend, Security Reviewer, Verification & Audit Agent, Fixer Agent) drives application generation. The Verification Agent performs Golden Path checks, dependency audits, and build verification. A **Self-Healing Loop** triggers the Fixer Agent with error evidence on failure, retrying up to 3 times.
*   **AI Provider Layer:** Supports Gemini Pro and OpenAI with built-in retry logic and **token continuation loops** for large responses.
*   **Golden Path Engine:** Enforces eleven automated compliance checks covering structure, security, validation, database, and TypeScript. Critical checks block deployment readiness. Utilizes config-driven rules and AST-Level Verification (ts-morph) for programmatic security middleware validation.
*   **Dependency Audit:** Validates npm packages for existence, age, popularity, and CVEs using OSV Guard.
*   **Build Verification:** Runs `npm install && npm run build` in a clean environment (stripped of Replit nix config), captures both stdout and stderr from `tsc` (TypeScript sends errors to stdout), extracts real TS errors using pattern matching, and feeds cleaned build output to the Fixer Agent on failure.
*   **Cryptographic Hash Manifest:** Ensures file integrity and prevents silent modifications by computing and comparing SHA-256 hashes of all generated files against the Architect's specification.
*   **Authentication & Multi-Tenancy:** Implemented with Replit Auth (OIDC with PKCE) and server-side PostgreSQL sessions. `requireAuth` middleware and `loadOwnedProject()` enforce security and ownership.
*   **Credit-Based Billing:** Manages user credits with an append-only ledger, supporting Reserve→Settle/Refund transactions.
*   **Iterative Refinement:** Allows delta-only regeneration using existing files as context, tracking history and performing full verification after refinement.
*   **Deployment:** Deploys to CodeSandbox cloud VMs for live previews, with a fallback to static HTML. Includes auto-cleanup for sandboxes and manual deletion options.
*   **GitHub Export:** Exports projects to GitHub, including a CI workflow (`.github/workflows/verify.yml`) for re-running security checks. Uses Replit Connectors SDK for GitHub OAuth.
*   **ZIP Export:** Provides a ZIP archive of all project files, including verification and hash manifests.
*   **Real-Time SSE:** `PipelineEventBus` emits structured events for real-time updates on pipeline status, verification, self-healing, and build output to the frontend.

**Frontend (Observable UI):**
*   **Live Pipeline Visualization:** A horizontal bar displays agent activity with neon glow and pulse animations.
*   **Agent Trajectory Dashboard:** A vertical sidebar shows per-agent stage cards, self-healing indicators, and verification gates.
*   **Live Terminal:** Displays colorized SSE output with auto-scroll and line numbers.
*   **Build Verification Gate:** A visual checklist for Golden Path, Dependencies, Build, Hash Integrity, and Security.
*   **Git-Style Diff Viewer:** Provides unified diffs for code changes with line numbers and highlighting.

**UI/UX — "The Glass Engine" Design System:**
*   **Design:** Utilizes a "deep space black" canvas with frosted glass panels (`rgba(255,255,255,0.03)` + `backdrop-filter: blur(12px)`).
*   **Typography:** Inter for UI, JetBrains Mono for code/logs.
*   **Color State Machine:** Defines brand/action (Cyan), success (Emerald), warning (Amber), and destructive (Crimson) states.
*   **Global HUD:** A cockpit-style frosted header with telemetry badges (SYS/LLM/SANDBOX), Compute Wallet, and user authentication.
*   **Animations:** Employs `cursor-blink`, `pulse-glow`, `hud-pulse`, `glass-shimmer`, `slide-up`, and `fade-in` for enhanced interactivity using Framer Motion.

## External Dependencies
*   **Monorepo Tool:** pnpm workspaces
*   **Database:** PostgreSQL, Drizzle ORM (`drizzle-orm`, `drizzle-zod`, `drizzle-kit`)
*   **API Framework:** Express 5, helmet, cors, express-rate-limit, cookie-parser, archiver
*   **Authentication:** openid-client (OIDC/PKCE)
*   **GitHub Integration:** `@replit/connectors-sdk`
*   **Validation:** Zod (`zod/v4`)
*   **API Codegen:** Orval
*   **AI Providers:** `@google/generative-ai` (Gemini), OpenAI SDK (via Replit AI Integrations)
*   **Build Tools:** esbuild, tsx
*   **Frontend Libraries:** React 19, Vite 7, Tailwind CSS v4, Shadcn UI, Framer Motion, Lucide React, react-syntax-highlighter, diff (v7)
*   **Vulnerability Database:** OSV