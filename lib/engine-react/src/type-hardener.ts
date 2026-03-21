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

    content = content.replace(
      /(const\s+\[.*?\]\s*=\s*(?:await\s+)?db\.(?:insert|update|delete)\s*\([^)]*\)[^;]*?\.returning\s*\(\s*\))/g,
      (match) => {
        if (match.includes("as any")) return match;
        modified = true;
        return match + " as any[]";
      }
    );

    content = content.replace(
      /(const\s+\[.*?\]\s*=\s*(?:await\s+)?db\.select\s*\(\s*\)\.from\s*\([^)]*\)[^;]*?)(?=\s*;)/g,
      (match) => {
        if (match.includes("as any")) return match;
        modified = true;
        return match + " as any[]";
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

      const drizzleZodImports = new Set<string>();
      for (const inv of invalid) {
        if (inv.startsWith("insert") && inv.endsWith("Schema")) {
          const tableName = inv.replace(/^insert/, "").replace(/Schema$/, "");
          const tableNameLower = tableName.charAt(0).toLowerCase() + tableName.slice(1);
          const tableNamePlural = allSchemaSymbols.has(tableNameLower + "s") ? tableNameLower + "s" :
            allSchemaSymbols.has(tableNameLower) ? tableNameLower : null;

          if (tableNamePlural) {
            drizzleZodImports.add("createInsertSchema");
            result += `\nconst ${inv} = createInsertSchema(${tableNamePlural});`;
          }
        } else if (inv.startsWith("select") && inv.endsWith("Schema")) {
          const tableName = inv.replace(/^select/, "").replace(/Schema$/, "");
          const tableNameLower = tableName.charAt(0).toLowerCase() + tableName.slice(1);
          const tableNamePlural = allSchemaSymbols.has(tableNameLower + "s") ? tableNameLower + "s" :
            allSchemaSymbols.has(tableNameLower) ? tableNameLower : null;

          if (tableNamePlural) {
            drizzleZodImports.add("createSelectSchema");
            result += `\nconst ${inv} = createSelectSchema(${tableNamePlural});`;
          }
        }
      }

      if (drizzleZodImports.size > 0) {
        const existing = new Set<string>();
        if (content.includes("createInsertSchema")) existing.add("createInsertSchema");
        if (content.includes("createSelectSchema")) existing.add("createSelectSchema");
        const needed = [...drizzleZodImports].filter(i => !existing.has(i));
        if (needed.length > 0) {
          result = `import { ${needed.join(", ")} } from "drizzle-zod";\n${result}`;
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

      const badModRes = new Set(["NodeNext", "Node16", "nodenext", "node16", "Node", "node", "Classic", "classic"]);
      if (badModRes.has(co.moduleResolution)) {
        co.moduleResolution = "bundler";
        modified = true;
      }

      const badMod = new Set(["NodeNext", "Node16", "nodenext", "node16", "CommonJS", "commonjs"]);
      if (badMod.has(co.module)) {
        co.module = "ES2022";
        modified = true;
      }

      if (Array.isArray(co.types)) {
        const validTypeRoots = new Set(["node", "jest", "mocha", "vite/client"]);
        const cleaned = co.types.filter((t: string) => validTypeRoots.has(t) || t.startsWith("@types/"));
        if (cleaned.length !== co.types.length) {
          co.types = cleaned.length > 0 ? cleaned : undefined;
          if (co.types === undefined) delete co.types;
          modified = true;
        }
      }

      if (!co.skipLibCheck) {
        co.skipLibCheck = true;
        modified = true;
      }

      if (co.strict === true) {
        co.strict = false;
        modified = true;
      }

      if (co.noImplicitAny === true) {
        co.noImplicitAny = false;
        modified = true;
      }

      if (modified) {
        config.compilerOptions = co;
        fixes.push(`[${file.path}] Fixed tsconfig compilerOptions (moduleResolution/types cleanup)`);
        return { path: file.path, content: JSON.stringify(config, null, 2) + "\n" };
      }
    } catch {}

    return file;
  });

  return { files: updatedFiles, fixes };
}

const COMMON_TYPES_MAP: Record<string, { pkg: string; version: string }> = {
  "express": { pkg: "@types/express", version: "*" },
  "cors": { pkg: "@types/cors", version: "*" },
  "cookie-parser": { pkg: "@types/cookie-parser", version: "*" },
  
  "jsonwebtoken": { pkg: "@types/jsonwebtoken", version: "^9.0.0" },
  "morgan": { pkg: "@types/morgan", version: "*" },
  "compression": { pkg: "@types/compression", version: "*" },
  "multer": { pkg: "@types/multer", version: "*" },
  "uuid": { pkg: "@types/uuid", version: "*" },
  "node-cron": { pkg: "@types/node-cron", version: "*" },
  "pg": { pkg: "@types/pg", version: "*" },
  "better-sqlite3": { pkg: "@types/better-sqlite3", version: "*" },
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

      for (const [pkgName, typeInfo] of Object.entries(COMMON_TYPES_MAP)) {
        if (deps[pkgName] && !deps[typeInfo.pkg] && !devDeps[typeInfo.pkg]) {
          if (!pkg.devDependencies) pkg.devDependencies = {};
          pkg.devDependencies[typeInfo.pkg] = typeInfo.version;
          modified = true;
          fixes.push(`[${file.path}] Injected missing ${typeInfo.pkg}`);
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

function fixFramerMotionPropSpreads(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("client/") || !file.path.match(/\.[tj]sx$/)) return file;
    if (!file.content.includes("motion.")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /<motion\.(\w+)\s+\{\.\.\.(\w+)\}/g,
      (match, element, propsVar) => {
        modified = true;
        return `<motion.${element} {...(${propsVar} as any)}`;
      }
    );

    content = content.replace(
      /<motion\.(\w+)([^>]*?)\s+\{\.\.\.(\w+)\}/g,
      (match, element, middle, propsVar) => {
        if (match.includes("as any")) return match;
        modified = true;
        return `<motion.${element}${middle} {...(${propsVar} as any)}`;
      }
    );

    if (modified) {
      fixes.push(`[${file.path}] Cast motion component prop spreads to avoid type conflicts`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

interface SchemaMap {
  columns: Record<string, string[]>;
  relations: Record<string, string[]>;
}

function extractBalancedBlock(text: string, startIdx: number): string {
  let depth = 0;
  let i = startIdx;
  while (i < text.length) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(startIdx + 1, i);
    }
    i++;
  }
  return text.slice(startIdx + 1);
}

function buildSchemaMap(
  files: Array<{ path: string; content: string }>,
): SchemaMap {
  const columns: Record<string, string[]> = {};
  const relations: Record<string, string[]> = {};

  for (const file of files) {
    if (!file.path.includes("schema") || !file.path.match(/\.[tj]sx?$/)) continue;

    const tablePattern = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*["'][^"']+["']\s*,\s*\{/g;
    let tableMatch;
    while ((tableMatch = tablePattern.exec(file.content)) !== null) {
      const tableName = tableMatch[1];
      const blockStart = tableMatch.index + tableMatch[0].length - 1;
      const columnsBlock = extractBalancedBlock(file.content, blockStart);
      const colNames = [...columnsBlock.matchAll(/^\s*(\w+)\s*:/gm)].map(c => c[1]);
      if (colNames.length > 0) {
        columns[tableName] = colNames;
      }
    }

    const relPattern = /export\s+const\s+\w+\s*=\s*relations\s*\(\s*(\w+)\s*,/g;
    let relMatch;
    while ((relMatch = relPattern.exec(file.content)) !== null) {
      const tableName = relMatch[1];
      const arrowIdx = file.content.indexOf("=> ({", relMatch.index);
      if (arrowIdx === -1) continue;
      const blockStart = file.content.indexOf("{", arrowIdx + 4);
      if (blockStart === -1) continue;
      const relBlock = extractBalancedBlock(file.content, blockStart);
      const relNames = [...relBlock.matchAll(/^\s*(\w+)\s*:/gm)].map(r => r[1]);
      if (relNames.length > 0) {
        relations[tableName] = relNames;
      }
    }
  }

  return { columns, relations };
}

function findClosestColumn(target: string, available: string[]): string | null {
  const targetLower = target.toLowerCase();

  for (const col of available) {
    if (col.toLowerCase() === targetLower) return col;
  }

  const timeColumns = ["createdAt", "updatedAt", "timestamp", "date"];
  if (targetLower.includes("at") || targetLower.includes("date") || targetLower.includes("time")) {
    for (const tc of timeColumns) {
      if (available.includes(tc)) return tc;
    }
  }

  for (const col of available) {
    if (targetLower.includes(col.toLowerCase()) || col.toLowerCase().includes(targetLower)) {
      return col;
    }
  }

  return null;
}

function fixSchemaColumnMismatches(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];
  const schemaMap = buildSchemaMap(files);

  if (Object.keys(schemaMap.columns).length === 0) {
    return { files, fixes };
  }

  const tableNames = Object.keys(schemaMap.columns);

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (file.path.includes("schema/") || file.path.includes("schema.ts")) return file;

    let content = file.content;
    let modified = false;

    for (const tableName of tableNames) {
      const validCols = schemaMap.columns[tableName];
      const colPattern = new RegExp(
        `(?<![."'\\w])${tableName}\\.(\\w+)`,
        "g",
      );

      content = content.replace(colPattern, (match, colName) => {
        if (validCols.includes(colName)) return match;
        if (colName === "fields" || colName === "_") return match;
        if (/^[A-Z]/.test(colName)) return match;

        const closest = findClosestColumn(colName, validCols);
        if (closest) {
          modified = true;
          return `${tableName}.${closest}`;
        }

        if (validCols.includes("createdAt")) {
          modified = true;
          return `${tableName}.createdAt`;
        }
        if (validCols.includes("id")) {
          modified = true;
          return `${tableName}.id`;
        }

        return match;
      });
    }

    const validRelationNames = new Set<string>();
    for (const rels of Object.values(schemaMap.relations)) {
      for (const r of rels) validRelationNames.add(r);
    }

    if (validRelationNames.size > 0 && content.includes("with:")) {
      const synonyms: Record<string, string[]> = {
        from: ["source", "sender", "origin", "from"],
        to: ["destination", "target", "recipient", "to"],
        source: ["from", "sender", "origin", "source"],
        destination: ["to", "target", "recipient", "destination"],
        sender: ["from", "source", "origin", "sender"],
        recipient: ["to", "destination", "target", "recipient"],
        author: ["user", "creator", "owner", "author"],
        creator: ["user", "author", "owner", "creator"],
        parent: ["parent", "container", "owner"],
        child: ["children", "child", "item"],
      };

      function scoreRelationMatch(invalidKey: string, validRel: string): number {
        const keyLower = invalidKey.toLowerCase();
        const relLower = validRel.toLowerCase();
        if (relLower.includes(keyLower) || keyLower.includes(relLower)) return 10;
        const keyWords = invalidKey.replace(/([A-Z])/g, " $1").toLowerCase().trim().split(/\s+/);
        const relWords = validRel.replace(/([A-Z])/g, " $1").toLowerCase().trim().split(/\s+/);
        let score = 0;
        for (const kw of keyWords) {
          for (const rw of relWords) {
            if (kw === rw) { score += 3; continue; }
            const kwSyns = synonyms[kw] || [];
            if (kwSyns.includes(rw)) { score += 5; continue; }
          }
        }
        return score;
      }

      content = content.replace(
        /with\s*:\s*\{([^}]*)\}/g,
        (match, block: string) => {
          const entries = block.split(",").map((e: string) => e.trim()).filter(Boolean);
          const validEntries: string[] = [];
          let blockModified = false;
          const usedRelations = new Set<string>();

          for (const entry of entries) {
            const keyMatch = entry.match(/^(\w+)\s*:/);
            if (!keyMatch) {
              validEntries.push(entry);
              continue;
            }
            const key = keyMatch[1];
            if (validRelationNames.has(key)) {
              validEntries.push(entry);
              usedRelations.add(key);
              continue;
            }

            let bestMatch: string | null = null;
            let bestScore = 0;
            for (const vr of validRelationNames) {
              if (usedRelations.has(vr)) continue;
              const score = scoreRelationMatch(key, vr);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = vr;
              }
            }

            if (bestMatch && bestScore > 0) {
              const newEntry = entry.replace(key, bestMatch);
              validEntries.push(newEntry);
              usedRelations.add(bestMatch);
              blockModified = true;
            } else {
              blockModified = true;
            }
          }

          if (blockModified) {
            modified = true;
            if (validEntries.length === 0) {
              return "";
            }
            return `with: { ${validEntries.join(", ")} }`;
          }
          return match;
        },
      );
    }

    if (modified) {
      fixes.push(`[${file.path}] Fixed schema column/relation mismatches against actual schema`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixBcryptImports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];
  let hasBcryptUsage = false;

  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;
    if (file.content.includes("from 'bcrypt'") || file.content.includes('from "bcrypt"') ||
        file.content.includes("require('bcrypt')") || file.content.includes('require("bcrypt")')) {
      hasBcryptUsage = true;
      break;
    }
  }

  let hasBcryptjsUsage = false;
  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;
    if (file.content.includes("from 'bcryptjs'") || file.content.includes('from "bcryptjs"') ||
        file.content.includes("require('bcryptjs')") || file.content.includes('require("bcryptjs")')) {
      hasBcryptjsUsage = true;
      break;
    }
  }

  if (!hasBcryptUsage && !hasBcryptjsUsage) return { files, fixes };

  const hasBcryptDts = files.some(f =>
    f.path.includes("bcryptjs.d.ts") || f.path.includes("bcrypt.d.ts")
  );

  let injectedFiles = [...files];
  if (!hasBcryptDts) {
    const dtsPath = "server/src/types/bcryptjs.d.ts";
    const dtsExists = files.some(f => f.path === dtsPath);
    if (!dtsExists) {
      injectedFiles.push({
        path: dtsPath,
        content: `declare module 'bcryptjs' {\n  export function hash(data: string, saltOrRounds: string | number): Promise<string>;\n  export function hashSync(data: string, saltOrRounds: string | number): string;\n  export function compare(data: string, encrypted: string): Promise<boolean>;\n  export function compareSync(data: string, encrypted: string): boolean;\n  export function genSalt(rounds?: number): Promise<string>;\n  export function genSaltSync(rounds?: number): string;\n}\n`,
      });
      fixes.push(`[${dtsPath}] Generated bcryptjs type declarations`);
    }
  }

  const updatedFiles = injectedFiles.map(file => {
    if (file.path === "server/package.json") {
      try {
        const pkg = JSON.parse(file.content);
        const deps = pkg.dependencies || {};
        let pkgModified = false;
        if (deps["bcrypt"] && !deps["bcryptjs"]) {
          deps["bcryptjs"] = deps["bcrypt"];
          delete deps["bcrypt"];
          pkg.dependencies = deps;
          pkgModified = true;
          fixes.push(`[${file.path}] Replaced bcrypt with bcryptjs in dependencies`);
        }
        if (!deps["bcryptjs"]) {
          deps["bcryptjs"] = "^2.4.3";
          pkg.dependencies = deps;
          pkgModified = true;
          fixes.push(`[${file.path}] Added missing bcryptjs dependency`);
        }
        const devDeps = pkg.devDependencies || {};
        if (devDeps["@types/bcryptjs"] || devDeps["@types/bcrypt"]) {
          delete devDeps["@types/bcryptjs"];
          delete devDeps["@types/bcrypt"];
          pkg.devDependencies = devDeps;
          pkgModified = true;
        }
        if (pkgModified) {
          return { path: file.path, content: JSON.stringify(pkg, null, 2) + "\n" };
        }
      } catch {}
      return file;
    }

    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(/from\s+['"]bcrypt['"]/g, (match) => {
      modified = true;
      return match.replace("bcrypt", "bcryptjs");
    });

    content = content.replace(/require\s*\(\s*['"]bcrypt['"]\s*\)/g, (match) => {
      modified = true;
      return match.replace("bcrypt", "bcryptjs");
    });

    if (modified) {
      fixes.push(`[${file.path}] Replaced bcrypt imports with bcryptjs`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixExpressRequestAugmentation(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];
  let hasReqUser = false;
  let hasReqUserId = false;

  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;
    if (file.content.includes("req.user")) hasReqUser = true;
    if (/req\.userId\b/.test(file.content)) hasReqUserId = true;
    if (hasReqUser && hasReqUserId) break;
  }

  if (!hasReqUser && !hasReqUserId) return { files, fixes };

  const hasDeclaration = files.some(f => {
    if (!(f.path.includes("types/") || f.path.includes(".d.ts"))) return false;
    if (!f.content.includes("declare") || !f.content.includes("Request")) return false;
    return /\buser\s*[?:]/i.test(f.content);
  });

  if (hasDeclaration) return { files, fixes };

  const extraProps = ["    user?: any;"];
  if (hasReqUserId) extraProps.push("    userId?: any;");
  const declContent = `import "express";

declare module "express-serve-static-core" {
  interface Request {
${extraProps.join("\n")}
  }
}
`;

  const existingIdx = files.findIndex(f => f.path === "server/src/types/express.d.ts");
  if (existingIdx >= 0) return { files, fixes };

  const updatedFiles = [...files, { path: "server/src/types/express.d.ts", content: declContent }];

  const tsconfigIdx = updatedFiles.findIndex(f => f.path === "server/tsconfig.json");
  if (tsconfigIdx >= 0) {
    try {
      const config = JSON.parse(updatedFiles[tsconfigIdx].content);
      const include = config.include || [];
      if (!include.some((p: string) => p.includes("types"))) {
        include.push("src/types/**/*.d.ts");
        config.include = include;
        updatedFiles[tsconfigIdx] = {
          path: updatedFiles[tsconfigIdx].path,
          content: JSON.stringify(config, null, 2) + "\n",
        };
      }
    } catch {}
  }

  fixes.push("[server/src/types/express.d.ts] Injected Express Request augmentation for req.user");
  return { files: updatedFiles, fixes };
}

function fixToFixedOnStrings(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes(".toFixed(")) return file;

    let content = file.content;
    const toFixedPattern = /(\w+(?:\.\w+)*)\.toFixed\(/g;
    let match;
    let modified = false;
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];

    while ((match = toFixedPattern.exec(content)) !== null) {
      const expr = match[1];
      const fullMatch = match[0];
      const start = match.index;
      const end = start + fullMatch.length;

      if (expr === "Number" || expr === "parseFloat" || expr === "parseInt") continue;
      if (content.substring(Math.max(0, start - 8), start).includes("Number(")) continue;

      replacements.push({
        start,
        end,
        replacement: `Number(${expr}).toFixed(`,
      });
      modified = true;
    }

    if (!modified) return file;

    for (let i = replacements.length - 1; i >= 0; i--) {
      const r = replacements[i];
      content = content.substring(0, r.start) + r.replacement + content.substring(r.end);
    }

    fixes.push(`[${file.path}] Wrapped .toFixed() calls with Number() for type safety`);
    return { path: file.path, content };
  });

  return { files: updatedFiles, fixes };
}

function fixDtsModuleExports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const dtsFiles = new Map<string, number>();
  files.forEach((f, idx) => {
    if (f.path.includes("server/") && f.path.endsWith(".d.ts") && !f.path.includes("express.d.ts")) {
      dtsFiles.set(f.path, idx);
    }
  });

  if (dtsFiles.size === 0) return { files, fixes };

  let hasImportFromDts = false;
  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;
    for (const dtsPath of dtsFiles.keys()) {
      const baseName = dtsPath.replace(/\.d\.ts$/, "").split("/").pop();
      if (file.content.includes(`from './${baseName}'`) ||
          file.content.includes(`from "./${baseName}"`) ||
          file.content.includes(`from '../${baseName}'`) ||
          file.content.includes(`from "./${baseName}.d"`) ||
          file.content.includes(`from './${baseName}.d'`)) {
        hasImportFromDts = true;
        break;
      }
    }
    if (hasImportFromDts) break;
  }

  if (!hasImportFromDts) return { files, fixes };

  const updatedFiles = files.map((file, idx) => {
    if (!dtsFiles.has(file.path)) return file;

    if (file.content.includes("export ")) return file;

    let content = file.content;
    content = content.replace(/^declare\s+(interface|type|enum|const|function)\s+/gm, "export $1 ");
    if (content === file.content) return file;

    fixes.push(`[${file.path}] Converted ambient declarations to exported declarations`);
    return { path: file.path, content };
  });

  return { files: updatedFiles, fixes };
}

