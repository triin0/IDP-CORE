# IDP.CORE Platform Stuatus Report
**Date:** March 17, 2026
**Version:** MVP 1.0

---

## Executive Summary

The AI-Native Internal Developer Platform (IDP.CORE) is a functional MVP that accepts natural language prompts and generates complete, enterprise-grade multi-file applications using a multi-agent LLM pipeline. Generated code is validated against "Golden Path" compliance standards and deployed to live CodeSandbox sandboxes.

**10 of 10 planned tasks are complete.** The platform is deployed and operational.

---

## 1. IMPLEMENTED & WORKING

### 1.1 Multi-Agent Generation Pipeline
**Status: WORKING**

Five specialized AI agents run in sequence to produce a complete application:

| Agent | Role | Output |
|-------|------|--------|
| Architect | Project skeleton, configs, schemas | package.json, tsconfig, DB schemas, entry points |
| Backend Developer | API routes, middleware, business logic | Express routes, controllers, middleware |
| Frontend Developer | React UI, components, API client | Pages, components, hooks, API layer |
| Security Reviewer | Code hardening, vulnerability patching | Hardened replacement files |
| Verification Agent | Independent audit of all generated code | Detailed pass/fail notes |

- Agents run sequentially with context passing (each agent sees prior agents' output)
- File reconciliation follows strict precedence: Architect -> Backend -> Frontend -> Security (Security always wins)
- Orphan recovery catches crashed pipelines and resets them
- LLM provider: Gemini (primary), OpenAI (fallback)

### 1.2 Golden Path Compliance Engine
**Status: WORKING**

9 base compliance checks evaluate every generated project:

| # | Check | Critical | What It Validates |
|---|-------|----------|-------------------|
| 1 | Folder Structure | No | server/, client/, package.json exist |
| 2 | Security Headers | Yes | helmet and cors imports/usage |
| 3 | Input Validation | Yes | zod schema validation on API inputs |
| 4 | Environment Config | No | dotenv usage, no hardcoded ports |
| 5 | No Hardcoded Secrets | Yes | Regex scan for passwords, API keys, tokens |
| 6 | Error Handling | No | try/catch blocks, error middleware |
| 7 | TypeScript | No | .ts/.tsx files, strict mode |
| 8 | Rate Limiting | No | express-rate-limit usage |
| 9 | Database Schema | No | Schema directory with Drizzle/Prisma files |

- Critical checks (2, 3, 5) are hard gates — failure blocks the project from reaching "ready" status
- Checks run via static analysis of the generated file tree
- System prompt injection ensures agents know the rules before generating code

### 1.3 Verification & Audit Stage
**Status: WORKING**

Beyond the 9 Golden Path checks, three additional verification layers run:

| # | Verification | Hard Gate | Description |
|---|-------------|-----------|-------------|
| 10 | Dependency Audit | Yes | Validates all npm packages exist, checks for hallucinated packages, known CVEs, low popularity |
| 11 | Build Verification | Yes | Runs `npm install && npm run build` to confirm the code actually compiles |
| 12 | Hash Integrity | Yes | SHA-256 manifest comparison ensures core config files weren't corrupted during reconciliation |

- All 5 gates must pass: no critical Golden Path failures + no hallucinated deps + hash integrity + build passes + dependency audit passes
- On failure: files are NOT persisted, last known good state preserved, status set to `failed_validation`
- Verification Agent (LLM) treats all prior agent output as "untrusted" and provides independent analysis

### 1.4 Spec-First Planning Mode
**Status: WORKING**

Before code generation, the platform creates an architectural specification:

- User enters a natural language prompt
- AI generates a structured spec: overview, file structure, API endpoints, database tables, middleware, architectural decisions
- User can review and edit the spec interactively before approving
- Spec approval triggers code generation
- Spec regeneration available if the plan isn't right

### 1.5 Iterative Refinement & Conversation Loop
**Status: WORKING**

After initial generation, users can refine their project through chat:

- Send natural language refinement prompts ("add authentication", "make the dashboard responsive")
- AI generates only the changed files (delta), not the entire project
- Delta is merged into existing file tree in memory
- Full verification stage runs on the merged result before persisting
- Hard gate: if verification fails, changes are rejected, last known good files preserved
- Refinement history is recorded with timestamps, prompts, responses, and files changed
- Previously deployed projects drop to "ready" status after refinement (forces re-deploy to guarantee URL matches DB state)
- Refinement only allowed from "ready" or "deployed" status

### 1.6 CodeSandbox Deployment
**Status: WORKING**

Generated projects deploy to live, interactive CodeSandbox sandboxes:

- Creates isolated sandbox via CodeSandbox SDK
- Writes all project files via batch API
- Runs `npm install` in server and client directories
- Starts the dev server automatically
- Returns live preview URL (https://{sandboxId}-3000.csb.app)
- Sandbox hibernates after 1 hour of inactivity (cost-efficient)
- Falls back to static HTML preview if CodeSandbox API unavailable
- API key read from `codesandbox_api` secret

### 1.7 Custom Golden Path Configuration
**Status: WORKING**

Organizations can create and manage their own compliance standards:

- Create custom Golden Path configs with custom rules
- Define tech stack requirements, folder structures, security rules, code quality standards
- Custom regex-based checks with configurable criticality and prompt instructions
- Activate/deactivate configs (only one active at a time)
- Reset to system defaults
- Settings page in the frontend with full CRUD UI

### 1.8 Project Dashboard & History
**Status: WORKING**

Central registry of all generated projects:

- Lists all projects with status badges, prompts, file counts, Golden Path scores
- Pagination support (limit/offset)
- Click through to project workspace
- Status tracking across the full lifecycle: pending -> planning -> planned -> generating -> validating -> ready -> deployed

### 1.9 Frontend Application
**Status: WORKING**

Full React + Vite frontend with 6 pages:

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Project registry with status overview |
| `/new` | Home | Natural language prompt entry for new projects |
| `/settings` | Settings | Golden Path configuration management |
| `/project/:id` | ProjectView | Full project lifecycle (planning, generating, workspace) |
| `/preview/:id` | Preview | Interactive code preview with Sandpack editor |
| `*` | NotFound | 404 error page |

Key components:
- **Workspace**: IDE-like interface with file tree, syntax-highlighted code viewer, status panel, refinement chat
- **StatusTerminal**: Real-time terminal showing agent progress during generation
- **SpecReview**: Interactive spec approval with endpoint/table checklists
- **RefinementChat**: Chat interface with refinement history panel
- **HealthIndicator**: API/LLM connectivity status in nav header
- **GoldenPath**: Visual compliance check dashboard
- **CheckFailurePanel / VerificationFailurePanel**: Failure display with retry buttons

### 1.10 API Server
**Status: WORKING**

Express API server with full route coverage:

**Project Routes:**
| Method | Route | Function |
|--------|-------|----------|
| GET | /projects | List all projects (paginated) |
| POST | /projects | Create new project |
| GET | /projects/:id | Get project details |
| POST | /projects/:id/approve-spec | Approve spec, start generation |
| POST | /projects/:id/regenerate-spec | Regenerate the architectural spec |
| PATCH | /projects/:id/update-spec | Edit spec fields manually |
| POST | /projects/:id/refine | Send refinement prompt |
| POST | /projects/:id/deploy | Deploy to CodeSandbox |
| GET | /projects/:id/preview | Get static HTML preview |

**Golden Path Routes:**
| Method | Route | Function |
|--------|-------|----------|
| GET | /golden-path-configs | List all configs |
| GET | /golden-path-configs/active | Get active config |
| POST | /golden-path-configs | Create new config |
| PUT | /golden-path-configs/:id | Update config |
| DELETE | /golden-path-configs/:id | Delete config |
| POST | /golden-path-configs/:id/activate | Activate a config |
| POST | /golden-path-configs/reset-to-default | Reset to defaults |

**System:**
| Method | Route | Function |
|--------|-------|----------|
| GET | /healthz | Health check (API + LLM connectivity) |

### 1.11 Database Schema
**Status: WORKING**

PostgreSQL with Drizzle ORM, 4 tables:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| projects | Core project data | id, prompt, status, spec, files, goldenPathChecks, pipelineStatus, verificationVerdict, deployUrl, sandboxId, refinements, error |
| golden_path_configs | Custom compliance configs | id, name, description, rules, isActive, isDefault |
| conversations | Chat conversation headers | id, title, createdAt |
| messages | Chat messages | id, conversationId, role, content |

Project statuses: `pending | planning | planned | generating | validating | ready | deployed | failed | failed_checks | failed_validation`

### 1.12 OpenAPI Specification & Type Safety
**Status: WORKING**

- Full OpenAPI 3.0 spec covering all endpoints
- Generated TypeScript client via codegen
- Zero TypeScript errors across the monorepo
- Shared type definitions between API and frontend

---

## 2. IMPLEMENTED BUT WITH KNOWN LIMITATIONS

### 2.1 Failure Recovery
**Status: PARTIALLY WORKING**

- Retry buttons exist on CheckFailurePanel and VerificationFailurePanel
- Retry triggers a page refetch, not a re-run of the pipeline
- A project stuck in `failed_validation` after a refinement attempt cannot be refined again (status guard requires "ready" or "deployed")
- No automatic self-healing (re-running failing agents with error context)

### 2.2 Conversations & Messages Tables
**Status: SCHEMA EXISTS, NOT USED**

- Database tables for conversations and messages are defined and migrated
- No API routes reference these tables
- Refinement history is stored directly in the projects table as JSONB, not in the conversations system
- These tables appear to be legacy or placeholder for a future general chat feature

### 2.3 Static Preview Fallback
**Status: WORKING BUT LIMITED**

- When CodeSandbox API is unavailable, a static HTML page is generated
- Shows file tree, syntax-highlighted code, and Golden Path check results
- Does NOT run the actual application — purely a code viewer
- No interactive functionality (forms don't work, API calls don't execute)

---

## 3. NOT YET IMPLEMENTED

### 3.1 Project Delete
**No DELETE endpoint exists.** Projects can only be created and updated. No way to remove old or failed projects from the dashboard.

### 3.2 Project Export / Download
**No export functionality.** Users cannot download generated code as a ZIP file, push to GitHub, or export in any format. Code can only be viewed in the workspace or deployed to CodeSandbox.

### 3.3 Version History & Diff View
**No version tracking between iterations.** When refinement changes files, the previous version is overwritten. Users cannot see what changed, revert specific files, or compare iterations side-by-side.

### 3.4 AI Self-Healing on Build Failure
**No automatic retry with error context.** When build verification fails, the project is blocked. The system does not attempt to diagnose the error and re-run the failing agent with fix instructions.

### 3.5 Multi-Language / Multi-Framework Support
**Locked to one stack:** Express + React + TypeScript + Drizzle. No support for Python, Go, Vue, Next.js, Svelte, or other frameworks. Golden Path checks are hardcoded for this specific stack.

### 3.6 User Authentication
**No auth system.** The platform is open — anyone with the URL can create projects, deploy sandboxes, and modify Golden Path configs. No user accounts, no teams, no access control.

### 3.7 Template Marketplace
**No template sharing.** Golden Path configs are local to this instance. No way to publish, discover, or fork compliance templates from other organizations.

### 3.8 Real-Time Collaborative Editing
**No multi-user support.** Single-user experience only. No real-time sync, presence indicators, or collaborative refinement.

### 3.9 GitHub Integration
**No Git integration.** Cannot push generated projects to GitHub repos. No CI/CD pipeline generation. No PR-based workflow.

### 3.10 Usage Analytics & Cost Tracking
**No metrics.** No tracking of LLM token usage, sandbox costs, generation success rates, or user activity patterns.

### 3.11 Rate Limiting on API
**No rate limiting on the IDP API itself.** While generated projects are checked for rate limiting compliance, the IDP platform's own API endpoints have no request throttling.

### 3.12 Sandbox Lifecycle Management
**No cleanup of old sandboxes.** Deployed sandboxes hibernate after 1 hour but are never deleted. No dashboard showing active sandboxes or their costs. No ability to wake/shutdown sandboxes from the UI.

---

## 4. ARCHITECTURE OVERVIEW

```
User Prompt
    |
    v
[Spec Generator] --> [Spec Review UI] --> User Approves
    |
    v
[Architect Agent] --> [Backend Agent] --> [Frontend Agent] --> [Security Agent]
    |
    v
[File Reconciliation] (Security wins conflicts)
    |
    v
[Verification Stage]
  |-- Golden Path (9 checks, 3 critical)
  |-- Dependency Audit (hallucination detection)
  |-- Build Verification (npm install + build)
  |-- Hash Integrity (SHA-256 manifest)
  |-- Verification Agent (independent LLM audit)
    |
    v
[Hard Gate] -- FAIL --> status=failed_validation, files NOT saved
    |
   PASS
    |
    v
[status=ready] --> [Deploy] --> CodeSandbox live URL
    |
    v
[Refinement Chat] --> Delta generation --> Merge --> Full re-verification --> Hard gate
```

## 5. TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, Wouter, TanStack Query, Framer Motion |
| Backend | Express, TypeScript, tsx (dev runner) |
| Database | PostgreSQL, Drizzle ORM |
| LLM | Google Gemini (primary), OpenAI (fallback) |
| Sandbox | CodeSandbox SDK |
| Code Preview | Sandpack (in-browser), highlight.js (static fallback) |
| API Contract | OpenAPI 3.0 with generated TypeScript client |
| Monorepo | pnpm workspaces |

## 6. ENVIRONMENT

| Item | Value |
|------|-------|
| API Server Port | 8080 |
| Frontend Port | 21820 (proxied to 80) |
| Database | PostgreSQL via DATABASE_URL |
| LLM Key | GEMINI_API_KEY |
| Sandbox Key | codesandbox_api |
| Deployment | Replit (platform hosting) + CodeSandbox (generated app sandboxes) |
