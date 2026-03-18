interface SandpackFile {
  code: string;
}

interface ExtractedContext {
  crashFile: { path: string; content: string } | null;
  dependencyFiles: Array<{ path: string; content: string }>;
  typeFiles: Array<{ path: string; content: string }>;
}

const FILE_REF_PATTERNS = [
  /at\s+\S+\s+\(([^:)]+):\d+:\d+\)/g,
  /(?:in|at)\s+([^\s:]+\.[tj]sx?)(?::\d+)?/g,
  /\.\/([^\s:'"]+\.[tj]sx?)/g,
  /["']([^"']+\.[tj]sx?)["']/g,
];

const IMPORT_PATTERN = /import\s+(?:[\s\S]*?from\s+)?["']([^"']+)["']/g;

const MAX_DEPENDENCY_FILES = 5;
const MAX_TYPE_FILES = 2;
const MAX_TOTAL_FILES = 8;
const MAX_TOTAL_CHARS = 30000;

function normalizeSandpackPath(path: string): string {
  let p = path;
  if (!p.startsWith("/")) p = `/${p}`;
  return p;
}

function extractFileFromError(errorMessage: string, errorPath?: string): string | null {
  if (errorPath) return normalizeSandpackPath(errorPath);

  const allRefs: string[] = [];
  for (const pattern of FILE_REF_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(errorMessage)) !== null) {
      const ref = match[1];
      if (ref && /\.[tj]sx?$/.test(ref) && !ref.includes("node_modules")) {
        allRefs.push(ref);
      }
    }
  }

  if (allRefs.length > 0) {
    return normalizeSandpackPath(allRefs[0]);
  }

  return null;
}

function resolveImportPath(importPath: string, fromFile: string): string | null {
  if (importPath.startsWith("@/")) {
    return `/${importPath.slice(2)}`;
  }

  if (!importPath.startsWith(".")) return null;

  const fromDir = fromFile.substring(0, fromFile.lastIndexOf("/"));
  const parts = `${fromDir}/${importPath}`.split("/").filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return `/${resolved.join("/")}`;
}

function findFileInMap(
  files: Record<string, SandpackFile>,
  targetPath: string,
): string | null {
  const normalized = normalizeSandpackPath(targetPath);

  if (files[normalized]) return normalized;

  const extensions = [".ts", ".tsx", ".js", ".jsx"];
  const hasExtension = /\.[tj]sx?$/.test(normalized);

  if (!hasExtension) {
    for (const ext of extensions) {
      const withExt = `${normalized}${ext}`;
      if (files[withExt]) return withExt;
    }
    for (const ext of extensions) {
      const indexPath = `${normalized}/index${ext}`;
      if (files[indexPath]) return indexPath;
    }
  }

  return null;
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const regex = new RegExp(IMPORT_PATTERN.source, IMPORT_PATTERN.flags);
  let match;
  while ((match = regex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath && (importPath.startsWith(".") || importPath.startsWith("@/"))) {
      imports.push(importPath);
    }
  }
  return imports;
}

function isTypeFile(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes("/types") ||
    lower.includes("/interfaces") ||
    lower.endsWith(".d.ts")
  );
}

function isTypeScriptError(errorMessage: string): boolean {
  return /TS\d{4}/.test(errorMessage);
}

export function extractErrorContext(
  files: Record<string, SandpackFile>,
  errorMessage: string,
  errorPath?: string,
): { files: Array<{ path: string; content: string }>; crashFilePath: string | null } {
  const result: ExtractedContext = {
    crashFile: null,
    dependencyFiles: [],
    typeFiles: [],
  };

  const crashPath = extractFileFromError(errorMessage, errorPath);
  let resolvedCrashPath: string | null = null;

  if (crashPath) {
    resolvedCrashPath = findFileInMap(files, crashPath);
    if (resolvedCrashPath && files[resolvedCrashPath]) {
      result.crashFile = {
        path: resolvedCrashPath,
        content: files[resolvedCrashPath].code,
      };
    }
  }

  if (result.crashFile) {
    const imports = extractImports(result.crashFile.content);
    const addedPaths = new Set<string>([result.crashFile.path]);

    for (const imp of imports) {
      if (result.dependencyFiles.length >= MAX_DEPENDENCY_FILES) break;

      const resolved = resolveImportPath(imp, result.crashFile.path);
      if (!resolved) continue;

      const found = findFileInMap(files, resolved);
      if (found && !addedPaths.has(found) && files[found]) {
        result.dependencyFiles.push({ path: found, content: files[found].code });
        addedPaths.add(found);
      }
    }

    if (isTypeScriptError(errorMessage)) {
      const allImportedPaths = new Set<string>(addedPaths);
      for (const dep of result.dependencyFiles) {
        const depImports = extractImports(dep.content);
        for (const imp of depImports) {
          const resolved = resolveImportPath(imp, dep.path);
          if (resolved) {
            const found = findFileInMap(files, resolved);
            if (found) allImportedPaths.add(found);
          }
        }
      }

      for (const [filePath, file] of Object.entries(files)) {
        if (result.typeFiles.length >= MAX_TYPE_FILES) break;
        if (addedPaths.has(filePath)) continue;
        if (isTypeFile(filePath) && allImportedPaths.has(filePath)) {
          result.typeFiles.push({ path: filePath, content: file.code });
          addedPaths.add(filePath);
        }
      }
    }
  }

  const allFiles: Array<{ path: string; content: string }> = [];
  if (result.crashFile) allFiles.push(result.crashFile);
  allFiles.push(...result.dependencyFiles);
  allFiles.push(...result.typeFiles);

  let totalChars = 0;
  const budgetedFiles: Array<{ path: string; content: string }> = [];
  for (const f of allFiles) {
    if (budgetedFiles.length >= MAX_TOTAL_FILES) break;
    if (totalChars + f.content.length > MAX_TOTAL_CHARS && budgetedFiles.length > 0) break;
    budgetedFiles.push(f);
    totalChars += f.content.length;
  }

  return { files: budgetedFiles, crashFilePath: resolvedCrashPath };
}