function fixMissingBarrelExports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const directories = new Map<string, string[]>();
  for (const file of files) {
    if (!file.path.includes("server/src/")) continue;
    const parts = file.path.split("/");
    if (parts.length < 4) continue;
    const dir = parts.slice(0, -1).join("/");
    if (!directories.has(dir)) directories.set(dir, []);
    directories.get(dir)!.push(file.path);
  }

  const missingBarrels: Array<{ dir: string; indexPath: string; files: string[] }> = [];

  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;

    const importPattern = /from\s+['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(file.content)) !== null) {
      const importPath = match[1];
      const fileDir = file.path.split("/").slice(0, -1).join("/");
      const resolvedParts = [...fileDir.split("/")];

      for (const segment of importPath.split("/")) {
        if (segment === ".") continue;
        if (segment === "..") resolvedParts.pop();
        else resolvedParts.push(segment);
      }

      const resolvedDir = resolvedParts.join("/");
      const resolvedIndex = resolvedDir + "/index.ts";

      if (directories.has(resolvedDir) &&
          !files.some(f => f.path === resolvedIndex || f.path === resolvedDir + "/index.tsx" || f.path === resolvedDir + ".ts") &&
          !missingBarrels.some(b => b.dir === resolvedDir)) {
        missingBarrels.push({
          dir: resolvedDir,
          indexPath: resolvedIndex,
          files: directories.get(resolvedDir)!,
        });
      }
    }
  }

  if (missingBarrels.length === 0) return { files, fixes };

  const updatedFiles = [...files];

  for (const barrel of missingBarrels) {
    const exports: string[] = [];
    for (const filePath of barrel.files) {
      const fileName = filePath.split("/").pop()!.replace(/\.[tj]sx?$/, "");
      if (fileName === "index") continue;
      exports.push(`export * from './${fileName}';`);
    }

    if (exports.length === 0) continue;

    updatedFiles.push({
      path: barrel.indexPath,
      content: exports.join("\n") + "\n",
    });
    fixes.push(`[${barrel.indexPath}] Generated barrel export for ${barrel.files.length} modules`);
  }

  return { files: updatedFiles, fixes };
}

const DRIZZLE_PG_CORE_EXPORTS = new Set([
  "pgTable", "pgEnum", "serial", "integer", "bigint", "smallint",
  "varchar", "char", "text", "boolean", "timestamp", "date", "time",
  "numeric", "real", "doublePrecision", "json", "jsonb", "uuid",
  "primaryKey", "foreignKey", "index", "uniqueIndex", "unique",
  "decimal", "inet", "cidr", "macaddr", "interval",
]);

function fixMissingDrizzleColumnImports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.endsWith(".ts")) return file;
    if (!file.path.includes("schema")) return file;

    const importMatch = file.content.match(
      /import\s*\{([^}]+)\}\s*from\s*['"]drizzle-orm\/pg-core['"]/
    );

    if (!importMatch) return file;

    const currentImports = new Set(
      importMatch[1].split(",").map(s => s.trim()).filter(Boolean)
    );

    const usedTypes = new Set<string>();
    for (const exportName of DRIZZLE_PG_CORE_EXPORTS) {
      const usagePattern = new RegExp(`(?<!\\.)\\b${exportName}\\s*\\(`, "g");
      if (usagePattern.test(file.content)) {
        usedTypes.add(exportName);
      }
    }

    const missing = [...usedTypes].filter(t => !currentImports.has(t));
    if (missing.length === 0) return file;

    const allImports = [...currentImports, ...missing].sort();
    const newImportLine = `import { ${allImports.join(", ")} } from 'drizzle-orm/pg-core'`;
    const content = file.content.replace(
      /import\s*\{[^}]+\}\s*from\s*['"]drizzle-orm\/pg-core['"]/,
      newImportLine
    );

    fixes.push(`[${file.path}] Added missing drizzle-orm/pg-core imports: ${missing.join(", ")}`);
    return { path: file.path, content };
  });

  return { files: updatedFiles, fixes };
}

