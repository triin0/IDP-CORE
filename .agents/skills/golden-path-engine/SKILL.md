---
name: golden-path-engine
description: Extend and maintain the Golden Path compliance engine for AI-generated code. Use when adding new compliance checks, modifying the system prompt, adjusting check logic, or debugging why generated code fails specific checks.
---

# Golden Path Engine

The Golden Path engine enforces enterprise standards on all AI-generated code. It has two parts: a system prompt that guides the AI, and a post-generation checker that validates the output.

## Architecture

```
User Prompt → System Prompt (guide AI) → AI generates code → runGoldenPathChecks() → Results
```

### Files
- **System Prompt**: `artifacts/api-server/src/lib/golden-path.ts` → `GOLDEN_PATH_SYSTEM_PROMPT`
- **Checker**: Same file → `runGoldenPathChecks(files)` function
- **Integration**: `artifacts/api-server/src/lib/generate.ts` calls both

## Current Checks (9)

| # | Name | Logic | What It Validates |
|---|------|-------|-------------------|
| 1 | Folder Structure | `server/` + `client/` + `package.json` in paths | Organized monorepo layout |
| 2 | Security Headers | `helmet` + `cors` in content | HTTP security middleware |
| 3 | Input Validation | `zod` or `z.object` or `z.string` | Schema-based validation |
| 4 | Environment Config | `process.env` + `.env` file | Config from env vars |
| 5 | No Hardcoded Secrets | Regex: no `password/secret/token = "..."` | No leaked credentials |
| 6 | Error Handling | `errorHandler` or (`catch` + `middleware`) | Global error handler |
| 7 | TypeScript | `.ts`/`.tsx` files + `tsconfig` | Type safety |
| 8 | Rate Limiting | `rate` + `limit` keywords | API protection |
| 9 | Database Schema | `schema/` in file paths | ORM schema files |

## Adding a New Check

Each check follows this pattern:
```typescript
{
  name: "Check Name",
  passed: /* boolean expression */,
  description: "Human-readable explanation of what this check validates",
}
```

### Available Data
- `filePaths: string[]` — All generated file paths
- `allContent: string` — All file contents concatenated
- `files: Array<{path, content}>` — Individual files with content

### Example: Adding Check #10 (Dependency Audit)
```typescript
{
  name: "Dependency Audit",
  passed: await auditDependencies(files), // async check
  description: "All AI-suggested packages verified against known-safe registry",
}
```

Note: If adding async checks, `runGoldenPathChecks` must become async and callers updated.

## System Prompt Structure

The system prompt has 4 sections:
1. **ROLE** — Identity and purpose
2. **OUTPUT FORMAT** — JSON with `files` array
3. **ENFORCED RULES** — 7 numbered rules (structure, security, validation, consistency, database, error handling, code quality)
4. **TASK** — Final instruction

### Modifying the System Prompt
- Keep rules numbered and specific
- Use backtick code examples for file paths
- Always specify "do NOT include text before/after JSON"
- Test changes by generating a simple app and verifying check pass rates

## Frontend Display

The `GoldenPath.tsx` component renders checks as a card:
- Header: "GOLDEN PATH" with pass count (e.g., "9/9 PASSED")
- Compliance badge: COMPLIANT (green) or NON-COMPLIANT (red)
- Individual checks: green checkmark or red X with name

### Score Calculation
```typescript
const passed = checks.filter(c => c.passed).length;
const total = checks.length;
const allPassed = passed === total;
const score = `${passed}/${total}`;
```

## Testing Changes

1. Modify system prompt or add checks in `golden-path.ts`
2. Restart API server
3. Generate a test project via the prompt form
4. Verify check results in the workspace status panel
5. Check edge cases: empty prompt, very short prompt, specific tech stack requests
