interface HardenerResult {
  files: Array<{ path: string; content: string }>;
  fixes: string[];
}

function fixExpressV5Params(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes("req.params")) return file;

    let content = file.content;
    let modified = false;

    const destructuredParams = new Set<string>();
    content = content.replace(
      /(?:const|let)\s*\{\s*([^}]+)\}\s*=\s*req\.params\s*;/g,
      (match, destructured: string) => {
        const vars = destructured.split(",").map((v: string) => v.trim()).filter(Boolean);
        for (const v of vars) destructuredParams.add(v);
        const casts = vars.map((v: string) => `const ${v} = req.params.${v} as string;`).join("\n  ");
        modified = true;
        return casts;
      }
    );

    content = content.replace(
      /req\.params\.(\w+)/g,
      (match, param, offset) => {
        const after = content.slice(offset + match.length, offset + match.length + 15);
        if (after.trimStart().startsWith("as ")) return match;
        modified = true;
        return `(req.params.${param} as string)`;
      }
    );

    if (modified) {
      fixes.push(`[${file.path}] Hardened req.params with 'as string' casts (Express v5)`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixDrizzleEnumFiltering(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const enumColumns = new Set<string>();
  for (const file of files) {
    if (!file.path.includes("schema") || !file.path.match(/\.[tj]sx?$/)) continue;
    const enumMatches = file.content.matchAll(/pgEnum\s*\(\s*["'](\w+)["']/g);
    for (const m of enumMatches) {
      enumColumns.add(m[1]);
    }
  }

  if (enumColumns.size === 0) return { files, fixes };

  const updatedFiles = files.map(file => {
    if (!file.path.includes("routes") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes("eq(")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /eq\s*\(\s*(\w+)\.(\w+)\s*,\s*((?:req\.(?:query|body)\.?\w*|(?:parsed|validated|query|body|filter)\w*\.?\w*|\w+Status|\w+Priority|\w+Type))\s*\)/g,
      (match, table, column, value) => {
        if (value.includes(" as ")) return match;
        modified = true;
        return `eq(${table}.${column}, ${value} as any)`;
      }
    );

    if (modified) {
      fixes.push(`[${file.path}] Hardened eq() enum filtering with type casts`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixDrizzleTableFields(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes(".fields")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /(\w+)\.fields\b(?!\s*\()/g,
      (match, tableName) => {
        const tableNames = ["users", "agents", "auditLogs", "metrics", "reviews", "vehicles",
          "drivers", "maintenance", "tasks", "items", "products", "orders", "posts", "comments",
          "categories", "tags", "sessions", "settings", "notifications", "messages", "logs"];
        if (!tableNames.some(t => tableName.includes(t) || tableName === t)) {
          if (!/^[a-z]/.test(tableName)) return match;
        }
        modified = true;
        return `getTableColumns(${tableName})`;
      }
    );

    if (modified && !content.includes("getTableColumns")) {
      content = content.replace(
        /(import\s*\{[^}]*)\}\s*from\s*["']drizzle-orm["']/,
        (match, imports) => {
          if (imports.includes("getTableColumns")) return match;
          return `${imports}, getTableColumns } from "drizzle-orm"`;
        }
      );

      if (!content.includes("getTableColumns")) {
        const firstImport = content.indexOf("import ");
        if (firstImport >= 0) {
          const lineEnd = content.indexOf("\n", firstImport);
          content = content.slice(0, lineEnd + 1) +
            'import { getTableColumns } from "drizzle-orm";\n' +
            content.slice(lineEnd + 1);
        }
      }

      fixes.push(`[${file.path}] Replaced .fields with getTableColumns()`);
      return { path: file.path, content };
    }

    if (modified) {
      fixes.push(`[${file.path}] Replaced .fields with getTableColumns()`);
      return { path: file.path, content };
    }

    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixAdminRouteTypes(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("admin") || !file.path.match(/\.[tj]sx?$/)) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /tables\s*\[\s*req\.params\.(\w+)\s*\]/g,
      (match, param) => {
        modified = true;
        return `tables[req.params.${param} as string]`;
      }
    );

    content = content.replace(
      /(?:const|let)\s+(\w+)\s*=\s*(?:Number|parseInt)\s*\(\s*req\.params\.(\w+)\s*\)/g,
      (match, varName, param) => {
        if (match.includes("as string")) return match;
        modified = true;
        return `const ${varName} = Number(req.params.${param} as string)`;
      }
    );

    if (modified) {
      fixes.push(`[${file.path}] Hardened admin route param types`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixDrizzleInsertSchemaImports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const schemaExports = new Map<string, Set<string>>();
  for (const file of files) {
    if (!file.path.includes("schema") || !file.path.match(/\.[tj]sx?$/)) continue;

    const exportMatches = file.content.matchAll(/export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g);
    const exports = new Set<string>();
    for (const m of exportMatches) {
      exports.add(m[1]);
    }

    const reExportMatches = file.content.matchAll(/export\s*\*\s*from\s*["']\.\/(\w+)["']/g);
    for (const m of reExportMatches) {
      const reExportedFile = files.find(f =>
        f.path.includes(`schema/${m[1]}`) && f.path.match(/\.[tj]sx?$/)
      );
      if (reExportedFile) {
        const reExports = reExportedFile.content.matchAll(/export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g);
        for (const re of reExports) {
          exports.add(re[1]);
        }
      }
    }

    schemaExports.set(file.path, exports);
  }

  const allSchemaSymbols = new Set<string>();
  for (const exports of schemaExports.values()) {
    for (const e of exports) allSchemaSymbols.add(e);
  }

  const updatedFiles = files.map(file => {
    if (!file.path.includes("routes") || !file.path.match(/\.[tj]sx?$/)) return file;

    let content = file.content;
    let modified = false;

    const importPattern = /import\s*\{([^}]+)\}\s*from\s*["']\.\.\/schema["']\s*;?/g;
    content = content.replace(importPattern, (match, imports: string) => {
      const importNames = imports.split(",").map((s: string) => s.trim()).filter(Boolean);
      const valid: string[] = [];
      const invalid: string[] = [];

      for (const name of importNames) {
        const cleanName = name.replace(/\s+as\s+\w+/, "").trim();
        if (allSchemaSymbols.has(cleanName)) {
          valid.push(name);
        } else {
          invalid.push(cleanName);
        }
      }

      if (invalid.length === 0) return match;

      modified = true;
      let result = "";
      if (valid.length > 0) {
        result = `import { ${valid.join(", ")} } from "../schema";`;
      }

      for (const inv of invalid) {
        if (inv.startsWith("insert") && inv.endsWith("Schema")) {
          const tableName = inv.replace(/^insert/, "").replace(/Schema$/, "");
          const tableNameLower = tableName.charAt(0).toLowerCase() + tableName.slice(1);
          const tableNamePlural = allSchemaSymbols.has(tableNameLower + "s") ? tableNameLower + "s" :
            allSchemaSymbols.has(tableNameLower) ? tableNameLower : null;

          if (tableNamePlural) {
            if (!content.includes("createInsertSchema")) {
              result = `import { createInsertSchema } from "drizzle-zod";\n${result}`;
            }
            result += `\nconst ${inv} = createInsertSchema(${tableNamePlural});`;
          }
        }
      }

      return result;
    });

    if (modified) {
      fixes.push(`[${file.path}] Fixed non-existent schema imports with createInsertSchema`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixServerTsconfig(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (file.path !== "server/tsconfig.json") return file;

    let content = file.content;

    try {
      const config = JSON.parse(content);
      const co = config.compilerOptions || {};
      let modified = false;

      if (co.moduleResolution === "NodeNext" || co.moduleResolution === "Node16" ||
          co.moduleResolution === "nodenext" || co.moduleResolution === "node16") {
        co.moduleResolution = "bundler";
        modified = true;
      }

      if (co.module === "NodeNext" || co.module === "Node16" ||
          co.module === "nodenext" || co.module === "node16") {
        co.module = "ES2022";
        modified = true;
      }

      if (modified) {
        config.compilerOptions = co;
        fixes.push(`[${file.path}] Changed moduleResolution to 'bundler' (avoids .js extension requirement)`);
        return { path: file.path, content: JSON.stringify(config, null, 2) + "\n" };
      }
    } catch {}

    return file;
  });

  return { files: updatedFiles, fixes };
}

const COMMON_TYPES_MAP: Record<string, string> = {
  "express": "@types/express",
  "cors": "@types/cors",
  "cookie-parser": "@types/cookie-parser",
  "bcryptjs": "@types/bcryptjs",
  "jsonwebtoken": "@types/jsonwebtoken",
  "morgan": "@types/morgan",
  "compression": "@types/compression",
  "multer": "@types/multer",
  "uuid": "@types/uuid",
  "node-cron": "@types/node-cron",
  "pg": "@types/pg",
  "better-sqlite3": "@types/better-sqlite3",
};

function fixMissingTypeDeclarations(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (file.path !== "server/package.json") return file;

    try {
      const pkg = JSON.parse(file.content);
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      let modified = false;

      for (const [pkgName, typePkg] of Object.entries(COMMON_TYPES_MAP)) {
        if (deps[pkgName] && !deps[typePkg] && !devDeps[typePkg]) {
          if (!pkg.devDependencies) pkg.devDependencies = {};
          pkg.devDependencies[typePkg] = "*";
          modified = true;
          fixes.push(`[${file.path}] Injected missing ${typePkg}`);
        }
      }

      if (!deps["@types/node"] && !devDeps["@types/node"]) {
        if (!pkg.devDependencies) pkg.devDependencies = {};
        pkg.devDependencies["@types/node"] = "^20.0.0";
        modified = true;
        fixes.push(`[${file.path}] Injected missing @types/node`);
      }

      if (modified) {
        return { path: file.path, content: JSON.stringify(pkg, null, 2) + "\n" };
      }
    } catch {}

    return file;
  });

  return { files: updatedFiles, fixes };
}

export function hardenGeneratedTypes(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const allFixes: string[] = [];
  let currentFiles = files;

  const tsconfigFix = fixServerTsconfig(currentFiles);
  currentFiles = tsconfigFix.files;
  allFixes.push(...tsconfigFix.fixes);

  const typesFix = fixMissingTypeDeclarations(currentFiles);
  currentFiles = typesFix.files;
  allFixes.push(...typesFix.fixes);

  const schemaFix = fixDrizzleInsertSchemaImports(currentFiles);
  currentFiles = schemaFix.files;
  allFixes.push(...schemaFix.fixes);

  const paramsFix = fixExpressV5Params(currentFiles);
  currentFiles = paramsFix.files;
  allFixes.push(...paramsFix.fixes);

  const enumFix = fixDrizzleEnumFiltering(currentFiles);
  currentFiles = enumFix.files;
  allFixes.push(...enumFix.fixes);

  const fieldsFix = fixDrizzleTableFields(currentFiles);
  currentFiles = fieldsFix.files;
  allFixes.push(...fieldsFix.fixes);

  const adminFix = fixAdminRouteTypes(currentFiles);
  currentFiles = adminFix.files;
  allFixes.push(...adminFix.fixes);

  return { files: currentFiles, fixes: allFixes };
}
