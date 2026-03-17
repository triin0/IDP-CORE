# AI-Native Internal Developer Platform (IDP) — MVP

## Overview

This project is an AI-Native Internal Developer Platform (IDP) designed to streamline application development. It functions as a pnpm workspace monorepo that accepts natural language prompts, generates multi-file applications adhering to enterprise "Golden Path" standards, and deploys them to live preview URLs. The platform aims to automate and standardize application creation, significantly reducing development time and ensuring compliance with best practices.

## User Preferences

I want iterative development. Ask before making major architectural changes or before deploying to production. For explanations, prioritize clarity and conciseness. I prefer seeing the overall plan before diving into code. Do not make changes to files in the `deployed-projects/` directory.

## System Architecture

The IDP is built as a pnpm workspace monorepo, featuring an Express 5 API server for orchestration and a React frontend. Data persistence is handled by PostgreSQL with Drizzle ORM. AI capabilities are supported by both OpenAI and Gemini Pro, with auto-selection based on API key availability.

**Core Technical Implementations:**

*   **Orchestration API:** A central Express server manages the project lifecycle, handling creation, status polling, architectural spec approval, deployment, and deletion. It is secured with helmet, strict CORS, and rate limiting.
*   **Multi-Agent AI Pipeline:** A sequential 6-agent pipeline (Architect, Backend Developer, Frontend Developer, Security Reviewer, Verification & Audit Agent, Fixer Agent) generates and validates code. A **Self-Healing Loop** allows the Fixer Agent to produce targeted fixes based on error evidence, retrying verification up to 3 times.
*   **AI Provider Layer:** Supports dual AI providers (OpenAI `gpt-5.2` or Gemini Pro `gemini-2.5-pro`) with built-in retry logic and a **token continuation loop** for handling `MAX_TOKENS` responses.
*   **Orphan Recovery:** Automatically restarts AI processing for projects stuck in `planning`, `generating`, or `validating` statuses due to server interruptions.
*   **Golden Path Engine:** Enforces enterprise standards for AI-generated code through eleven automated compliance checks, covering structure, security, validation, database practices, error handling, and TypeScript usage. Critical checks block projects from reaching "ready" status.
*   **Dependency Audit:** Validates every AI-generated npm dependency against hallucination, typosquatting, low popularity, and CVEs (using the OSV database).
*   **Build Verification:** Runs `npm install && npm run build` in a temporary directory after code generation, with path traversal protection.
*   **Authentication & Multi-Tenancy:** Uses Replit Auth (OpenID Connect with PKCE) for user authentication and server-side PostgreSQL sessions. Project access is scoped to the authenticated user, and ownership checks prevent IDOR attacks.
*   **Git-Style Diff Viewer:** Saves pre-merge snapshots and renders unified diffs for refinements, showing line numbers, highlighting, and collapsible sections.
*   **Deployment:** Generated projects deploy to live CodeSandbox cloud VMs for interactive previews, with a fallback to static HTML.
*   **Sandbox Lifecycle Management:** Automatically cleans up stale CodeSandbox VMs and manages sandbox deletion upon project removal.
*   **Real-Time Pipeline Observability (SSE):** Server-Sent Events stream pipeline progress to the frontend, providing `stage:start/complete/fail`, `verification` and `self-healing` events, and logs.
*   **Frontend (Observable UI):** A React + Vite application with Tailwind CSS, Shadcn UI, and Framer Motion. Features include: **Live Pipeline Visualization** (horizontal bar with 5 agent nodes that light up neon green with pulse animations as the SSE stream reports active agents; key file: `AgentPipelineBar.tsx`), **Agent Trajectory Dashboard**, **Live Terminal**, **Build Verification Gate**, **Sandbox Preview**, architectural spec review, file tree and code viewer, Golden Path compliance checklist, and one-click deployment.

**UI/UX Decisions:**

*   **Design:** Dark mode professional theme with a terminal/developer aesthetic.
*   **Navigation:** Persistent header with clear navigation.
*   **Information Display:** Real-time polling, syntax-highlighted code viewer, and clear health indicators.

**System Design Choices:**

*   **Monorepo Structure:** pnpm workspaces for managing deployable applications and shared libraries.
*   **Database Schema:** `projects` table tracks metadata, status, and outputs. `golden_path_configs` stores customizable enterprise standards.
*   **TypeScript & Composite Projects:** Extensive use of TypeScript with project references for type safety and modularity.
*   **Config-Driven Generation:** The Golden Path engine is driven by active configurations stored in the database.

## External Dependencies

*   **Monorepo Tool:** pnpm workspaces
*   **Database:** PostgreSQL + Drizzle ORM
*   **API Framework:** Express 5
*   **Validation:** Zod (`zod/v4`), `drizzle-zod`
*   **API Codegen:** Orval
*   **AI Providers:** OpenAI (via Replit AI Integrations), Google Gemini Pro (`@google/generative-ai`)
*   **Build Tool:** esbuild
*   **Frontend Frameworks/Libraries:** React, Vite, Tailwind CSS, Shadcn UI, Framer Motion, Lucide React, `react-syntax-highlighter`
*   **Open Source Vulnerability Database:** OSV (for dependency auditing)