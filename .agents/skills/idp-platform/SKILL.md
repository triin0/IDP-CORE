---
name: idp-platform
description: Comprehensive architecture reference for the AI-Native Internal Developer Platform. Covers API endpoints, data models, Golden Path engine, frontend patterns, code generation flow, deployment, and common pitfalls. Use when working on any IDP feature, debugging generation issues, or extending the platform.
---

# AI-Native IDP Platform

## Architecture Overview

pnpm monorepo powering an AI-native Internal Developer Platform that generates full-stack applications from natural language prompts, enforces enterprise standards via Golden Path checks, and deploys to live preview URLs.

## API Endpoints

All endpoints are prefixed with `/api` (configured in OpenAPI spec `servers[0].url`).

| Method | Path | Operation | Description |
|--------|------|-----------|-------------|
| GET | `/api/healthz` | `healthCheck` | System + LLM health (gpt-5-nano probe, 60s TTL cache) |
| GET | `/api/projects` | `listProjects` | Paginated list (limit/offset), newest first |
| POST | `/api/projects` | `createProject` | Create from prompt, async generation |
| GET | `/api/projects/:id` | `getProject` | Full project with files/checks (poll-friendly) |
| POST | `/api/projects/:id/deploy` | `deployProject` | Deploy to live URL |

## Data Model

### projects table (`lib/db/src/schema/projects.ts`)
- `id` UUID PK (auto-generated)
- `prompt` text
- `status` enum: pending → generating → ready → deployed | failed
- `files` JSONB `Array<{path, content}>`
- `goldenPathChecks` JSONB `Array<{name, passed, description}>`
- `deployUrl` text nullable
- `error` text nullable
- `createdAt` timestamp

## Code Generation Flow

1. `POST /api/projects` creates DB row (status=pending), returns immediately
2. `generateProjectCode()` runs async:
   - Sets status=generating
   - Calls OpenAI gpt-5.2 with `GOLDEN_PATH_SYSTEM_PROMPT` + user prompt
   - Uses `response_format: { type: "json_object" }`, `max_completion_tokens: 16384`
   - Parses response into `{ files: [{path, content}] }`
   - Runs `runGoldenPathChecks()` against generated files
   - Sets status=ready with files + checks
   - On failure: sets status=failed with error message

## Golden Path Engine (`artifacts/api-server/src/lib/golden-path.ts`)

9 compliance checks run post-generation:

1. **Folder Structure** — server/ + client/ + package.json
2. **Security Headers** — helmet + cors
3. **Input Validation** — zod usage
4. **Environment Config** — process.env + .env file
5. **No Hardcoded Secrets** — regex scan for leaked credentials
6. **Error Handling** — errorHandler middleware + catch blocks
7. **TypeScript** — .ts/.tsx files + tsconfig
8. **Rate Limiting** — rate + limit keywords
9. **Database Schema** — schema/ directory

System prompt enforces: Express backend, React frontend, TypeScript strict, Zod validation, Helmet+CORS, rate limiting, ORM with schema dir, env vars, error handler middleware.

## Frontend Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Dashboard` | Project registry with status/scores/timestamps |
| `/new` | `Home` → `PromptForm` | New project creation |
| `/project/:id` | `ProjectView` → `Workspace` | 3-panel workspace |

### Workspace Layout
- **Left (w-64)**: `FileTree` — collapsible tree from flat paths
- **Center (flex-1)**: `CodeViewer` — react-syntax-highlighter/Prism + oneDark
- **Right (w-72)**: `StatusPanel` — progress, GoldenPath checklist, deploy button

### Polling Behavior
`ProjectView` uses `useGetProject` with `refetchInterval: 2000` while status is pending/generating. Stops when status changes.

## Key Technical Decisions

- **Import path**: Always `@workspace/api-client-react` (never deep imports)
- **Error handling**: `isApiError()` type guard for typed error narrowing
- **Health check**: `HealthStatus` schema lacks `llm` field — cast to local `HealthDataWithLlm` interface
- **Code viewer**: `customStyle` must set `background: "transparent"`
- **Deploy**: Writes to `deployed-projects/<id>/`, served at `/deployed/<id>/` via Express static

## Common Pitfalls

1. `queryKey` must be explicit when using generated hooks
2. `GenerationProgress` uses `useEffect` with cleanup for interval
3. After deploy, invalidate project query for status consistency
4. Golden Path score comparison: split on "/" and compare passed === total
5. Vite config requires `PORT` and `BASE_PATH` env vars at build time

## File Map

```
artifacts/api-server/src/
├── routes/projects.ts      # All CRUD + deploy endpoints
├── routes/health.ts         # Health check with LLM probe
├── lib/golden-path.ts       # System prompt + 9 compliance checks
├── lib/generate.ts          # OpenAI code generation
└── lib/deploy.ts            # File deployment to disk

artifacts/idp-frontend/src/
├── App.tsx                  # Router + NavHeader (/, /new, /project/:id)
├── pages/Dashboard.tsx      # Project registry listing
├── pages/Home.tsx           # Prompt form wrapper
├── pages/ProjectView.tsx    # Project workspace loader + polling
├── components/Workspace.tsx # 3-panel layout + StatusPanel
├── components/FileTree.tsx  # Collapsible file tree
├── components/CodeViewer.tsx# Syntax-highlighted code display
├── components/GoldenPath.tsx# Compliance checklist card
├── components/PromptForm.tsx# Terminal-styled prompt input
└── components/HealthIndicator.tsx # System/LLM status badges

lib/api-spec/openapi.yaml   # OpenAPI 3.1 spec
lib/api-client-react/        # Generated React Query hooks (Orval)
lib/api-zod/                 # Generated Zod schemas
lib/db/                      # Drizzle ORM schema + connection
```
