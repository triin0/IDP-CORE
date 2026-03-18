import type { GoldenPathRule } from "@workspace/engine-common";

export const FASTAPI_GOLDEN_PATH_RULES: GoldenPathRule[] = [
  {
    name: "pydantic-v2-models",
    description: "All API schemas use Pydantic v2 BaseModel with Field constraints",
    promptInstruction: "Use Pydantic v2 BaseModel with Field(...) for all schemas",
    critical: true,
    check: {
      type: "content",
      pattern: "class.*\\(BaseModel\\)",
      file: "main.py",
    },
  },
  {
    name: "schema-triad",
    description: "Each entity has Base/Create/Response model triad",
    promptInstruction: "Every entity needs ItemBase, ItemCreate, ItemResponse models",
    critical: true,
    check: {
      type: "content",
      pattern: "Create\\(.*Base\\)|Response\\(.*Base\\)",
      file: "main.py",
    },
  },
  {
    name: "sqlalchemy-2-mapped",
    description: "SQLAlchemy models use 2.0 Mapped[] declarative style",
    promptInstruction: "Use Mapped[type] = mapped_column() syntax, not legacy Column()",
    critical: true,
    check: {
      type: "content",
      pattern: "Mapped\\[",
      file: "main.py",
    },
  },
  {
    name: "async-routes",
    description: "All route handlers are async def",
    promptInstruction: "All FastAPI route handlers must be async def",
    critical: true,
    check: {
      type: "content",
      pattern: "async def",
      file: "main.py",
    },
  },
  {
    name: "response-model-declared",
    description: "All routes declare response_model explicitly",
    promptInstruction: "Every route must have response_model= parameter",
    critical: false,
    check: {
      type: "content",
      pattern: "response_model=",
      file: "main.py",
    },
  },
  {
    name: "health-endpoint",
    description: "Health check endpoint exists at /api/v1/health",
    promptInstruction: "Include GET /api/v1/health returning {status: healthy}",
    critical: true,
    check: {
      type: "content",
      pattern: "/api/v1/health",
      file: "main.py",
    },
  },
  {
    name: "env-database-url",
    description: "Database URL loaded from environment variable, not hardcoded",
    promptInstruction: "Use os.getenv('DATABASE_URL', 'sqlite+aiosqlite:///./app.db')",
    critical: true,
    check: {
      type: "content",
      pattern: "os\\.getenv.*DATABASE_URL",
      file: "main.py",
    },
  },
  {
    name: "cors-middleware",
    description: "CORS middleware is configured",
    promptInstruction: "Add CORSMiddleware to the FastAPI app",
    critical: false,
    check: {
      type: "content",
      pattern: "CORSMiddleware",
      file: "main.py",
    },
  },
  {
    name: "type-hints",
    description: "PEP 484/604 type hints on function signatures",
    promptInstruction: "Full type hints on all function signatures using PEP 604 union syntax",
    critical: false,
    check: {
      type: "content",
      pattern: "-> .+:",
      file: "main.py",
    },
  },
  {
    name: "extra-forbid",
    description: "Create models use extra='forbid' to prevent over-posting",
    promptInstruction: "All Create schemas must include ConfigDict(extra='forbid')",
    critical: true,
    check: {
      type: "content",
      pattern: "extra.*forbid",
      file: "main.py",
    },
  },
  {
    name: "requirements-pinned",
    description: "requirements.txt has pinned dependency versions",
    promptInstruction: "Pin all dependencies in requirements.txt with >= version constraints",
    critical: true,
    check: {
      type: "file_exists",
      file: "requirements.txt",
    },
  },
];

export function runFastAPIGoldenPathChecks(
  files: Array<{ path: string; content: string }>,
): Array<{ name: string; passed: boolean; description: string; critical?: boolean }> {
  const results: Array<{ name: string; passed: boolean; description: string; critical?: boolean }> = [];

  for (const rule of FASTAPI_GOLDEN_PATH_RULES) {
    let passed = false;

    if (rule.check.type === "file_exists") {
      passed = files.some((f) => f.path === rule.check.file);
    } else if (rule.check.type === "content" && rule.check.pattern && rule.check.file) {
      const file = files.find((f) => f.path === rule.check.file);
      if (file) {
        const regex = new RegExp(rule.check.pattern);
        passed = regex.test(file.content);
      }
    }

    results.push({
      name: rule.name,
      passed,
      description: rule.description,
      critical: rule.critical,
    });
  }

  return results;
}
