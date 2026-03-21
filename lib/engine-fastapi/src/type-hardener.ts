interface PipelineFile {
  path: string;
  content: string;
}

interface HardenerResult {
  files: PipelineFile[];
  fixes: string[];
}

export function hardenFastAPITypes(
  files: PipelineFile[],
): HardenerResult {
  let currentFiles = [...files];
  const allFixes: string[] = [];

  const legacySQLAlchemy = fixLegacySQLAlchemy(currentFiles);
  currentFiles = legacySQLAlchemy.files;
  allFixes.push(...legacySQLAlchemy.fixes);

  const pydanticV1 = fixPydanticV1Patterns(currentFiles);
  currentFiles = pydanticV1.files;
  allFixes.push(...pydanticV1.fixes);

  const syncRoutes = fixSyncRouteHandlers(currentFiles);
  currentFiles = syncRoutes.files;
  allFixes.push(...syncRoutes.fixes);

  const rawSQL = fixRawSQLStrings(currentFiles);
  currentFiles = rawSQL.files;
  allFixes.push(...rawSQL.fixes);

  const hardcoded = fixHardcodedSecrets(currentFiles);
  currentFiles = hardcoded.files;
  allFixes.push(...hardcoded.fixes);

  const configDict = fixMissingConfigDict(currentFiles);
  currentFiles = configDict.files;
  allFixes.push(...configDict.fixes);

  const reqVersions = fixRequirementsVersions(currentFiles);
  currentFiles = reqVersions.files;
  allFixes.push(...reqVersions.fixes);

  const pagination = fixAutoPagination(currentFiles);
  currentFiles = pagination.files;
  allFixes.push(...pagination.fixes);

  const eagerLoad = fixEagerLoadingEnforcement(currentFiles);
  currentFiles = eagerLoad.files;
  allFixes.push(...eagerLoad.fixes);

  const compression = fixResponseCompression(currentFiles);
  currentFiles = compression.files;
  allFixes.push(...compression.fixes);

  const perfConst = fixFastAPIPerformanceConstants(currentFiles);
  currentFiles = perfConst.files;
  allFixes.push(...perfConst.fixes);

  return { files: currentFiles, fixes: allFixes };
}