function fixMissingNamedExports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const importRequests: Array<{
    importerPath: string;
    targetPath: string;
    names: string[];
  }> = [];

  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;

    const importPattern = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(file.content)) !== null) {
      const names = match[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      const importPath = match[2];
      const fileDir = file.path.split("/").slice(0, -1).join("/");
      const resolvedParts = [...fileDir.split("/")];

      for (const segment of importPath.split("/")) {
        if (segment === ".") continue;
        if (segment === "..") resolvedParts.pop();
        else resolvedParts.push(segment);
      }

      const resolved = resolvedParts.join("/");
      const candidates = [
        resolved + ".ts", resolved + ".tsx",
        resolved + "/index.ts", resolved + "/index.tsx",
      ];

      const targetFile = files.find(f => candidates.includes(f.path));
      if (targetFile) {
        importRequests.push({
          importerPath: file.path,
          targetPath: targetFile.path,
          names,
        });
      }
    }
  }

  if (importRequests.length === 0) return { files, fixes };

  const targetFixes = new Map<string, Set<string>>();

  for (const req of importRequests) {
    const targetFile = files.find(f => f.path === req.targetPath);
    if (!targetFile) continue;

    for (const name of req.names) {
      const exportedPattern = new RegExp(`export\\s+(?:const|let|var|function|class|interface|type|enum)\\s+${name}\\b`);
      const reExportPattern = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);

      if (exportedPattern.test(targetFile.content) || reExportPattern.test(targetFile.content)) continue;

      const declPatterns = [
        new RegExp(`^(\\s*)(interface|type|enum|class|function|const|let|var)\\s+${name}\\b`, "m"),
      ];

      let hasDeclaration = false;
      for (const dp of declPatterns) {
        if (dp.test(targetFile.content)) {
          hasDeclaration = true;
          break;
        }
      }

      if (hasDeclaration) {
        if (!targetFixes.has(req.targetPath)) targetFixes.set(req.targetPath, new Set());
        targetFixes.get(req.targetPath)!.add(name);
      }
    }
  }

  if (targetFixes.size === 0) return { files, fixes };

  const updatedFiles = files.map(file => {
    const namesToExport = targetFixes.get(file.path);
    if (!namesToExport) return file;

    let content = file.content;
    for (const name of namesToExport) {
      const pattern = new RegExp(`^(\\s*)(interface|type|enum|class|function|const|let|var)\\s+(${name})\\b`, "gm");
      content = content.replace(pattern, "$1export $2 $3");
    }

    if (content === file.content) return file;

    fixes.push(`[${file.path}] Added missing exports: ${[...namesToExport].join(", ")}`);
    return { path: file.path, content };
  });

  return { files: updatedFiles, fixes };
}

function fixMissingTypeStubs(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const typeImports = new Map<string, Set<string>>();

  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;

    const importPattern = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(file.content)) !== null) {
      const names = match[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      const importPath = match[2];
      const fileDir = file.path.split("/").slice(0, -1).join("/");
      const resolvedParts = [...fileDir.split("/")];

      for (const segment of importPath.split("/")) {
        if (segment === ".") continue;
        if (segment === "..") resolvedParts.pop();
        else resolvedParts.push(segment);
      }

      const resolved = resolvedParts.join("/");
      const candidates = [
        resolved + ".ts", resolved + ".tsx",
        resolved + "/index.ts", resolved + "/index.tsx",
      ];

      const targetFile = files.find(f => candidates.includes(f.path));
      if (!targetFile) continue;

      for (const name of names) {
        if (/^[A-Z]/.test(name) || /[Ss]chema|[Vv]alidator/.test(name)) {
          const exportCheck = new RegExp(`(?:export\\s+)?(?:interface|type|enum|class|const|let|var|function)\\s+${name}\\b`);
          if (!exportCheck.test(targetFile.content)) {
            const reExportMatches = targetFile.content.matchAll(/export\s*\*\s*from\s*['"](\.[^'"]+)['"]/g);
            let providedByReExport = false;
            for (const rem of reExportMatches) {
              const reExportPath = rem[1];
              const targetDir = targetFile.path.split("/").slice(0, -1).join("/");
              const reResolvedParts = [...targetDir.split("/")];
              for (const seg of reExportPath.split("/")) {
                if (seg === ".") continue;
                if (seg === "..") reResolvedParts.pop();
                else reResolvedParts.push(seg);
              }
              const reResolved = reResolvedParts.join("/");
              const reCandidates = [reResolved + ".ts", reResolved + "/index.ts", reResolved + ".tsx"];
              const reExportedFile = files.find(f => reCandidates.includes(f.path));
              if (reExportedFile) {
                const reCheck = new RegExp(`(?:export\\s+)?(?:interface|type|enum|class|const|let|var|function)\\s+${name}\\b`);
                if (reCheck.test(reExportedFile.content)) {
                  providedByReExport = true;
                  break;
                }
              }
            }
            if (providedByReExport) continue;
            if (!typeImports.has(targetFile.path)) typeImports.set(targetFile.path, new Set());
            typeImports.get(targetFile.path)!.add(name);
          }
        }
      }
    }
  }

  if (typeImports.size === 0) return { files, fixes };

  const updatedFiles = files.map(file => {
    const missingTypes = typeImports.get(file.path);
    if (!missingTypes) return file;

    const stubs: string[] = [];
    for (const name of missingTypes) {
      const alreadyImported = new RegExp(`import\\s+[^;]*\\b${name}\\b[^;]*from\\s+['"]`).test(file.content);
      const alreadyDeclared = new RegExp(`(?:export\\s+)?(?:const|let|var|type|interface|enum|class|function)\\s+${name}\\b`).test(file.content);
      if (alreadyImported || alreadyDeclared) continue;
      if (/Schema$/.test(name)) {
        stubs.push(`export const ${name} = {} as any;`);
      } else if (/Input$|Output$|Params$|Response$|Request$|Data$|Config$|Options$|Props$/.test(name)) {
        stubs.push(`export type ${name} = any;`);
      } else {
        stubs.push(`export interface ${name} { [key: string]: unknown; }`);
      }
    }

    if (stubs.length === 0) return file;
    const content = file.content + "\n\n" + stubs.join("\n") + "\n";
    fixes.push(`[${file.path}] Generated stub types: ${stubs.map(s => s.match(/(?:const|type|interface)\s+(\w+)/)?.[1]).filter(Boolean).join(", ")}`);
    return { path: file.path, content };
  });

  return { files: updatedFiles, fixes };
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const FUNCTION_SYNONYMS: Record<string, string[]> = {
  "validateRequest": ["validate", "validateBody", "validateInput", "validateSchema", "validateData", "validatePayload"],
  "validate": ["validateRequest", "validateBody", "validateInput", "validateSchema"],
  "protect": ["authenticate", "requireAuth", "authMiddleware", "ensureAuth", "isAuthenticated", "authGuard", "requireLogin"],
  "authenticate": ["protect", "requireAuth", "authMiddleware", "ensureAuth", "isAuthenticated", "authGuard"],
  "requireAuth": ["protect", "authenticate", "authMiddleware", "ensureAuth", "isAuthenticated"],
  "authMiddleware": ["protect", "authenticate", "requireAuth", "ensureAuth"],
  "isAuthenticated": ["protect", "authenticate", "requireAuth", "authMiddleware"],
  "requireAdmin": ["isAdmin", "adminOnly", "adminGuard", "checkAdmin", "ensureAdmin", "requireRole"],
  "isAdmin": ["requireAdmin", "adminOnly", "adminGuard", "checkAdmin"],
  "errorHandler": ["handleError", "globalErrorHandler", "errorMiddleware", "handleErrors"],
  "handleError": ["errorHandler", "globalErrorHandler", "errorMiddleware"],
  "notFound": ["notFoundHandler", "handleNotFound", "handle404"],
};

function resolveImportPath(
  importPath: string,
  importerPath: string,
): string {
  const fileDir = importerPath.split("/").slice(0, -1).join("/");
  const resolvedParts = [...fileDir.split("/")];
  for (const segment of importPath.split("/")) {
    if (segment === ".") continue;
    if (segment === "..") resolvedParts.pop();
    else resolvedParts.push(segment);
  }
  return resolvedParts.join("/");
}

function findTargetFile(
  resolved: string,
  files: Array<{ path: string; content: string }>,
): { path: string; content: string } | undefined {
  const candidates = [
    resolved + ".ts", resolved + ".tsx",
    resolved + "/index.ts", resolved + "/index.tsx",
  ];
  return files.find(f => candidates.includes(f.path));
}

function extractExportedNames(content: string): Set<string> {
  const exports = new Set<string>();

  const declPattern = /export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum|async\s+function)\s+(\w+)/g;
  let m;
  while ((m = declPattern.exec(content)) !== null) {
    exports.add(m[1]);
  }

  const reExportPattern = /export\s*\{([^}]+)\}/g;
  while ((m = reExportPattern.exec(content)) !== null) {
    const names = m[1].split(",").map(s => {
      const parts = s.trim().split(/\s+as\s+/);
      return parts[parts.length - 1].trim();
    }).filter(Boolean);
    names.forEach(n => exports.add(n));
  }

  const starPattern = /export\s*\*\s*from/g;
  if (starPattern.test(content)) {
    exports.add("__star_reexport__");
  }

  return exports;
}

function findBestMatch(wanted: string, available: Set<string>): string | null {
  if (available.has(wanted)) return null;

  const synonyms = FUNCTION_SYNONYMS[wanted] || [];
  for (const syn of synonyms) {
    if (available.has(syn)) return syn;
  }

  const wantedLower = wanted.toLowerCase();
  for (const exp of available) {
    if (exp === "__star_reexport__") continue;
    if (exp.toLowerCase() === wantedLower) return exp;
  }

  let bestMatch: string | null = null;
  let bestDist = Infinity;
  const maxDist = Math.max(2, Math.floor(wanted.length * 0.4));

  for (const exp of available) {
    if (exp === "__star_reexport__") continue;
    const dist = levenshtein(wanted.toLowerCase(), exp.toLowerCase());
    if (dist < bestDist && dist <= maxDist) {
      bestDist = dist;
      bestMatch = exp;
    }
  }

  return bestMatch;
}

function fixSignatureMap(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const exportMap = new Map<string, Set<string>>();
  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;
    exportMap.set(file.path, extractExportedNames(file.content));
  }

  const rewrites = new Map<string, Array<{ original: string; replacement: string }>>();

  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;

    const importPattern = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(file.content)) !== null) {
      const importedNames = match[1].split(",").map(s => s.trim()).filter(Boolean);
      const importPath = match[2];
      const resolved = resolveImportPath(importPath, file.path);
      const target = findTargetFile(resolved, files);

      if (!target) continue;

      const targetExports = exportMap.get(target.path);
      if (!targetExports || targetExports.has("__star_reexport__")) continue;

      const nameRewrites: Array<{ from: string; to: string }> = [];

      for (const rawName of importedNames) {
        const name = rawName.split(/\s+as\s+/)[0].trim();
        if (targetExports.has(name)) continue;

        const best = findBestMatch(name, targetExports);
        if (best) {
          nameRewrites.push({ from: name, to: best });
        }
      }

      if (nameRewrites.length > 0) {
        if (!rewrites.has(file.path)) rewrites.set(file.path, []);

        for (const rw of nameRewrites) {
          rewrites.get(file.path)!.push({
            original: rw.from,
            replacement: rw.to,
          });
        }
      }
    }
  }

  if (rewrites.size === 0) return { files, fixes };

  const updatedFiles = files.map(file => {
    const fileRewrites = rewrites.get(file.path);
    if (!fileRewrites) return file;

    let content = file.content;
    for (const rw of fileRewrites) {
      const importNamePattern = new RegExp(
        `(import\\s*\\{[^}]*?)\\b${rw.original}\\b([^}]*\\}\\s*from)`,
        "g"
      );
      content = content.replace(importNamePattern, `$1${rw.replacement}$2`);

      const usagePattern = new RegExp(`\\b${rw.original}\\b`, "g");
      const importSectionEnd = content.lastIndexOf("from ");
      if (importSectionEnd > 0) {
        const afterImports = content.substring(importSectionEnd);
        const restStart = content.indexOf("\n", importSectionEnd);
        if (restStart > 0) {
          const before = content.substring(0, restStart);
          const rest = content.substring(restStart);
          content = before + rest.replace(usagePattern, rw.replacement);
        }
      }
    }

    if (content === file.content) return file;

    const names = fileRewrites.map(r => `${r.original}→${r.replacement}`).join(", ");
    fixes.push(`[${file.path}] Signature Map: rewired imports {${names}}`);
    return { path: file.path, content };
  });

  return { files: updatedFiles, fixes };
}

const SECRET_VAR_PATTERN = /(?:(?:const|let|var)\s+)?(\w*(?:SECRET|PASSWORD|API_KEY|APIKEY|TOKEN|PRIVATE_KEY|DB_PASS)\w*)\s*[:=]\s*["']([A-Za-z0-9+/=!@#$%^&*]{8,})["']/gi;

const SECRET_ENV_NAMES: Record<string, string> = {
  jwt_secret: "JWT_SECRET",
  jwtsecret: "JWT_SECRET",
  secret: "JWT_SECRET",
  secret_key: "SECRET_KEY",
  secretkey: "SECRET_KEY",
  api_key: "API_KEY",
  apikey: "API_KEY",
  token: "AUTH_TOKEN",
  auth_token: "AUTH_TOKEN",
  password: "DB_PASSWORD",
  db_password: "DB_PASSWORD",
  db_pass: "DB_PASSWORD",
  private_key: "PRIVATE_KEY",
  session_secret: "SESSION_SECRET",
  sessionsecret: "SESSION_SECRET",
  cookie_secret: "COOKIE_SECRET",
  cookiesecret: "COOKIE_SECRET",
  access_token_secret: "ACCESS_TOKEN_SECRET",
  refresh_token_secret: "REFRESH_TOKEN_SECRET",
};

function splitCamelWords(name: string): string[] {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/\s+/);
}

