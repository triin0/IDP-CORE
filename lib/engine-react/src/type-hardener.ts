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

const COMMON_TYPES_MAP: Record<string, { pkg: string; version: string }> = {
  "express": { pkg: "@types/express", version: "*" },
  "cors": { pkg: "@types/cors", version: "*" },
  "cookie-parser": { pkg: "@types/cookie-parser", version: "*" },
  "bcryptjs": { pkg: "@types/bcryptjs", version: "*" },
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

  const updatedFiles = files.map(file => {
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

  for (const file of files) {
    if (!file.path.includes("server/") || !file.path.match(/\.[tj]sx?$/)) continue;
    if (file.content.includes("req.user")) {
      hasReqUser = true;
      break;
    }
  }

  if (!hasReqUser) return { files, fixes };

  const hasDeclaration = files.some(f =>
    (f.path.includes("types/") || f.path.includes(".d.ts")) &&
    f.content.includes("declare") && f.content.includes("Request") && f.content.includes("user")
  );

  if (hasDeclaration) return { files, fixes };

  const declContent = `import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: number; email: string; role: string; [key: string]: unknown };
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
        if (/^[A-Z]/.test(name)) {
          const exportCheck = new RegExp(`(?:export\\s+)?(?:interface|type|enum|class)\\s+${name}\\b`);
          if (!exportCheck.test(targetFile.content)) {
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
      stubs.push(`export interface ${name} { [key: string]: unknown; }`);
    }

    const content = file.content + "\n\n" + stubs.join("\n") + "\n";
    fixes.push(`[${file.path}] Generated stub types: ${[...missingTypes].join(", ")}`);
    return { path: file.path, content };
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

  return { files: currentFiles, fixes: allFixes };
}