function fixLegacySQLAlchemy(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".py")) return file;

    let content = file.content;
    let modified = false;

    if (content.includes("declarative_base()")) {
      content = content.replace(
        /from sqlalchemy\.ext\.declarative import declarative_base/g,
        "from sqlalchemy.orm import DeclarativeBase",
      );
      content = content.replace(
        /from sqlalchemy\.orm import (.+), declarative_base/g,
        "from sqlalchemy.orm import $1, DeclarativeBase",
      );
      content = content.replace(
        /Base\s*=\s*declarative_base\(\)/g,
        "class Base(DeclarativeBase):\n    pass",
      );
      modified = true;
      fixes.push(`[${file.path}] Replaced legacy declarative_base() with SQLAlchemy 2.0 DeclarativeBase`);
    }

    if (content.includes("Column(") && !content.includes("mapped_column")) {
      content = content.replace(/\bColumn\(/g, "mapped_column(");
      if (!content.includes("mapped_column")) {
        content = content.replace(
          /from sqlalchemy import (.+)/,
          (match, imports) => {
            if (!imports.includes("mapped_column")) {
              return `from sqlalchemy import ${imports}\nfrom sqlalchemy.orm import mapped_column`;
            }
            return match;
          },
        );
      }
      modified = true;
      fixes.push(`[${file.path}] Replaced legacy Column() with mapped_column() (SQLAlchemy 2.0)`);
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixPydanticV1Patterns(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".py")) return file;

    let content = file.content;
    let modified = false;

    if (content.includes("Optional[")) {
      content = content.replace(/Optional\[(\w+)\]/g, "$1 | None");
      content = content.replace(/from typing import (.*)Optional(.*)/g, (match, before, after) => {
        const remaining = (before + after).replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
        return remaining ? `from typing import ${remaining}` : "";
      });
      modified = true;
      fixes.push(`[${file.path}] Replaced Optional[X] with PEP 604 X | None syntax`);
    }

    if (content.includes("List[")) {
      content = content.replace(/\bList\[(\w+)\]/g, "list[$1]");
      modified = true;
      fixes.push(`[${file.path}] Replaced List[X] with PEP 585 list[X] syntax`);
    }

    if (content.includes("Dict[")) {
      content = content.replace(/\bDict\[(\w+),\s*(\w+)\]/g, "dict[$1, $2]");
      modified = true;
      fixes.push(`[${file.path}] Replaced Dict[K,V] with PEP 585 dict[K,V] syntax`);
    }

    const classConfigPattern = /class Config:\s*\n\s*(orm_mode\s*=\s*True|from_attributes\s*=\s*True)/g;
    if (classConfigPattern.test(content)) {
      content = content.replace(
        /class Config:\s*\n\s*orm_mode\s*=\s*True/g,
        'model_config = ConfigDict(from_attributes=True)',
      );
      content = content.replace(
        /class Config:\s*\n\s*from_attributes\s*=\s*True/g,
        'model_config = ConfigDict(from_attributes=True)',
      );
      if (content.includes("ConfigDict") && !content.includes("from pydantic import") || !content.includes("ConfigDict")) {
        content = content.replace(
          /from pydantic import ([^;\n]+)/,
          (match, imports) => {
            if (!imports.includes("ConfigDict")) {
              return `from pydantic import ${imports.trim()}, ConfigDict`;
            }
            return match;
          },
        );
      }
      modified = true;
      fixes.push(`[${file.path}] Replaced class Config with model_config = ConfigDict() (Pydantic V2)`);
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixSyncRouteHandlers(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".py")) return file;

    let content = file.content;
    let modified = false;

    const routePattern = /@(?:app|router)\.(get|post|put|patch|delete)\([^)]*\)\s*\ndef\s+/g;
    if (routePattern.test(content)) {
      content = content.replace(
        /(@(?:app|router)\.(get|post|put|patch|delete)\([^)]*\)\s*\n)(def\s+)/g,
        "$1async $3",
      );
      modified = true;
      fixes.push(`[${file.path}] Converted sync route handlers to async def (FastAPI async-first)`);
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixRawSQLStrings(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".py")) return file;

    let content = file.content;
    let modified = false;

    const rawSQLPattern = /f["'](SELECT|INSERT|UPDATE|DELETE)\s/g;
    if (rawSQLPattern.test(content)) {
      content = content.replace(
        /(\w+)\.execute\(\s*f["']((?:SELECT|INSERT|UPDATE|DELETE)[^"']*)\{(\w+)\}([^"']*)["']\s*\)/g,
        (match, session, sqlBefore, param, sqlAfter) => {
          modified = true;
          return `${session}.execute(text("${sqlBefore}:${param}${sqlAfter}"), {"${param}": ${param}})`;
        },
      );
      if (modified) {
        if (!content.includes("from sqlalchemy import text") && !content.includes("from sqlalchemy import") ) {
          content = `from sqlalchemy import text\n` + content;
        } else if (content.includes("from sqlalchemy import") && !content.includes("text")) {
          content = content.replace(
            /from sqlalchemy import ([^\n]+)/,
            (m, imports) => `from sqlalchemy import ${imports.trim()}, text`,
          );
        }
        fixes.push(`[${file.path}] Replaced raw f-string SQL with parameterized text() queries (SQL injection prevention)`);
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixHardcodedSecrets(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".py")) return file;

    let content = file.content;
    let modified = false;

    const hardcodedDBPattern = /(?:DATABASE_URL|SQLALCHEMY_DATABASE_URL|db_url|database_url)\s*=\s*["']((?:postgresql|mysql|sqlite|postgres):\/\/[^"']+)["']/g;
    if (hardcodedDBPattern.test(content)) {
      content = content.replace(
        /(\w+)\s*=\s*["']((?:postgresql|mysql|sqlite|postgres)(?:\+\w+)?:\/\/[^"']+)["']/g,
        (match, varName) => {
          modified = true;
          return `${varName} = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./app.db")`;
        },
      );
      if (modified && !content.includes("import os")) {
        content = "import os\n" + content;
      }
      fixes.push(`[${file.path}] Replaced hardcoded database URL with os.getenv("DATABASE_URL")`);
    }

    const hardcodedSecretPattern = /(?:SECRET_KEY|JWT_SECRET|secret_key|api_key)\s*=\s*["'][a-zA-Z0-9_-]{8,}["']/g;
    if (hardcodedSecretPattern.test(content)) {
      content = content.replace(
        /(SECRET_KEY|JWT_SECRET|secret_key|api_key)\s*=\s*["'][a-zA-Z0-9_-]{8,}["']/g,
        (match, varName) => {
          modified = true;
          const envVar = varName.toUpperCase();
          return `${varName} = os.getenv("${envVar}", "change-me-in-production")`;
        },
      );
      if (modified && !content.includes("import os")) {
        content = "import os\n" + content;
      }
      fixes.push(`[${file.path}] Replaced hardcoded secrets with os.getenv() environment variable lookups`);
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixMissingConfigDict(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".py")) return file;

    let content = file.content;
    let modified = false;

    const createClassPattern = /class (\w+Create)\((\w+)(?:Base)?\):\s*\n((?:\s+.*\n)*)/g;
    let match: RegExpExecArray | null;
    while ((match = createClassPattern.exec(content)) !== null) {
      const [fullMatch, className, , body] = match;
      if (!body.includes('extra') && !body.includes('model_config')) {
        const indent = body.match(/^(\s+)/)?.[1] || "    ";
        const configLine = `${indent}model_config = ConfigDict(extra="forbid")\n`;
        const insertPos = match.index + fullMatch.indexOf(body);
        content = content.slice(0, insertPos) + configLine + content.slice(insertPos);
        modified = true;
        fixes.push(`[${file.path}] Injected model_config = ConfigDict(extra="forbid") on ${className} (over-posting prevention)`);
        break;
      }
    }

    const responseClassPattern = /class (\w+Response)\((\w+)(?:Base)?\):\s*\n((?:\s+.*\n)*)/g;
    while ((match = responseClassPattern.exec(content)) !== null) {
      const [fullMatch, className, , body] = match;
      if (!body.includes('from_attributes') && !body.includes('model_config') && !body.includes('orm_mode')) {
        const indent = body.match(/^(\s+)/)?.[1] || "    ";
        const configLine = `${indent}model_config = ConfigDict(from_attributes=True)\n`;
        const insertPos = match.index + fullMatch.indexOf(body);
        content = content.slice(0, insertPos) + configLine + content.slice(insertPos);
        modified = true;
        fixes.push(`[${file.path}] Injected model_config = ConfigDict(from_attributes=True) on ${className}`);
        break;
      }
    }

    if (modified && content.includes("ConfigDict") && !content.includes("from pydantic")) {
      content = `from pydantic import ConfigDict\n` + content;
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixRequirementsVersions(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const PINNED_VERSIONS: Record<string, string> = {
    "fastapi": ">=0.115.0",
    "uvicorn": ">=0.34.0",
    "pydantic": ">=2.10.0",
    "sqlalchemy": ">=2.0.0",
    "aiosqlite": ">=0.20.0",
    "alembic": ">=1.14.0",
    "httpx": ">=0.28.0",
    "python-dotenv": ">=1.1.0",
  };

  const result = files.map(file => {
    if (file.path !== "requirements.txt") return file;

    let content = file.content;
    let modified = false;
    const lines = content.split("\n");

    const updatedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;

      const pkgMatch = trimmed.match(/^([a-zA-Z0-9_-]+)/);
      if (!pkgMatch) return line;
      const pkg = pkgMatch[1].toLowerCase();

      if (PINNED_VERSIONS[pkg]) {
        if (!trimmed.includes(">=") && !trimmed.includes("==")) {
          modified = true;
          return `${pkg}${PINNED_VERSIONS[pkg]}`;
        }
      }

      return line;
    });

    for (const [pkg, version] of Object.entries(PINNED_VERSIONS)) {
      if (!updatedLines.some(l => l.toLowerCase().startsWith(pkg))) {
        updatedLines.push(`${pkg}${version}`);
        modified = true;
      }
    }

    if (modified) {
      fixes.push(`[${file.path}] Enforced pinned dependency versions for production Python stack`);
      return { path: file.path, content: updatedLines.join("\n") };
    }

    return file;
  });

  return { files: result, fixes };
}

function fixAutoPagination(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".py")) return file;

    let content = file.content;
    let modified = false;

    const lines = content.split("\n");
    const patchedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!/^\s*async\s+def\s+/.test(line)) {
        patchedLines.push(line);
        continue;
      }

      const funcMatch = line.match(/^(\s*)async\s+def\s+(\w+)\s*\(([^)]*)\)/);
      if (!funcMatch) {
        patchedLines.push(line);
        continue;
      }

      const [, indent, funcName, params] = funcMatch;

      if (params.includes("limit") || params.includes("offset") || params.includes("skip")) {
        patchedLines.push(line);
        continue;
      }

      let hasDecorator = false;
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j].trim();
        if (prev.startsWith("@")) {
          if (/^@(?:app|router)\.get\s*\(/.test(prev)) {
            hasDecorator = true;
          }
          break;
        }
        if (prev !== "") break;
      }

      if (!hasDecorator) {
        patchedLines.push(line);
        continue;
      }

      const isListEndpoint = funcName.startsWith("get_all") ||
        funcName.startsWith("list_") ||
        (funcName.startsWith("get_") && (funcName.endsWith("s") || funcName.includes("_all")));

      let hasListResponse = false;
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j].trim();
        if (prev.startsWith("@") && /response_model\s*=\s*list\[/i.test(prev)) {
          hasListResponse = true;
          break;
        }
        if (!prev.startsWith("@") && prev !== "") break;
      }

      if (!isListEndpoint && !hasListResponse) {
        patchedLines.push(line);
        continue;
      }

      const newParams = params.trim()
        ? `${params.trim()}, limit: int = 100, offset: int = 0`
        : `limit: int = 100, offset: int = 0`;

      patchedLines.push(`${indent}async def ${funcName}(${newParams}):`);
      modified = true;
      fixes.push(`[${file.path}] Injected limit/offset pagination on ${funcName}() (default limit=100)`);

      continue;
    }

    if (modified) {
      content = patchedLines.join("\n");

      const selectAllPattern = /result\s*=\s*await\s+\w+\.execute\s*\(\s*select\s*\([^)]+\)\s*\)/g;
      let selectMatch: RegExpExecArray | null;
      while ((selectMatch = selectAllPattern.exec(content)) !== null) {
        const stmt = selectMatch[0];
        if (stmt.includes(".limit(") || stmt.includes(".offset(")) continue;
        const patched = stmt.replace(/\)\s*\)$/, ").limit(limit).offset(offset))");
        content = content.replace(stmt, patched);
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixEagerLoadingEnforcement(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".py")) return file;

    let content = file.content;
    let modified = false;

    if (!content.includes("relationship(") || !content.includes("select(")) return file;

    const relationshipMatches = content.match(/(\w+)\s*:\s*Mapped\[.*?\]\s*=\s*relationship\(/g) || [];
    const relationNames = relationshipMatches.map(r => r.match(/(\w+)\s*:/)?.[1]).filter(Boolean) as string[];

    if (relationNames.length === 0) return file;

    function getClassBlock(src: string, className: string): string {
      const classStart = src.indexOf(`class ${className}(`);
      if (classStart === -1) return "";
      const nextClass = src.indexOf("\nclass ", classStart + 1);
      return src.slice(classStart, nextClass !== -1 ? nextClass : src.length);
    }

    const selectPattern = /(await\s+\w+\.execute\s*\(\s*)(select\s*\(\s*(\w+)\s*\))([^)]*\))/g;
    let selectMatch: RegExpExecArray | null;

    while ((selectMatch = selectPattern.exec(content)) !== null) {
      const [fullMatch, executePrefix, selectCall, modelName, afterSelect] = selectMatch;

      if (fullMatch.includes("selectinload") || fullMatch.includes("joinedload")) continue;

      const classBlock = getClassBlock(content, modelName);
      if (!classBlock) continue;

      const relForModel = relationNames.filter(r => classBlock.includes(`${r}:`));
      if (relForModel.length === 0) continue;

      const optionsStr = relForModel.map(r => `selectinload(${modelName}.${r})`).join(", ");
      const patched = `${executePrefix}${selectCall}.options(${optionsStr})${afterSelect}`;
      content = content.replace(fullMatch, patched);
      modified = true;
      fixes.push(`[${file.path}] Injected selectinload() for ${relForModel.join(", ")} on ${modelName} queries (N+1 prevention)`);
    }

    if (modified && !content.includes("selectinload")) {
      if (content.includes("from sqlalchemy.orm import")) {
        content = content.replace(
          /from sqlalchemy\.orm import ([^\n]+)/,
          (m, imports) => imports.includes("selectinload") ? m : `from sqlalchemy.orm import ${imports.trim()}, selectinload`,
        );
      } else {
        content = `from sqlalchemy.orm import selectinload\n${content}`;
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixResponseCompression(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith("main.py")) return file;
    if (!file.content.includes("FastAPI")) return file;
    if (file.content.includes("GZipMiddleware")) return file;

    let content = file.content;

    const appVarMatch = content.match(/(\w+)\s*=\s*FastAPI\s*\(/);
    if (!appVarMatch) return file;
    const appVar = appVarMatch[1];

    const gzipImport = "from starlette.middleware.gzip import GZipMiddleware\n";
    const gzipMiddleware = `${appVar}.add_middleware(GZipMiddleware, minimum_size=500)`;

    const existingMiddleware = content.match(new RegExp(`${escapeRegex(appVar)}\\.add_middleware\\s*\\(`));
    if (existingMiddleware) {
      const idx = content.indexOf(existingMiddleware[0]);
      const lineStart = content.lastIndexOf("\n", idx);
      const indent = content.slice(lineStart + 1, idx).match(/^(\s*)/)?.[1] || "";
      content = content.slice(0, lineStart + 1) +
        `${indent}${gzipMiddleware}\n` +
        content.slice(lineStart + 1);
    } else {
      const appDefIdx = content.indexOf(appVarMatch[0]);
      const appLineEnd = content.indexOf("\n", appDefIdx);
      if (appLineEnd !== -1) {
        content = content.slice(0, appLineEnd + 1) +
          `\n${gzipMiddleware}\n` +
          content.slice(appLineEnd + 1);
      }
    }

    if (!content.includes("from starlette.middleware.gzip import GZipMiddleware")) {
      const lastFromImport = content.lastIndexOf("\nfrom ");
      const lastImport = content.lastIndexOf("\nimport ");
      const insertAfter = Math.max(lastFromImport, lastImport);
      if (insertAfter !== -1) {
        const lineEnd = content.indexOf("\n", insertAfter + 1);
        content = content.slice(0, lineEnd + 1) + gzipImport + content.slice(lineEnd + 1);
      } else {
        content = gzipImport + content;
      }
    }

    fixes.push(`[${file.path}] Injected GZipMiddleware (minimum_size=500) for automatic response compression`);
    return { path: file.path, content };
  });

  return { files: result, fixes };
}

