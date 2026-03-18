# AI-Native Internal Developer Platform (IDP.CORE) — MVP

## Overview
The AI-Native Internal Developer Platform (IDP.CORE) is an MVP designed to revolutionize application development by leveraging AI. It accepts natural language prompts, uses a multi-agent LLM pipeline to generate complete, multi-file applications adhering to "Golden Path" enterprise standards, and deploys them to live CodeSandbox sandboxes. The platform provides a real-time observable UI, secured with Replit Auth multi-tenancy, and styled with "The Glass Engine" design system. The core vision is to streamline development, enforce best practices, and accelerate deployment through intelligent automation.

## User Preferences
Iterative development. Ask before making major architectural changes or deploying to production. Prioritize clarity and conciseness. Show the overall plan before coding. Do not modify files in `deployed-projects/`.

## System Architecture
The IDP is built as a pnpm workspace monorepo. It features an Express 5 API server for orchestration, a React frontend for the observation UI, and uses PostgreSQL with Drizzle ORM for data persistence. It utilizes a dual AI provider strategy, with Gemini Pro as the primary and OpenAI as a fallback.

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
*   **Snapshot Time Travel ("Timeline" tab):** A horizontal timeline UI showing version history.
*   **Magic Seed Data Generator ("Seeds" tab):** AI-powered seed data generation for all database tables.
*   **Error Decryptor:** Translates raw technical errors into friendly, non-technical descriptions.
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