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
