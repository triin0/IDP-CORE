# AI-Native Internal Developer Platform (IDP) — MVP

## Overview

This project is an AI-Native Internal Developer Platform (IDP) designed to streamline application development. It functions as a pnpm workspace monorepo that accepts natural language prompts, generates multi-file applications adhering to enterprise "Golden Path" standards, and deploys them to live preview URLs. The platform aims to automate and standardize application creation, significantly reducing development time and ensuring compliance with best practices.

## User Preferences

I want iterative development. Ask before making major architectural changes or before deploying to production. For explanations, prioritize clarity and conciseness. I prefer seeing the overall plan before diving into code. Do not make changes to files in the `deployed-projects/` directory.

## System Architecture

The IDP is built as a pnpm workspace monorepo. It features an Express 5 API server for orchestration and a React frontend for the user interface. Data persistence is handled by PostgreSQL with Drizzle ORM. AI capabilities are supported by both OpenAI and Gemini Pro, with auto-selection based on API key availability.

**Core Technical Implementations:**

*   **Orchestration API:** The API server acts as the central conductor, managing project lifecycle from creation via natural language prompts to deployment. Key endpoints handle project creation, status polling, architectural spec approval/regeneration/updates, and deployment.
*   **Multi-Agent AI Pipeline:** Code generation is managed by a sequential 4-agent pipeline: Architect, Backend Developer, Frontend Developer, and Security Reviewer. Each agent builds upon the previous one's output, with a reconciler merging results and the Security Reviewer having final say on conflicts for security hardening.
*   **AI Provider Layer:** Supports dual AI providers (OpenAI or Gemini Pro) with built-in retry logic and token limit handling to ensure robustness.
*   **Orphan Recovery:** Automatically restarts AI processing for projects stuck due to server interruptions.
*   **Golden Path Engine:** Enforces enterprise standards for AI-generated code, covering structure, security, validation (Zod), database practices, error handling, and TypeScript usage. This includes ten automated compliance checks, such as dependency auditing for security vulnerabilities and potential supply chain risks.
*   **Token Exhaustion Protection:** Gracefully handles AI token limit exhaustion, preventing malformed output and providing clear error messages.
*   **Deployment:** Generated projects deploy to live CodeSandbox cloud VMs (when `CSB_API_KEY` or `codesandbox_api` is set) for interactive previews at `*.csb.app` URLs. Falls back to static HTML preview if sandbox creation fails. Key file: `artifacts/api-server/src/lib/sandbox.ts`. DB fields: `sandboxId`, `deployUrl` on projects table.
*   **Frontend (MVP UI):** A React + Vite application using Tailwind CSS, Shadcn UI, and Framer Motion. It provides a terminal-styled prompt input, an architectural spec review interface with editing capabilities, real-time generation status, a results view with file tree and code viewer, Golden Path compliance checklist, and one-click deployment. A dedicated settings page allows for custom Golden Path configuration.

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