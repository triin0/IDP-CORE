# AI-Native Internal Developer Platform (IDP) — MVP

## Overview

pnpm workspace monorepo for an AI-Native Internal Developer Platform. The platform accepts natural language prompts, generates complete multi-file applications following "Golden Path" enterprise standards, and deploys them to live preview URLs.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2 for code generation)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (orchestration backend)
│   └── mockup-sandbox/     # Component preview sandbox
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/  # OpenAI SDK client (Replit AI Integrations)
├── deployed-projects/      # Generated project files written to disk on deploy
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Core Features

### Orchestration API

The API server is the platform's "conductor". Key endpoints:

- `POST /api/projects` — Create a project from a prompt. Returns project ID immediately, kicks off async AI generation.
- `GET /api/projects/:id` — Poll project status (`pending` → `generating` → `ready` → `deployed`). Returns file tree, Golden Path compliance checks, and deploy URL.
- `POST /api/projects/:id/deploy` — Deploy generated code to a live preview URL.
- `GET /api/healthz` — Health check.

### Golden Path Engine

The Golden Path system prompt enforces enterprise-grade standards on all AI-generated code:

- **Structure**: `server/src/routes/`, `server/src/middleware/`, `server/src/schema/`, `client/src/components/`, `client/src/hooks/`, `types/`
- **Security**: Helmet headers, CORS with restricted origins, rate limiting, no hardcoded secrets
- **Validation**: Zod on all API route inputs
- **Database**: ORM with schema in `server/src/schema/`, connection pooling, parameterized queries
- **Error Handling**: Global middleware, structured responses, no stack trace leaks
- **TypeScript**: Strict mode, explicit return types, no `any`

Nine automated compliance checks run after generation: Folder Structure, Security Headers, Input Validation, Environment Config, No Hardcoded Secrets, Error Handling, TypeScript, Rate Limiting, Database Schema.

### Deployment

Generated projects are written to `deployed-projects/<project-id>/` and served as static files at `/deployed/<project-id>/`.

## Database Schema

### `projects` table
- `id` (UUID, PK) — auto-generated
- `prompt` (text) — user's natural language prompt
- `status` (enum: pending/generating/ready/deployed/failed)
- `files` (JSONB) — array of `{ path, content }` objects
- `golden_path_checks` (JSONB) — array of `{ name, passed, description }`
- `deploy_url` (text, nullable)
- `error` (text, nullable)
- `created_at` (timestamp)

## TypeScript & Composite Projects

Every lib package extends `tsconfig.base.json` with `composite: true`. The root `tsconfig.json` lists lib packages as project references.

- **Always typecheck from root**: `pnpm run typecheck`
- **Project references**: lib/db, lib/api-client-react, lib/api-zod, lib/integrations-openai-ai-server

## Root Scripts

- `pnpm run build` — typecheck then build all packages
- `pnpm run typecheck` — full TypeScript check across workspace

## Key Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 orchestration server with:
- `src/routes/projects.ts` — Project CRUD + deploy endpoints
- `src/routes/health.ts` — Health check
- `src/lib/golden-path.ts` — Golden Path system prompt + compliance checker
- `src/lib/generate.ts` — AI code generation via OpenAI
- `src/lib/deploy.ts` — File deployment to disk
- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-openai-ai-server`

### `lib/db` (`@workspace/db`)

- `src/schema/projects.ts` — Projects table definition
- Push schema: `pnpm --filter @workspace/db run push`

### `lib/integrations-openai-ai-server`

Pre-configured OpenAI SDK client via Replit AI Integrations. No API key needed — automatically provisioned.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec with project orchestration endpoints. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` / `lib/api-client-react`

Generated Zod schemas and React Query hooks from the OpenAPI spec.