function fixFastAPIPerformanceConstants(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const hasPerfFile = files.some(
    f => f.path === "perf_config.py" && f.content.includes("PERF_LIMITS"),
  );
  if (hasPerfFile) return { files, fixes };

  const hasMainPy = files.some(f => f.path === "main.py");
  if (!hasMainPy) return { files, fixes };

  const PERF_MODULE = `"""Performance configuration constants for FastAPI backend."""

PERF_LIMITS = {
    "DEFAULT_PAGE_LIMIT": 100,
    "MAX_PAGE_LIMIT": 1000,
    "DEFAULT_OFFSET": 0,
    "GZIP_MINIMUM_SIZE": 500,
    "MAX_RESPONSE_SIZE_MB": 10,
    "QUERY_TIMEOUT_SECONDS": 30,
    "MAX_EAGER_LOAD_DEPTH": 2,
    "CONNECTION_POOL_SIZE": 5,
    "CONNECTION_POOL_OVERFLOW": 10,
}

PERF_HINTS = {
    "USE_PAGINATION": "All list endpoints must include limit/offset parameters",
    "USE_EAGER_LOADING": "Use selectinload() for relationship access to prevent N+1 queries",
    "USE_COMPRESSION": "GZipMiddleware compresses responses > 500 bytes automatically",
    "USE_CONNECTION_POOL": "Configure pool_size and max_overflow for production workloads",
    "USE_ASYNC": "All route handlers and DB operations must be async",
}
`;

  const result = [...files, { path: "perf_config.py", content: PERF_MODULE }];
  fixes.push("[perf_config.py] Injected PERF_LIMITS constants (pagination defaults, compression thresholds, connection pool, query timeout)");

  return { files: result, fixes };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