function scoreRefinementKeyMatch(key: string, col: string): number {
  const keyWords = splitCamelWords(key);
  const colWords = splitCamelWords(col);

  const synonyms: Record<string, string[]> = {
    from: ["source", "sender", "origin"],
    to: ["destination", "target", "recipient", "dest"],
    source: ["from", "sender", "origin"],
    destination: ["to", "target", "recipient", "dest"],
    user: ["customer", "account", "member", "person", "owner", "author"],
    customer: ["user", "account", "member", "person", "client"],
    order: ["purchase", "transaction"],
    date: ["at", "time", "timestamp"],
    name: ["title", "label"],
  };

  let score = 0;
  for (const kw of keyWords) {
    for (const cw of colWords) {
      if (kw === cw) {
        score += (kw === "id" ? 1 : 3);
        continue;
      }
      const kwSyns = synonyms[kw] || [];
      if (kwSyns.includes(cw)) {
        score += 4;
      }
    }
  }
  return score;
}

function findBestRefinementColumn(key: string, available: string[], used: Set<string>): string | null {
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const col of available) {
    if (used.has(col)) continue;
    const score = scoreRefinementKeyMatch(key, col);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = col;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

function fixDrizzleZodRefinementKeys(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];
  const schemaMap = buildSchemaMap(files);

  if (Object.keys(schemaMap.columns).length === 0) {
    return { files, fixes };
  }

  const tableVarToColumns = new Map<string, string[]>();
  for (const [tableName, cols] of Object.entries(schemaMap.columns)) {
    tableVarToColumns.set(tableName, cols);
  }

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (file.path.includes("schema/") || file.path.includes("schema.ts")) return file;
    if (!file.content.includes("createInsertSchema") && !file.content.includes("createSelectSchema")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /(create(?:Insert|Select)Schema)\s*\(\s*(\w+)\s*,\s*\{([^}]*)\}\s*\)/g,
      (match, fnName, tableVar, refinementBlock) => {
        const cols = tableVarToColumns.get(tableVar);
        if (!cols) return match;

        const entries = refinementBlock.split(",").map((e: string) => e.trim()).filter(Boolean);
        const newEntries: string[] = [];
        let blockModified = false;
        const usedCols = new Set<string>();

        for (const entry of entries) {
          const keyMatch = entry.match(/^(\w+)\s*:/);
          if (!keyMatch) {
            newEntries.push(entry);
            continue;
          }
          const key = keyMatch[1];

          if (cols.includes(key)) {
            newEntries.push(entry);
            usedCols.add(key);
            continue;
          }

          const best = findBestRefinementColumn(key, cols, usedCols);
          if (best) {
            const newEntry = entry.replace(new RegExp(`^${key}`), best);
            newEntries.push(newEntry);
            usedCols.add(best);
            blockModified = true;
          } else {
            newEntries.push(entry);
          }
        }

        if (blockModified) {
          modified = true;
          return `${fnName}(${tableVar}, {\n    ${newEntries.join(",\n    ")}\n})`;
        }
        return match;
      }
    );

    if (modified) {
      fixes.push(`[${file.path}] Fixed drizzle-zod refinement keys to match actual schema columns`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixDrizzleExecuteDestructuring(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes("db.execute") && !file.content.includes("db.select")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /const\s+(\[.*?\])\s*=\s*(await\s+)?db\.execute\s*\(/g,
      (match, destructure, awaitKw) => {
        modified = true;
        if (awaitKw) {
          return `const ${destructure} = (await db.execute(`;
        }
        return `const ${destructure} = (db.execute(`;
      }
    );

    if (modified) {
      content = content.replace(
        /\((?:await\s+)?db\.execute\s*\(([^;]*?)\)(?!\.rows)/g,
        (match, inner) => {
          return match + ".rows";
        }
      );
    }

    if (content.includes("db.select")) {
      const lines = content.split("\n");
      const rebuiltLines: string[] = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (/(?:const|let)\s+\[.*?\]\s*=\s*(?:await\s+)?db\.select\s*\(/.test(line) && !line.includes("as any")) {
          let fullStmt = line;
          let j = i + 1;
          while (j < lines.length && !fullStmt.includes(";")) {
            fullStmt += "\n" + lines[j];
            j++;
          }
          if (fullStmt.includes(";") && !fullStmt.includes("as any;")) {
            fullStmt = fullStmt.replace(/;(\s*)$/, " as any;$1");
            modified = true;
          }
          rebuiltLines.push(fullStmt);
          i = j;
          continue;
        }
        rebuiltLines.push(line);
        i++;
      }
      if (modified) {
        content = rebuiltLines.join("\n");
      }
    }

    if (content.includes("db.select")) {
      content = content.replace(
        /((?:const|let)\s+\w+)\s*=\s*((?:await\s+)?db\.select\s*\([^;]*);/g,
        (match, prefix, dbCall) => {
          if (match.includes("as any") || match.includes("as ")) return match;
          if (/\[\s*\w/.test(prefix)) return match;
          modified = true;
          return `${prefix} = (${dbCall}) as any[];`;
        }
      );
    }

    if (content.includes("db.select") || content.includes("db.execute")) {
      content = content.replace(
        /for\s*\(\s*(?:const|let)\s+(\w+)\s+of\s+((?:await\s+)?db\.(?:select|execute)\s*\([^)]*\)(?:\.[^;{]*?))\s*\)/g,
        (match, varName, dbCall) => {
          if (match.includes("as any")) return match;
          modified = true;
          return `for (const ${varName} of (${dbCall}) as any[])`;
        }
      );
    }

    if (modified) {
      fixes.push(`[${file.path}] Fixed db.execute()/db.select() destructuring`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixSchemaBarrelExports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.match(/server\/src\/schema\/index\.[tj]s$/)) return file;

    let content = file.content;

    const hasWrappedExport = /export\s+const\s+schema\s*=\s*\{/.test(content);
    if (!hasWrappedExport) return file;

    const importPattern = /import\s+\*\s+as\s+(\w+)\s+from\s+['"](\.\/\w+)['"]/g;
    const moduleImports: Array<{ alias: string; path: string }> = [];
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      moduleImports.push({ alias: match[1], path: match[2] });
    }

    if (moduleImports.length === 0) return file;

    const reExports = moduleImports.map(m => `export * from '${m.path}';`).join("\n");
    content = reExports + "\n";

    fixes.push(`[${file.path}] Rewrote schema barrel from wrapped object to re-exports for db.query compatibility`);
    return { path: file.path, content };
  });

  return { files: updatedFiles, fixes };
}

function fixValidateRequestSchema(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes("validateRequest")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /validateRequest\s*\(\s*\{(\s*(?:params|body|query)\s*:)/g,
      (match, firstKey) => {
        modified = true;
        return `validateRequest(z.object({${firstKey}`;
      }
    );

    if (modified) {
      let depth = 0;
      let i = 0;
      const result: string[] = [];
      while (i < content.length) {
        if (content.startsWith("validateRequest(z.object({", i)) {
          result.push("validateRequest(z.object({");
          i += "validateRequest(z.object({".length;
          depth = 1;
          while (i < content.length && depth > 0) {
            if (content[i] === "{") depth++;
            else if (content[i] === "}") depth--;
            if (depth === 0) {
              result.push("})");
              i++;
              break;
            }
            result.push(content[i]);
            i++;
          }
        } else {
          result.push(content[i]);
          i++;
        }
      }
      content = result.join("");
    }

    if (modified) {
      if (!content.includes("import { z") && !content.includes("import {z") && !content.includes("from 'zod'")) {
        content = `import { z } from 'zod';\n` + content;
      }
      fixes.push(`[${file.path}] Wrapped validateRequest plain object in z.object()`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixDrizzleZodRefinementCallbacks(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes("createInsertSchema") && !file.content.includes("createSelectSchema")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /\(\s*(\w+)\s*\)\s*=>\s*\1\.(\w+)\./g,
      (match, param, prop) => {
        modified = true;
        return `(${param}: any) => ${param}.`;
      }
    );

    content = content.replace(
      /\(\s*(\w+)\s*\)\s*=>\s*\1\.\w+\s*\(/g,
      (match, param) => {
        if (match.includes(": any")) return match;
        modified = true;
        return match.replace(`(${param})`, `(${param}: any)`);
      }
    );

    const createSchemaPattern = /(createInsertSchema|createSelectSchema)\s*\(\s*(\w+)\s*,\s*\{/g;
    let csMatch;
    const castInsertions: Array<{ pos: number }> = [];
    while ((csMatch = createSchemaPattern.exec(content)) !== null) {
      const braceStart = csMatch.index + csMatch[0].length - 1;
      let depth = 1;
      let pos = braceStart + 1;
      while (pos < content.length && depth > 0) {
        if (content[pos] === '{') depth++;
        if (content[pos] === '}') depth--;
        pos++;
      }
      const afterBrace = content.substring(pos).trimStart();
      if (!afterBrace.startsWith("as any")) {
        castInsertions.push({ pos });
      }
    }
    for (let i = castInsertions.length - 1; i >= 0; i--) {
      const { pos } = castInsertions[i];
      content = content.substring(0, pos) + " as any" + content.substring(pos);
      modified = true;
    }

    if (modified) {
      fixes.push(`[${file.path}] Fixed drizzle-zod v0.7 refinement callbacks`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

const DRIZZLE_ORM_OPERATORS = [
  "eq", "ne", "lt", "gt", "lte", "gte",
  "and", "or", "not", "between", "like", "ilike",
  "inArray", "notInArray", "isNull", "isNotNull",
  "sql", "desc", "asc", "count", "sum", "avg", "min", "max",
  "exists", "notExists",
];

function fixMissingDrizzleOrmImports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (file.path.endsWith(".d.ts")) return file;

    const used: string[] = [];
    for (const op of DRIZZLE_ORM_OPERATORS) {
      const pattern = new RegExp(`(?<!\\.)\\b${op}\\s*\\(`, "g");
      if (pattern.test(file.content)) {
        used.push(op);
      }
    }
    if (used.length === 0) return file;

    const importMatch = file.content.match(
      /import\s*\{([^}]+)\}\s*from\s*['"]drizzle-orm['"]/
    );

    const currentImports = importMatch
      ? new Set(importMatch[1].split(",").map(s => s.trim()).filter(Boolean))
      : new Set<string>();

    const missing = used.filter(op => !currentImports.has(op));
    if (missing.length === 0) return file;

    let content = file.content;
    if (importMatch) {
      const allImports = [...currentImports, ...missing].sort();
      content = content.replace(
        /import\s*\{[^}]+\}\s*from\s*['"]drizzle-orm['"]/,
        `import { ${allImports.join(", ")} } from 'drizzle-orm'`
      );
    } else {
      content = `import { ${missing.sort().join(", ")} } from 'drizzle-orm';\n` + content;
    }

    fixes.push(`[${file.path}] Added missing drizzle-orm imports: ${missing.join(", ")}`);
    return { path: file.path, content };
  });

  return { files: updatedFiles, fixes };
}

function fixMissingModuleFiles(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];
  const existingPaths = new Set(files.map(f => f.path));
  const newFiles: Array<{ path: string; content: string }> = [];

  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;

    const importMatches = file.content.matchAll(/(?:import|from)\s+['"](\.[^'"]+)['"]/g);
    for (const m of importMatches) {
      const importPath = m[1];
      const fileDir = file.path.split("/").slice(0, -1).join("/");
      const resolvedParts = [...fileDir.split("/")];
      for (const seg of importPath.split("/")) {
        if (seg === ".") continue;
        if (seg === "..") resolvedParts.pop();
        else resolvedParts.push(seg);
      }
      const resolved = resolvedParts.join("/");
      const candidates = [resolved + ".ts", resolved + "/index.ts", resolved + ".tsx"];

      if (candidates.some(c => existingPaths.has(c))) continue;
      if (existingPaths.has(resolved)) continue;

      const stubPath = resolved + ".ts";
      if (existingPaths.has(stubPath)) continue;

      const importedNames = file.content.matchAll(
        new RegExp(`import\\s*(?:type\\s*)?\\{([^}]+)\\}\\s*from\\s*['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g')
      );
      const names: string[] = [];
      for (const im of importedNames) {
        names.push(...im[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean));
      }

      const stubs = names.map(name => {
        if (/^[A-Z]/.test(name)) return `export type ${name} = any;`;
        if (/[Ss]chema/.test(name)) return `export const ${name} = {} as any;`;
        return `export const ${name} = {} as any;`;
      }).join("\n");

      newFiles.push({ path: stubPath, content: stubs + "\n" });
      existingPaths.add(stubPath);
      fixes.push(`[${stubPath}] Created stub module for missing import`);
    }
  }

  if (newFiles.length === 0) return { files, fixes };
  return { files: [...files, ...newFiles], fixes };
}

function fixDrizzleRelationsImport(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.endsWith(".ts")) return file;
    if (!file.content.includes("relations")) return file;

    let content = file.content;
    let modified = false;

    const pgCoreRelationsPattern = /import\s*\{([^}]*)\brelations\b([^}]*)\}\s*from\s*['"]drizzle-orm\/pg-core['"]/;
    const match = content.match(pgCoreRelationsPattern);
    if (match) {
      const allImports = match[1] + "relations" + match[2];
      const importNames = allImports.split(",").map(s => s.trim()).filter(Boolean);
      const relationsImports = importNames.filter(n => n === "relations");
      const pgCoreImports = importNames.filter(n => n !== "relations");

      if (pgCoreImports.length > 0) {
        content = content.replace(pgCoreRelationsPattern,
          `import { ${pgCoreImports.join(", ")} } from 'drizzle-orm/pg-core'`);
      } else {
        content = content.replace(pgCoreRelationsPattern, "");
      }

      if (!content.includes("relations") || !content.match(/import\s*\{[^}]*\brelations\b[^}]*\}\s*from\s*['"]drizzle-orm['"]/)) {
        const hasExistingDrizzleOrm = content.match(/import\s*\{([^}]*)\}\s*from\s*['"]drizzle-orm['"]/);
        if (hasExistingDrizzleOrm) {
          const existingImports = hasExistingDrizzleOrm[1];
          if (!existingImports.includes("relations")) {
            content = content.replace(
              /import\s*\{([^}]*)\}\s*from\s*['"]drizzle-orm['"]/,
              (m, imports) => `import { ${imports.trim()}, relations } from 'drizzle-orm'`
            );
          }
        } else {
          content = `import { relations } from 'drizzle-orm';\n` + content;
        }
      }

      modified = true;
    }

    if (modified) {
      fixes.push(`[${file.path}] Moved 'relations' import from drizzle-orm/pg-core to drizzle-orm`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixDrizzleDbSchemaGeneric(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.endsWith(".ts")) return file;
    if (!file.content.includes("drizzle(")) return file;

    let content = file.content;
    let modified = false;

    if (content.match(/drizzle\s*\(\s*\w+\s*\)/) && !content.includes("{ schema }")) {
      const hasSchemaImport = content.includes("* as schema") || content.includes("import * as schema");
      
      if (!hasSchemaImport) {
        const schemaImportPath = file.path.includes("/db/") ? "../schema" :
          file.path.includes("/lib/") ? "../schema" :
          "./schema";
        content = `import * as schema from '${schemaImportPath}';\n` + content;
      }

      content = content.replace(
        /drizzle\s*\(\s*(\w+)\s*\)/g,
        (match, poolVar) => {
          modified = true;
          return `drizzle(${poolVar}, { schema })`;
        }
      );
    }

    if (modified) {
      fixes.push(`[${file.path}] Added schema generic to drizzle() for db.query support`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixMissingTypeExports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const importRequests: Array<{
    importerPath: string;
    targetPath: string;
    names: string[];
  }> = [];

  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;

    const importPattern = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(file.content)) !== null) {
      const names = match[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      const importPath = match[2];
      const fileDir = file.path.split("/").slice(0, -1).join("/");
      const resolvedParts = [...fileDir.split("/")];

      for (const segment of importPath.split("/")) {
        if (segment === ".") continue;
        if (segment === "..") resolvedParts.pop();
        else resolvedParts.push(segment);
      }

      const resolved = resolvedParts.join("/");
      const candidates = [
        resolved + ".ts", resolved + ".tsx",
        resolved + "/index.ts", resolved + "/index.tsx",
      ];

      const targetFile = files.find(f => candidates.includes(f.path));
      if (targetFile) {
        importRequests.push({
          importerPath: file.path,
          targetPath: targetFile.path,
          names,
        });
      }
    }
  }

  if (importRequests.length === 0) return { files, fixes };

  const stubsNeeded = new Map<string, Set<string>>();

  for (const req of importRequests) {
    const targetFile = files.find(f => f.path === req.targetPath);
    if (!targetFile) continue;

    for (const name of req.names) {
      const exportedPattern = new RegExp(`export\\s+(?:const|let|var|function|class|interface|type|enum)\\s+${name}\\b`);
      const reExportPattern = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);
      const declPattern = new RegExp(`(?:interface|type|enum|class|const|let|var|function)\\s+${name}\\b`);

      if (exportedPattern.test(targetFile.content) || reExportPattern.test(targetFile.content)) continue;

      const hasStarReexport = /export\s*\*\s*from\s*['"]/.test(targetFile.content);
      if (hasStarReexport) {
        const starModules = [...targetFile.content.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
        const targetDir = req.targetPath.split("/").slice(0, -1).join("/");
        let providedByStarExport = false;
        for (const starMod of starModules) {
          const resolvedParts = [...targetDir.split("/")];
          for (const seg of starMod.split("/")) {
            if (seg === ".") continue;
            if (seg === "..") resolvedParts.pop();
            else resolvedParts.push(seg);
          }
          const resolved = resolvedParts.join("/");
          const candidates = [resolved + ".ts", resolved + "/index.ts"];
          const starFile = files.find(f => candidates.includes(f.path));
          if (starFile) {
            const directExportPattern = new RegExp(`export\\s+(?:const|let|var|function|class|interface|type|enum)\\s+${name}\\b`);
            const namedReExportPattern = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);
            if (directExportPattern.test(starFile.content) || namedReExportPattern.test(starFile.content)) {
              providedByStarExport = true;
              break;
            }
          }
        }
        if (providedByStarExport) continue;
      }

      if (declPattern.test(targetFile.content) && !exportedPattern.test(targetFile.content)) {
        if (!stubsNeeded.has(req.targetPath)) stubsNeeded.set(req.targetPath, new Set());
        stubsNeeded.get(req.targetPath)!.add("__export__" + name);
        continue;
      }

      if (!stubsNeeded.has(req.targetPath)) stubsNeeded.set(req.targetPath, new Set());
      stubsNeeded.get(req.targetPath)!.add(name);
    }
  }

  if (stubsNeeded.size === 0) return { files, fixes };

  const updatedFiles = files.map(file => {
    const stubs = stubsNeeded.get(file.path);
    if (!stubs || stubs.size === 0) return file;

    let content = file.content;

    const toExport = [...stubs].filter(n => n.startsWith("__export__")).map(n => n.replace("__export__", ""));
    const toStub = [...stubs].filter(n => !n.startsWith("__export__"));

    for (const name of toExport) {
      const declRegex = new RegExp(`(?<!export\\s+)((?:interface|type|enum|class|const|let|var|function)\\s+${name}\\b)`);
      if (declRegex.test(content)) {
        content = content.replace(declRegex, `export $1`);
      }
    }

    const needsZod = toStub.some(n => /^[a-z]/.test(n) && /[Ss]chema/.test(n));
    const zodImport = needsZod && !content.includes("from 'zod'") && !content.includes('from "zod"')
      ? `import { z } from 'zod';\n`
      : "";
    const stubLines = toStub.length > 0 ? zodImport + toStub.map(name => {
      if (/^[a-z]/.test(name)) {
        if (/[Ss]chema/.test(name)) {
          return `export const ${name} = z.any();`;
        }
        return `export const ${name} = {} as any;`;
      }
      return `export type ${name} = any;`;
    }).join("\n") : "";
    const allNames = [...toExport, ...toStub];
    fixes.push(`[${file.path}] Added stubs: ${allNames.join(", ")}`);
    return { path: file.path, content: content + (stubLines ? "\n" + stubLines + "\n" : "") };
  });

  return { files: updatedFiles, fixes };
}

function fixJwtTypeIssues(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes("jwt")) return file;

    let content = file.content;
    let modified = false;

    const lines = content.split('\n');
    content = lines.map(line => {
      if (!line.includes('jwt.verify(')) return line;
      if (line.includes('as any')) return line;
      modified = true;
      return line.replace(
        /jwt\.verify\s*\([^)]+\)\s*(?:as\s+.*)?/,
        (m) => {
          const callEnd = m.indexOf(')') + 1;
          const callPart = m.substring(0, callEnd);
          return `${callPart} as any`;
        }
      );
    }).join('\n');

    content = content.replace(
      /jwt\.sign\s*\(\s*([^,]+),\s*([^,]+),\s*\{([^}]*)\}\s*\)/g,
      (match, payload, secret, opts) => {
        if (match.includes("as any")) return match;
        modified = true;
        return `jwt.sign(${payload} as any, ${secret} as any, {${opts}} as any)`;
      }
    );

    if (modified) {
      fixes.push(`[${file.path}] Fixed JWT type casting for verify/sign`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixDuplicateIdentifiers(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.match(/\.[tj]sx?$/)) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /((?:import|export)\s*(?:type\s*)?\{)([^}]+)(\}\s*from\s*['"][^'"]+['"])/g,
      (full, prefix, names, suffix) => {
        const parts = names.split(",").map((s: string) => s.trim()).filter(Boolean);
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const part of parts) {
          const name = part.split(/\s+as\s+/)[0].trim();
          if (seen.has(name)) {
            fixes.push(`[${file.path}] Removed duplicate '${name}' from import/export`);
            modified = true;
            continue;
          }
          seen.add(name);
          deduped.push(part);
        }
        if (deduped.length === parts.length) return full;
        return `${prefix} ${deduped.join(", ")} ${suffix}`;
      }
    );

    const lines = content.split("\n");
    const seenDeclarations = new Set<string>();
    const finalLines: string[] = [];
    let skipBlock = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (skipBlock) {
        for (const ch of line) {
          if (ch === "{") braceDepth++;
          if (ch === "}") braceDepth--;
        }
        if (braceDepth <= 0) skipBlock = false;
        continue;
      }

      const declMatch = line.match(
        /^(?:export\s+)?(?:const|let|var|type|interface|function|class|enum)\s+(\w+)/
      );

      if (declMatch) {
        const id = declMatch[1];
        if (seenDeclarations.has(id)) {
          fixes.push(`[${file.path}] Removed duplicate declaration '${id}'`);
          modified = true;
          const openBraces = (line.match(/\{/g) || []).length;
          const closeBraces = (line.match(/\}/g) || []).length;
          const balance = openBraces - closeBraces;
          if (balance > 0) {
            skipBlock = true;
            braceDepth = balance;
          }
          continue;
        }
        seenDeclarations.add(id);
      }

      finalLines.push(line);
    }

    if (!modified) return file;
    return { ...file, content: finalLines.join("\n") };
  });

  return { files: updatedFiles, fixes };
}

function fixMissingPackageDeps(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];
  const bannedPackagesGlobal = ["dompurify", "isomorphic-dompurify"];

  let currentFiles = [...files];
  for (let i = 0; i < currentFiles.length; i++) {
    if (!currentFiles[i].path.endsWith("package.json")) continue;
    try {
      const p = JSON.parse(currentFiles[i].content);
      let changed = false;
      for (const banned of bannedPackagesGlobal) {
        if (p.dependencies?.[banned]) { delete p.dependencies[banned]; changed = true; }
        if (p.devDependencies?.[banned]) { delete p.devDependencies[banned]; changed = true; }
      }
      if (changed) {
        currentFiles[i] = { path: currentFiles[i].path, content: JSON.stringify(p, null, 2) + "\n" };
        fixes.push(`[${currentFiles[i].path}] Removed vulnerable packages (dompurify)`);
      }
    } catch {}
  }

  const serverPkgIdx = currentFiles.findIndex(f => f.path === "server/package.json");
  if (serverPkgIdx === -1) return { files: currentFiles, fixes };

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(currentFiles[serverPkgIdx].content);
  } catch {
    return { files: currentFiles, fixes };
  }

  const deps = (pkg.dependencies || {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies || {}) as Record<string, string>;
  const allDeps = new Set([...Object.keys(deps), ...Object.keys(devDeps)]);

  const builtinModules = new Set([
    "fs", "path", "http", "https", "crypto", "os", "url", "stream",
    "events", "util", "querystring", "net", "tls", "child_process",
    "cluster", "dns", "readline", "zlib", "assert", "buffer", "string_decoder",
    "timers", "vm", "worker_threads", "perf_hooks",
    "node:fs", "node:path", "node:http", "node:https", "node:crypto",
    "node:os", "node:url", "node:stream", "node:events", "node:util",
    "node:querystring", "node:net", "node:tls", "node:child_process",
    "node:cluster", "node:dns", "node:readline", "node:zlib", "node:assert",
    "node:buffer", "node:string_decoder", "node:timers", "node:vm",
    "node:worker_threads", "node:perf_hooks",
  ]);

  const importedPkgs = new Set<string>();
  for (const file of currentFiles) {
    if (!file.path.startsWith("server/") || !file.path.match(/\.[tj]sx?$/)) continue;
    if (file.path.endsWith(".d.ts")) continue;

    const matches = file.content.matchAll(/(?:import|from)\s+["']([^"'./][^"']*)["']/g);
    for (const m of matches) {
      let pkgName = m[1];
      if (pkgName.startsWith("@")) {
        const parts = pkgName.split("/");
        pkgName = parts.slice(0, 2).join("/");
      } else {
        pkgName = pkgName.split("/")[0];
      }
      if (!builtinModules.has(pkgName)) {
        importedPkgs.add(pkgName);
      }
    }
  }

  const bannedPackages = ["dompurify", "isomorphic-dompurify"];
  let modified = false;
  for (const banned of bannedPackages) {
    if (deps[banned]) {
      delete deps[banned];
      modified = true;
      fixes.push(`[server/package.json] Removed vulnerable package: ${banned}`);
    }
    if (devDeps[banned]) {
      delete devDeps[banned];
      modified = true;
      fixes.push(`[server/package.json] Removed vulnerable dev package: ${banned}`);
    }
  }
  for (const pkg_name of importedPkgs) {
    if (bannedPackages.includes(pkg_name)) continue;
    if (!allDeps.has(pkg_name)) {
      deps[pkg_name] = "latest";
      modified = true;
      fixes.push(`[server/package.json] Added missing imported package: ${pkg_name}`);
    }
  }

  if (modified) {
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
    currentFiles[serverPkgIdx] = {
      path: currentFiles[serverPkgIdx].path,
      content: JSON.stringify(pkg, null, 2) + "\n",
    };
    return { files: currentFiles, fixes };
  }

  return { files: currentFiles, fixes };
}

function fixCatchErrorUnknown(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes("catch")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /\bcatch\s*\(\s*(\w+)\s*\)\s*\{/g,
      (match, varName) => {
        modified = true;
        return `catch (${varName}: any) {`;
      }
    );

    if (modified) {
      fixes.push(`[${file.path}] Typed catch clause errors as 'any' to avoid TS18046`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function resolveEnvName(varName: string): string {
  const lower = varName.toLowerCase();
  if (SECRET_ENV_NAMES[lower]) return SECRET_ENV_NAMES[lower];

  const snakeCase = varName
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toUpperCase();
  return snakeCase;
}

function fixDrizzleZodBooleanRefinements(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.content.includes("createInsertSchema") && !file.content.includes("createSelectSchema")) return file;

    let content = file.content;
    let modified = false;

    const pattern = /(create(?:Insert|Select)Schema)\s*\(\s*(\w+)\s*,\s*\{/g;
    let schemaMatch;
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];

    while ((schemaMatch = pattern.exec(content)) !== null) {
      const braceStart = schemaMatch.index + schemaMatch[0].length - 1;
      let depth = 1;
      let pos = braceStart + 1;
      while (pos < content.length && depth > 0) {
        if (content[pos] === '{') depth++;
        if (content[pos] === '}') depth--;
        pos++;
      }
      const objectBody = content.substring(braceStart + 1, pos - 1);

      if (/\b(\w+)\s*:\s*true\b/.test(objectBody)) {
        const newBody = objectBody.replace(
          /(\w+)\s*:\s*true\b/g,
          (_m, key) => `${key}: (s: any) => s`
        );
        replacements.push({
          start: braceStart + 1,
          end: pos - 1,
          replacement: newBody,
        });
        modified = true;
      }
    }

    for (let i = replacements.length - 1; i >= 0; i--) {
      const { start, end, replacement } = replacements[i];
      content = content.substring(0, start) + replacement + content.substring(end);
    }

    if (modified) {
      fixes.push(`[${file.path}] Replaced boolean \`true\` refinement values with (s: any) => s`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixTypeOnlyNamespaceImports(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.match(/\.[tj]sx?$/) || file.path.endsWith(".d.ts")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /import\s+type\s+\*\s+as\s+(\w+)\s+from\s+/g,
      (_match, name) => {
        modified = true;
        return `import * as ${name} from `;
      }
    );

    if (modified) {
      fixes.push(`[${file.path}] Converted type-only namespace import to value import`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixHardcodedSecrets(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];
  const envKeysInjected = new Set<string>();

  const updatedFiles = files.map(file => {
    if (!file.path.match(/\.[tj]sx?$/) || file.path.endsWith(".d.ts")) return file;
    if (file.path.includes("seed") || file.path.includes("test") || file.path.includes("spec")) return file;

    let content = file.content;
    let changed = false;

    content = content.replace(SECRET_VAR_PATTERN, (fullMatch, varName, _literalValue) => {
      const envName = resolveEnvName(varName);
      envKeysInjected.add(envName);
      changed = true;

      if (fullMatch.match(/^(?:const|let|var)\s/)) {
        const declType = fullMatch.match(/^(const|let|var)/)?.[1] || "const";
        return `${declType} ${varName} = process.env.${envName} || ""`;
      }

      if (fullMatch.includes(":")) {
        return `${varName}: process.env.${envName} || ""`;
      }

      return `${varName} = process.env.${envName} || ""`;
    });

    if (changed) {
      fixes.push(`[${file.path}] Replaced hardcoded secret(s) with process.env references`);
      return { path: file.path, content };
    }
    return file;
  });

  if (envKeysInjected.size > 0) {
    const envExampleIdx = updatedFiles.findIndex(f =>
      f.path.endsWith(".env.example") || f.path.endsWith(".env")
    );

    if (envExampleIdx >= 0) {
      let envContent = updatedFiles[envExampleIdx].content;
      for (const key of envKeysInjected) {
        if (!envContent.includes(key)) {
          envContent += `\n${key}=`;
          fixes.push(`[${updatedFiles[envExampleIdx].path}] Added ${key} to env template`);
        }
      }
      updatedFiles[envExampleIdx] = {
        path: updatedFiles[envExampleIdx].path,
        content: envContent,
      };
    }
  }

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

  const bcryptFix = fixBcryptImports(currentFiles);
  currentFiles = bcryptFix.files;
  allFixes.push(...bcryptFix.fixes);

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

  const framerFix = fixFramerMotionPropSpreads(currentFiles);
  currentFiles = framerFix.files;
  allFixes.push(...framerFix.fixes);

  const schemaBarrelFix = fixSchemaBarrelExports(currentFiles);
  currentFiles = schemaBarrelFix.files;
  allFixes.push(...schemaBarrelFix.fixes);

  const execDestructFix = fixDrizzleExecuteDestructuring(currentFiles);
  currentFiles = execDestructFix.files;
  allFixes.push(...execDestructFix.fixes);

  const schemaMirror = fixSchemaColumnMismatches(currentFiles);
  currentFiles = schemaMirror.files;
  allFixes.push(...schemaMirror.fixes);

  const reqAugFix = fixExpressRequestAugmentation(currentFiles);
  currentFiles = reqAugFix.files;
  allFixes.push(...reqAugFix.fixes);

  const toFixedFix = fixToFixedOnStrings(currentFiles);
  currentFiles = toFixedFix.files;
  allFixes.push(...toFixedFix.fixes);

  const dtsFix = fixDtsModuleExports(currentFiles);
  currentFiles = dtsFix.files;
  allFixes.push(...dtsFix.fixes);

  const barrelFix = fixMissingBarrelExports(currentFiles);
  currentFiles = barrelFix.files;
  allFixes.push(...barrelFix.fixes);

  const drizzleImportsFix = fixMissingDrizzleColumnImports(currentFiles);
  currentFiles = drizzleImportsFix.files;
  allFixes.push(...drizzleImportsFix.fixes);

  const namedExportsFix = fixMissingNamedExports(currentFiles);
  currentFiles = namedExportsFix.files;
  allFixes.push(...namedExportsFix.fixes);

  const stubsFix = fixMissingTypeStubs(currentFiles);
  currentFiles = stubsFix.files;
  allFixes.push(...stubsFix.fixes);

  const schemaValFix = fixSchemaValueImport(currentFiles);
  currentFiles = schemaValFix.files;
  allFixes.push(...schemaValFix.fixes);

  const sigMapFix = fixSignatureMap(currentFiles);
  currentFiles = sigMapFix.files;
  allFixes.push(...sigMapFix.fixes);

  const zodKeysFix = fixDrizzleZodRefinementKeys(currentFiles);
  currentFiles = zodKeysFix.files;
  allFixes.push(...zodKeysFix.fixes);

  const booleanRefinementFix = fixDrizzleZodBooleanRefinements(currentFiles);
  currentFiles = booleanRefinementFix.files;
  allFixes.push(...booleanRefinementFix.fixes);

  const valReqFix = fixValidateRequestSchema(currentFiles);
  currentFiles = valReqFix.files;
  allFixes.push(...valReqFix.fixes);

  const catchFix = fixCatchErrorUnknown(currentFiles);
  currentFiles = catchFix.files;
  allFixes.push(...catchFix.fixes);

  const drizzleZodCallbackFix = fixDrizzleZodRefinementCallbacks(currentFiles);
  currentFiles = drizzleZodCallbackFix.files;
  allFixes.push(...drizzleZodCallbackFix.fixes);

  const jwtFix = fixJwtTypeIssues(currentFiles);
  currentFiles = jwtFix.files;
  allFixes.push(...jwtFix.fixes);

  const drizzleOrmImportsFix = fixMissingDrizzleOrmImports(currentFiles);
  currentFiles = drizzleOrmImportsFix.files;
  allFixes.push(...drizzleOrmImportsFix.fixes);

  const drizzleRelationsFix = fixDrizzleRelationsImport(currentFiles);
  currentFiles = drizzleRelationsFix.files;
  allFixes.push(...drizzleRelationsFix.fixes);

  const missingModulesFix = fixMissingModuleFiles(currentFiles);
  currentFiles = missingModulesFix.files;
  allFixes.push(...missingModulesFix.fixes);

  const drizzleDbSchemaFix = fixDrizzleDbSchemaGeneric(currentFiles);
  currentFiles = drizzleDbSchemaFix.files;
  allFixes.push(...drizzleDbSchemaFix.fixes);

  const missingTypeExportsFix = fixMissingTypeExports(currentFiles);
  currentFiles = missingTypeExportsFix.files;
  allFixes.push(...missingTypeExportsFix.fixes);

  const typeOnlyNsFix = fixTypeOnlyNamespaceImports(currentFiles);
  currentFiles = typeOnlyNsFix.files;
  allFixes.push(...typeOnlyNsFix.fixes);

  const dedupeFix = fixDuplicateIdentifiers(currentFiles);
  currentFiles = dedupeFix.files;
  allFixes.push(...dedupeFix.fixes);

  const missingDepsFix = fixMissingPackageDeps(currentFiles);
  currentFiles = missingDepsFix.files;
  allFixes.push(...missingDepsFix.fixes);

  const secretsFix = fixHardcodedSecrets(currentFiles);
  currentFiles = secretsFix.files;
  allFixes.push(...secretsFix.fixes);

  const useRefFix = fixUninitializedUseRefs(currentFiles);
  currentFiles = useRefFix.files;
  allFixes.push(...useRefFix.fixes);

  const r3fTupleFix = fixR3FTupleCasts(currentFiles);
  currentFiles = r3fTupleFix.files;
  allFixes.push(...r3fTupleFix.fixes);

  const visualSanityFix = fixVisualSanityGuard(currentFiles);
  currentFiles = visualSanityFix.files;
  allFixes.push(...visualSanityFix.fixes);

  const assetConduitFix = fixAssetConduit(currentFiles);
  currentFiles = assetConduitFix.files;
  allFixes.push(...assetConduitFix.fixes);

  const commandSchemaFix = fixCommandSchemaExhaustive(currentFiles);
  currentFiles = commandSchemaFix.files;
  allFixes.push(...commandSchemaFix.fixes);

  const conversationalArchitectFix = fixConversationalArchitect(currentFiles);
  currentFiles = conversationalArchitectFix.files;
  allFixes.push(...conversationalArchitectFix.fixes);

  const performanceWallFix = fixPerformanceWall(currentFiles);
  currentFiles = performanceWallFix.files;
  allFixes.push(...performanceWallFix.fixes);

  const viteEnvFix = fixViteEnvTypes(currentFiles);
  currentFiles = viteEnvFix.files;
  allFixes.push(...viteEnvFix.fixes);

  return { files: currentFiles, fixes: allFixes };
}

function fixSchemaValueImport(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.match(/\.[tj]sx?$/) || file.path.endsWith(".d.ts")) return file;

    let content = file.content;
    let modified = false;

    if (content.includes("drizzle(")) {
      const before = content;
      content = content.replace(
        /import\s+type\s+\*\s+as\s+schema\s+from\s+/g,
        "import * as schema from "
      );
      if (content !== before) {
        modified = true;
        fixes.push(`[${file.path}] Converted 'import type * as schema' to value import for drizzle()`);
      }
    }

    if (file.path.includes("schema") && (file.path.endsWith("index.ts") || file.path.endsWith("index.tsx"))) {
      const before = content;
      content = content.replace(
        /\n*export\s+interface\s+schema\s*\{[^}]*\}\s*\n*/g,
        "\n"
      );
      content = content.replace(
        /\n*export\s+type\s+schema\s*=\s*[^;\n]+;\s*\n*/g,
        "\n"
      );
      if (content !== before) {
        modified = true;
        fixes.push(`[${file.path}] Removed type-only 'schema' stub that shadows namespace import (TS2693)`);
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: updatedFiles, fixes };
}

function fixR3FTupleCasts(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.includes("client/") || !file.path.endsWith(".tsx")) return file;

    let content = file.content;
    let modified = false;

    content = content.replace(
      /(position|rotation|scale)=\{\s*(\[[^\]]+\])\s*\}/g,
      (match, prop, arr) => {
        if (match.includes("as [number, number, number]")) return match;
        modified = true;
        return `${prop}={${arr} as [number, number, number]}`;
      }
    );

    if (modified) {
      fixes.push(`[${file.path}] Cast R3F position/rotation/scale arrays to [number, number, number] tuple`);
      return { path: file.path, content };
    }
    return file;
  });

  return { files: updatedFiles, fixes };
}

function fixUninitializedUseRefs(
  files: Array<{ path: string; content: string }>,
): { files: Array<{ path: string; content: string }>; fixes: string[] } {
  const fixes: string[] = [];
  const updatedFiles = files.map(file => {
    if (!file.path.match(/\.[tj]sx?$/) || file.path.endsWith(".d.ts")) return file;

    const lines = file.content.split("\n");
    let modified = false;

    const fixedLines = lines.map(line => {
      const idx = line.indexOf("useRef<");
      if (idx === -1) return line;

      let depth = 0;
      let typeStart = idx + 7;
      let typeEnd = -1;
      for (let i = typeStart; i < line.length; i++) {
        if (line[i] === "<") depth++;
        if (line[i] === ">") {
          if (depth === 0) { typeEnd = i; break; }
          depth--;
        }
      }
      if (typeEnd === -1) return line;

      const after = line.substring(typeEnd + 1).trimStart();
      if (!after.startsWith("()")) return line;

      const typeParam = line.substring(typeStart, typeEnd);
      if (typeParam.includes("null") || typeParam.trim() === "undefined") return line;

      const parenIdx = line.indexOf("()", typeEnd);
      if (parenIdx === -1) return line;

      modified = true;
      return line.substring(0, parenIdx) + "(null!)" + line.substring(parenIdx + 2);
    });

    if (modified) {
      fixes.push(`[${file.path}] Fixed uninitialized useRef<T>() → useRef<T>(null!)`);
      return { path: file.path, content: fixedLines.join("\n") };
    }
    return file;
  });
  return { files: updatedFiles, fixes };
}

function fixViteEnvTypes(
  files: Array<{ path: string; content: string }>,
): { files: Array<{ path: string; content: string }>; fixes: string[] } {
  const fixes: string[] = [];

  const usesImportMetaEnv = files.some(f =>
    f.path.startsWith("client/") &&
    f.path.match(/\.[tj]sx?$/) &&
    !f.path.endsWith(".d.ts") &&
    f.content.includes("import.meta.env")
  );

  if (!usesImportMetaEnv) return { files, fixes };

  const hasViteEnvDts = files.some(f =>
    f.path === "client/src/vite-env.d.ts" ||
    f.path === "client/vite-env.d.ts"
  );

  const clientTsconfig = files.find(f => f.path === "client/tsconfig.json");
  let tsconfigHasViteClient = false;

  if (clientTsconfig) {
    try {
      const config = JSON.parse(clientTsconfig.content);
      const types = config?.compilerOptions?.types;
      if (Array.isArray(types) && types.includes("vite/client")) {
        tsconfigHasViteClient = true;
      }
    } catch {}
  }

  if (hasViteEnvDts || tsconfigHasViteClient) {
    return { files, fixes };
  }

  const updatedFiles = [...files];

  if (clientTsconfig) {
    try {
      const config = JSON.parse(clientTsconfig.content);
      if (!config.compilerOptions) config.compilerOptions = {};
      if (!Array.isArray(config.compilerOptions.types)) {
        config.compilerOptions.types = [];
      }
      config.compilerOptions.types.push("vite/client");
      const idx = updatedFiles.findIndex(f => f.path === "client/tsconfig.json");
      updatedFiles[idx] = { path: "client/tsconfig.json", content: JSON.stringify(config, null, 2) + "\n" };
      fixes.push("[client/tsconfig.json] Added 'vite/client' to compilerOptions.types for import.meta.env support");
    } catch {}
  } else {
    updatedFiles.push({
      path: "client/src/vite-env.d.ts",
      content: '/// <reference types="vite/client" />\n',
    });
    fixes.push("[client/src/vite-env.d.ts] Injected vite/client reference for import.meta.env support");
  }

  return { files: updatedFiles, fixes };
}

function fixVisualSanityGuard(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const VISUAL_SANITY_FN = `export function visualSanity(pos: [number, number, number]): boolean {
  const [x, y, z] = pos;
  if (y < 0) return false;
  const dist = Math.sqrt(x * x + z * z);
  if (dist > 100) return false;
  return true;
}
`;

  const hasPivotControls = files.some(
    f => f.path.startsWith("client/") && f.path.endsWith(".tsx") && f.content.includes("PivotControls"),
  );
  if (!hasPivotControls) return { files, fixes };

  const hasVisualSanityFile = files.some(
    f => f.path === "client/src/lib/visual-sanity.ts" && f.content.includes("visualSanity"),
  );

  const updatedFiles = [...files];

  if (!hasVisualSanityFile) {
    updatedFiles.push({
      path: "client/src/lib/visual-sanity.ts",
      content: VISUAL_SANITY_FN,
    });
    fixes.push("[client/src/lib/visual-sanity.ts] Injected visual sanity bounds guard for PivotControls editor");
  }

  const result = updatedFiles.map(file => {
    if (!file.path.startsWith("client/") || !file.path.endsWith(".tsx")) return file;
    if (!file.content.includes("PivotControls")) return file;
    if (!file.content.includes("onDragEnd")) return file;

    let content = file.content;

    if (content.includes("m.elements[12]") && !content.includes("visualSanity")) {
      const importPath = getRelativeImportPath(file.path, "client/src/lib/visual-sanity.ts");
      if (!content.includes("visual-sanity")) {
        const lastImportIdx = content.lastIndexOf("\nimport ");
        if (lastImportIdx !== -1) {
          const lineEnd = content.indexOf("\n", lastImportIdx + 1);
          content = content.slice(0, lineEnd + 1) +
            `import { visualSanity } from "${importPath}";\n` +
            content.slice(lineEnd + 1);
        } else {
          content = `import { visualSanity } from "${importPath}";\n` + content;
        }
      }

      const matrixExtractRegex = /const\s+(\w+)\s*(?::\s*\[number,\s*number,\s*number\])?\s*=\s*\[m\.elements\[12\],\s*m\.elements\[13\],\s*m\.elements\[14\]\];?\s*\n/g;
      let match: RegExpExecArray | null;
      while ((match = matrixExtractRegex.exec(content)) !== null) {
        const varName = match[1];
        const afterMatch = content.slice(match.index + match[0].length);
        if (!afterMatch.trimStart().startsWith("if") || !afterMatch.includes("visualSanity")) {
          const indent = match[0].match(/^(\s*)/)?.[1] || "          ";
          const guardLine = `${indent}if (!visualSanity(${varName})) return;\n`;
          const insertPos = match.index + match[0].length;
          content = content.slice(0, insertPos) + guardLine + content.slice(insertPos);
          fixes.push(`[${file.path}] Injected visualSanity guard after matrix position extraction`);
        }
      }
    }

    return { path: file.path, content };
  });

  return { files: result, fixes };
}

function fixAssetConduit(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const ASSET_CONDUIT_MODULE = `export const ASSET_LIMITS = {
  MAX_VERTICES: 50_000,
  MAX_TEXTURE_RES: 1024,
  ALLOWED_FORMATS: [".glb", ".gltf", ".webp", ".png", ".mp3", ".ogg"],
} as const;

export function validateAssetUrl(url: string): boolean {
  const ext = url.slice(url.lastIndexOf(".")).toLowerCase();
  return ASSET_LIMITS.ALLOWED_FORMATS.includes(ext as any);
}
`;

  const hasGLTFUsage = files.some(
    f => f.path.startsWith("client/") && f.content.includes("useGLTF"),
  );
  const hasTextureUsage = files.some(
    f => f.path.startsWith("client/") && f.content.includes("useTexture"),
  );

  if (!hasGLTFUsage && !hasTextureUsage) return { files, fixes };

  const updatedFiles = [...files];

  const hasConduitFile = files.some(
    f => f.path === "client/src/lib/asset-conduit.ts" && f.content.includes("ASSET_LIMITS"),
  );
  if (!hasConduitFile) {
    updatedFiles.push({
      path: "client/src/lib/asset-conduit.ts",
      content: ASSET_CONDUIT_MODULE,
    });
    fixes.push("[client/src/lib/asset-conduit.ts] Injected asset conduit with validation limits (50k verts, 1024px textures)");
  }

  const result = updatedFiles.map(file => {
    if (!file.path.startsWith("client/") || !file.path.endsWith(".tsx")) return file;

    let content = file.content;
    let modified = false;

    if (content.includes("useGLTF") && !content.includes(".dispose()")) {
      const useGLTFMatch = content.match(/const\s+\{([^}]+)\}\s*=\s*useGLTF\s*\(/);
      if (useGLTFMatch) {
        const destructured = useGLTFMatch[1];
        const hasNodes = destructured.includes("nodes");
        const hasMaterials = destructured.includes("materials");
        const hasScene = destructured.includes("scene");

        if ((hasNodes || hasMaterials || hasScene) && !content.includes("geometry?.dispose")) {
          const disposeLines: string[] = [];
          if (hasNodes) {
            disposeLines.push(
              `    Object.values(nodes).forEach((node) => {`,
              `      if ("geometry" in node) (node as any).geometry?.dispose();`,
              `    });`,
            );
          }
          if (hasMaterials) {
            disposeLines.push(
              `    Object.values(materials).forEach((mat) => (mat as any).dispose());`,
            );
          }

          const disposeBlock = [
            `  useEffect(() => {`,
            `    return () => {`,
            ...disposeLines,
            `    };`,
            `  }, [${[hasNodes ? "nodes" : "", hasMaterials ? "materials" : ""].filter(Boolean).join(", ")}]);`,
          ].join("\n");

          const returnIdx = content.indexOf("return (");
          if (returnIdx === -1) {
            const returnJsxIdx = content.indexOf("return <");
            if (returnJsxIdx !== -1) {
              content = content.slice(0, returnJsxIdx) + disposeBlock + "\n\n  " + content.slice(returnJsxIdx);
              modified = true;
            }
          } else {
            content = content.slice(0, returnIdx) + disposeBlock + "\n\n  " + content.slice(returnIdx);
            modified = true;
          }

          if (modified && !content.includes('import { useEffect') && !content.includes('import {useEffect')) {
            if (content.includes('from "react"') || content.includes("from 'react'")) {
              content = content.replace(
                /import\s+\{([^}]+)\}\s+from\s+["']react["']/,
                (match, imports) => {
                  if (imports.includes("useEffect")) return match;
                  return `import { ${imports.trim()}, useEffect } from "react"`;
                },
              );
            } else {
              content = `import { useEffect } from "react";\n` + content;
            }
          }

          if (modified) {
            fixes.push(`[${file.path}] Injected GPU disposal cleanup for useGLTF (geometry + materials)`);
          }
        }
      }
    }

    if (content.includes("meshBasicMaterial")) {
      const hasLights = content.includes("ambientLight") ||
        content.includes("directionalLight") ||
        content.includes("pointLight") ||
        content.includes("spotLight") ||
        content.includes("Environment") ||
        content.includes("Light");

      if (hasLights) {
        content = content.replace(/meshBasicMaterial/g, "meshStandardMaterial");
        fixes.push(`[${file.path}] Replaced meshBasicMaterial with meshStandardMaterial in lit scene (prevents invisible mesh hallucination)`);
        modified = true;
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixCommandSchemaExhaustive(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const hasCommandTypes = files.some(
    f => (f.path.includes("types/commands") || f.path.includes("commands.ts")) &&
      f.content.includes("CommandAction"),
  );
  if (!hasCommandTypes) return { files, fixes };

  const COMMAND_BUS_MODULE = `import type { CommandAction, CommandEnvelope } from "../types/commands";

let history: CommandEnvelope[] = [];
let future: CommandEnvelope[] = [];

export const commandBus = {
  dispatch(command: CommandAction, source: "editor" | "ai" = "editor"): CommandEnvelope {
    const envelope: CommandEnvelope = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source,
      command,
    };
    history.push(envelope);
    future = [];
    return envelope;
  },
  undo(): CommandEnvelope | undefined {
    const last = history.pop();
    if (last) { future.push(last); }
    return last;
  },
  redo(): CommandEnvelope | undefined {
    const next = future.pop();
    if (next) { history.push(next); }
    return next;
  },
  getHistory(): CommandEnvelope[] { return [...history]; },
  clear() { history = []; future = []; },
};
`;

  const updatedFiles = [...files];

  const hasCommandBus = files.some(
    f => f.path === "client/src/lib/command-bus.ts" && f.content.includes("commandBus"),
  );
  if (!hasCommandBus && files.some(f => f.path.startsWith("client/"))) {
    updatedFiles.push({
      path: "client/src/lib/command-bus.ts",
      content: COMMAND_BUS_MODULE,
    });
    fixes.push("[client/src/lib/command-bus.ts] Injected command bus with undo/redo history stack");
  }

  const result = updatedFiles.map(file => {
    if (!file.path.match(/\.[tj]sx?$/) || file.path.endsWith(".d.ts")) return file;
    if (!file.content.includes("switch") || !file.content.includes(".action")) return file;

    let content = file.content;
    let modified = false;

    const switchRegex = /switch\s*\(\s*\w+\.action\s*\)\s*\{/g;
    let switchMatch: RegExpExecArray | null;

    while ((switchMatch = switchRegex.exec(content)) !== null) {
      const switchStart = switchMatch.index + switchMatch[0].length;
      let braceDepth = 1;
      let pos = switchStart;
      while (pos < content.length && braceDepth > 0) {
        if (content[pos] === "{") braceDepth++;
        if (content[pos] === "}") braceDepth--;
        pos++;
      }
      const switchBody = content.slice(switchStart, pos - 1);

      if (!switchBody.includes("default:") && !switchBody.includes("default :")) {
        const indent = (content.slice(0, switchMatch.index).match(/(?:^|\n)([ \t]*)$/)?.[1] || "") + "  ";
        const defaultBranch = `\n${indent}default: { const _exhaustive: never = command; console.error("Unhandled command:", (_exhaustive as any).action); break; }`;
        content = content.slice(0, pos - 1) + defaultBranch + "\n" + content.slice(pos - 1);
        fixes.push(`[${file.path}] Injected exhaustive default:never guard in command action switch`);
        modified = true;
        break;
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixConversationalArchitect(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const hasCommandTypes = files.some(
    f => (f.path.includes("types/commands") || f.path.includes("commands.ts")) &&
      f.content.includes("CommandAction"),
  );
  const hasAIRoute = files.some(
    f => f.path.includes("ai-command") || (f.path.startsWith("client/") && f.content.includes("parseNaturalLanguage")),
  );
  if (!hasCommandTypes || !hasAIRoute) return { files, fixes };

  const updatedFiles = [...files];

  const hasNLParser = files.some(
    f => f.path === "client/src/lib/nl-command-parser.ts" && f.content.includes("parseNaturalLanguage"),
  );
  if (!hasNLParser && files.some(f => f.path.startsWith("client/"))) {
    const commandsFile = files.find(f => f.path.includes("types/commands") && f.content.includes("CommandAction"));
    const actionMatches = commandsFile?.content.match(/"([A-Z_]+)"/g) || [];
    const actions = [...new Set(actionMatches.map(a => a.replace(/"/g, "")))];
    const validActionsStr = actions.length > 0
      ? actions.map(a => `"${a}"`).join(", ")
      : `"SPAWN_ASSET", "DELETE_NODE", "TRANSFORM_NODE", "UPDATE_MATERIAL", "SET_ENVIRONMENT", "SNAPSHOT_STATE", "UNDO", "REDO"`;

    const nlParserModule = `import type { CommandAction } from "../types/commands";
import { commandBus } from "./command-bus";

const VALID_ACTIONS = [${validActionsStr}] as const;

export async function parseNaturalLanguage(
  text: string,
): Promise<{ success: boolean; command?: CommandAction; error?: string }> {
  try {
    const res = await fetch(
      \`\${import.meta.env.VITE_API_URL || ""}/api/ai-command\`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.error || "Request failed" };
    }
    const { command } = (await res.json()) as { command: CommandAction };
    if (!command?.action || !VALID_ACTIONS.includes(command.action as any)) {
      return { success: false, error: \`Unknown action: \${(command as any)?.action}\` };
    }
    commandBus.dispatch(command, "ai");
    return { success: true, command };
  } catch (error: unknown) {
    return { success: false, error: "Network error" };
  }
}
`;
    updatedFiles.push({
      path: "client/src/lib/nl-command-parser.ts",
      content: nlParserModule,
    });
    fixes.push("[client/src/lib/nl-command-parser.ts] Injected NL command parser with VALID_ACTIONS guard and command bus integration");
  }

  const result = updatedFiles.map(file => {
    if (!file.path.startsWith("server/") || !file.path.match(/\.[tj]sx?$/)) return file;
    if (!file.path.includes("ai-command")) return file;
    if (!file.content.includes("JSON.parse")) return file;

    let content = file.content;
    let modified = false;

    if (content.includes("JSON.parse") && !content.includes(".replace(")) {
      content = content.replace(
        /const\s+(\w+)\s*(?::\s*\w+)?\s*=\s*JSON\.parse\s*\(\s*(\w+)\s*\)/g,
        (match, varName, inputVar) => {
          modified = true;
          return `const cleaned = ${inputVar}.replace(/^\\\`\\\`\\\`json?\\n?/, "").replace(/\\n?\\\`\\\`\\\`$/, "").trim();\n      const ${varName} = JSON.parse(cleaned)`;
        },
      );
      if (modified) {
        fixes.push(`[${file.path}] Injected markdown fence stripping before JSON.parse for AI response safety`);
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixPerformanceWall(
  files: Array<{ path: string; content: string }>,
): HardenerResult {
  const fixes: string[] = [];

  const hasR3F = files.some(
    f => f.path.startsWith("client/") &&
      (f.content.includes("@react-three/fiber") || f.content.includes("<Canvas")),
  );
  if (!hasR3F) return { files, fixes };

  const PERF_MODULE = `export const PERF_LIMITS = {
  INSTANCE_THRESHOLD: 5,
  MAX_DRAW_CALLS: 100,
  LOD_DISTANCES: [0, 50, 150] as const,
  ADAPTIVE_DPR: [0.5, 2] as [number, number],
} as const;
`;

  const updatedFiles = [...files];

  const hasPerfFile = files.some(
    f => f.path === "client/src/lib/performance-wall.ts" && f.content.includes("PERF_LIMITS"),
  );
  if (!hasPerfFile) {
    updatedFiles.push({
      path: "client/src/lib/performance-wall.ts",
      content: PERF_MODULE,
    });
    fixes.push("[client/src/lib/performance-wall.ts] Injected performance wall constants (instance threshold, LOD distances, adaptive DPR range)");
  }

  const result = updatedFiles.map(file => {
    if (!file.path.startsWith("client/") || !file.path.endsWith(".tsx")) return file;

    let content = file.content;
    let modified = false;
    const neededDreiImports: string[] = [];

    if (content.includes(".map(") && content.includes("<mesh") &&
      !content.includes("<Instances") && !content.includes("instancedMesh")) {
      const pattern = /\{(\w+)\.map\(\s*\((\w+)[^)]*\)\s*=>\s*\(?\s*\n?\s*<mesh\b([\s\S]*?)>([\s\S]*?)<\/mesh>\s*\)?\s*\)\}/;
      const match = content.match(pattern);

      if (match) {
        const [fullMatch, arrayName, itemVar, meshProps, meshChildren] = match;

        const geoExtract = meshProps.match(/geometry=\{([^}]+)\}/);
        const geoProp = geoExtract ? ` geometry={${geoExtract[1]}}` : "";

        const inlineGeo = meshChildren.match(/<(\w+Geometry)\s*([^/]*?)\s*\/?>/);
        const geoChild = inlineGeo
          ? `\n      <${inlineGeo[1]} ${inlineGeo[2].trim()}/>`
          : "";

        const matExtract = meshChildren.match(/<(mesh\w+Material)\s*([^/]*?)\s*\/?>/);
        let matChild = "";
        if (matExtract) {
          const sharedProps = matExtract[2]
            .replace(new RegExp(`color=\\{${itemVar}\\.\\w+\\}`, "g"), "")
            .trim();
          matChild = `\n      <${matExtract[1]}${sharedProps ? " " + sharedProps : ""} />`;
        }

        let instanceProps = meshProps
          .replace(/geometry=\{[^}]+\}\s*/g, "")
          .replace(/\n\s*/g, " ")
          .trim();

        const colorMatch = meshChildren.match(new RegExp(`color=\\{${itemVar}\\.(\\w+)\\}`));
        if (colorMatch) {
          instanceProps += ` color={${itemVar}.${colorMatch[1]}}`;
        }

        const replacement = `<Instances limit={${arrayName}.length}${geoProp}>${geoChild}${matChild}\n      {${arrayName}.map((${itemVar}) => (\n        <Instance ${instanceProps} />\n      ))}\n    </Instances>`;

        content = content.replace(fullMatch, replacement);
        modified = true;
        neededDreiImports.push("Instances", "Instance");
        fixes.push(`[${file.path}] Promoted .map() mesh loop to <Instances>/<Instance> for GPU instancing (1 draw call)`);
      }
    }

    if (content.includes("useGLTF") && !content.includes("<Canvas") && !content.includes("<Detailed")) {
      const returnMatch = content.match(/return\s*\(\s*\n(\s*)([\s\S]*?)(\n\s*\);)/);
      if (returnMatch) {
        const [fullReturn, indent, jsx, closing] = returnMatch;
        const innerIndent = indent + "  ";
        const lodProxy = `\n${innerIndent}<mesh>\n${innerIndent}  <boxGeometry args={[1, 1, 1]} />\n${innerIndent}  <meshStandardMaterial wireframe />\n${innerIndent}</mesh>`;
        const replacement = `return (\n${indent}<Detailed distances={[0, 50]}>\n${innerIndent}${jsx.trim()}\n${innerIndent}${lodProxy.trim()}\n${indent}</Detailed>${closing}`;
        content = content.replace(fullReturn, replacement);
        modified = true;
        neededDreiImports.push("Detailed");
        fixes.push(`[${file.path}] Wrapped useGLTF return in <Detailed> LOD with wireframe proxy at distance 50`);
      }
    }

    if (content.includes("<Canvas") && !content.includes("AdaptiveDpr")) {
      const canvasMatch = content.match(/<Canvas\b([\s\S]*?)>/);
      if (canvasMatch) {
        content = content.replace(
          /<Canvas\b([\s\S]*?)>/,
          `<Canvas$1>\n        <AdaptiveDpr pixelated />\n        <AdaptiveEvents />`,
        );
        modified = true;
        neededDreiImports.push("AdaptiveDpr", "AdaptiveEvents");
        fixes.push(`[${file.path}] Injected AdaptiveDpr + AdaptiveEvents for adaptive GPU scaling`);
      }
    }

    if (neededDreiImports.length > 0 && modified) {
      const unique = [...new Set(neededDreiImports)];
      const dreiImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+["']@react-three\/drei["']/);
      if (dreiImportMatch) {
        const existing = dreiImportMatch[1].split(",").map(s => s.trim());
        const toAdd = unique.filter(u => !existing.includes(u));
        if (toAdd.length > 0) {
          content = content.replace(
            dreiImportMatch[0],
            `import { ${existing.join(", ")}, ${toAdd.join(", ")} } from "@react-three/drei"`,
          );
        }
      } else {
        const lastImport = content.lastIndexOf("\nimport ");
        if (lastImport !== -1) {
          const lineEnd = content.indexOf("\n", lastImport + 1);
          content = content.slice(0, lineEnd + 1) +
            `import { ${unique.join(", ")} } from "@react-three/drei";\n` +
            content.slice(lineEnd + 1);
        } else {
          content = `import { ${unique.join(", ")} } from "@react-three/drei";\n` + content;
        }
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function getRelativeImportPath(fromPath: string, toPath: string): string {
  const fromParts = fromPath.split("/").slice(0, -1);
  const toParts = toPath.split("/");
  const toFile = toParts.pop()!.replace(/\.ts$/, "");

  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }

  const ups = fromParts.length - common;
  const prefix = ups === 0 ? "./" : "../".repeat(ups);
  const remaining = toParts.slice(common);
  return prefix + [...remaining, toFile].join("/");
}
