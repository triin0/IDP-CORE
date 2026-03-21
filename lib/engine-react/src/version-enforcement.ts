const MANDATED_SERVER_DEPS: Record<string, string> = {
  "express": "^5.1.0",
  "helmet": "^8.1.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.5.0",
  "zod": "^3.25.0",
  "drizzle-orm": "^0.44.0",
  "drizzle-zod": "^0.7.0",
  "pg": "^8.16.0",
  "dotenv": "^16.5.0",
  "bcryptjs": "^2.4.3",
  "cookie-parser": "^1.4.7",
  "jsonwebtoken": "^9.0.2",
};

const MANDATED_SERVER_DEV_DEPS: Record<string, string> = {
  "typescript": "^5.8.0",
  "tsx": "^4.19.0",
  "drizzle-kit": "^0.31.0",
  "@types/express": "^5.0.0",
  "@types/cors": "^2.8.17",
  "@types/pg": "^8.11.0",
};

const MANDATED_CLIENT_DEPS: Record<string, string> = {
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "react-router-dom": "^7.6.0",
  "framer-motion": "^11.18.0",
};

const MANDATED_CLIENT_DEV_DEPS: Record<string, string> = {
  "vite": "^6.3.0",
  "@vitejs/plugin-react": "^4.5.0",
  "@tailwindcss/vite": "^4.1.0",
  "typescript": "^5.8.0",
  "@types/react": "^19.1.0",
  "@types/react-dom": "^19.1.0",
};

const TYPES_MAP: Record<string, string> = {
  "cookie-parser": "@types/cookie-parser",
  
  "jsonwebtoken": "@types/jsonwebtoken",
  "express-session": "@types/express-session",
  "compression": "@types/compression",
  "morgan": "@types/morgan",
  "multer": "@types/multer",
};

const KNOWN_GOOD_VERSIONS: Record<string, string> = {
  "three": "^0.172.0",
  "@react-three/fiber": "^9.1.0",
  "@react-three/drei": "^10.0.0",
  "@types/three": "^0.172.0",
  "leva": "^0.10.0",
  "zustand": "^5.0.0",
  "@gltf-transform/core": "^4.1.0",
  "@gltf-transform/functions": "^4.1.0",
  "socket.io": "^4.8.0",
  "socket.io-client": "^4.8.0",
};

const BANNED_PACKAGES = ["@libsql/client", "better-sqlite3", "mysql2", "axios", "express-async-errors"];

const PACKAGE_SUBSTITUTIONS: Record<string, { replacement: string; version: string }> = {
  "postgres": { replacement: "pg", version: "^8.16.0" },
  "better-sqlite3": { replacement: "pg", version: "^8.16.0" },
  "mysql2": { replacement: "pg", version: "^8.16.0" },
};

interface ImportRewriteRule {
  fromModule: string;
  toModule: string;
  importRewrite: (line: string) => string;
  drizzleAdapterFrom: string;
  drizzleAdapterTo: string;
  bodyRewrite: (content: string) => string;
}

const IMPORT_REWRITE_RULES: ImportRewriteRule[] = [
  {
    fromModule: "postgres",
    toModule: "pg",
    drizzleAdapterFrom: "drizzle-orm/postgres-js",
    drizzleAdapterTo: "drizzle-orm/node-postgres",
    importRewrite: (_line: string) => {
      return 'import { Pool } from "pg";';
    },
    bodyRewrite: (content: string) => {
      let result = content;

      result = result.replace(
        /import\s*\{\s*drizzle\s*\}\s*from\s*["']drizzle-orm\/postgres-js["']/g,
        'import { drizzle } from "drizzle-orm/node-postgres"'
      );

      result = result.replace(
        /(?:const|let|var)\s+(\w+)\s*=\s*(\w+)\s*\(\s*([\s\S]*?)\)\s*;/g,
        (match, varName, funcName, args) => {
          if (funcName === "drizzle" || funcName === "Pool" || funcName === "require") return match;
          if (result.includes(`import ${funcName}`) || funcName === "postgres" || funcName === "sql") {
            const cleanArgs = args.trim();
            if (cleanArgs.startsWith("{")) {
              return `const ${varName} = new Pool(${cleanArgs});`;
            }
            return `const ${varName} = new Pool({ connectionString: ${cleanArgs} });`;
          }
          return match;
        }
      );

      return result;
    },
  },
  {
    fromModule: "better-sqlite3",
    toModule: "pg",
    drizzleAdapterFrom: "drizzle-orm/better-sqlite3",
    drizzleAdapterTo: "drizzle-orm/node-postgres",
    importRewrite: () => 'import { Pool } from "pg";',
    bodyRewrite: (content: string) => {
      let result = content;
      result = result.replace(
        /import\s*\{\s*drizzle\s*\}\s*from\s*["']drizzle-orm\/better-sqlite3["']/g,
        'import { drizzle } from "drizzle-orm/node-postgres"'
      );
      result = result.replace(
        /import\s+Database\s+from\s+["']better-sqlite3["']/g,
        'import { Pool } from "pg"'
      );
      result = result.replace(
        /new\s+Database\s*\(\s*(.*?)\s*\)/g,
        'new Pool({ connectionString: process.env.DATABASE_URL })'
      );
      return result;
    },
  },
  {
    fromModule: "mysql2",
    toModule: "pg",
    drizzleAdapterFrom: "drizzle-orm/mysql2",
    drizzleAdapterTo: "drizzle-orm/node-postgres",
    importRewrite: () => 'import { Pool } from "pg";',
    bodyRewrite: (content: string) => {
      let result = content;
      result = result.replace(
        /import\s*\{\s*drizzle\s*\}\s*from\s*["']drizzle-orm\/mysql2["']/g,
        'import { drizzle } from "drizzle-orm/node-postgres"'
      );
      result = result.replace(
        /import\s+\w+\s+from\s+["']mysql2(?:\/promise)?["']\s*;?/g,
        'import { Pool } from "pg";'
      );
      result = result.replace(
        /import\s*\{[^}]*\}\s*from\s+["']mysql2(?:\/promise)?["']\s*;?/g,
        'import { Pool } from "pg";'
      );
      result = result.replace(
        /\w+\.createPool\s*\(\s*([\s\S]*?)\s*\)/g,
        'new Pool({ connectionString: process.env.DATABASE_URL })'
      );
      result = result.replace(
        /\w+\.createConnection\s*\(\s*([\s\S]*?)\s*\)/g,
        'new Pool({ connectionString: process.env.DATABASE_URL })'
      );
      return result;
    },
  },
];

const SIDE_EFFECT_BANNED = ["express-async-errors"];

const AXIOS_REWRITE: { pattern: RegExp; replacement: string }[] = [
  { pattern: /import\s+axios\s+from\s+["']axios["']\s*;?/g, replacement: "" },
  { pattern: /import\s*\{\s*[^}]*\}\s*from\s+["']axios["']\s*;?/g, replacement: "" },
  { pattern: /axios\.get\s*\(\s*(.*?)\s*\)/g, replacement: "fetch($1).then(r => r.json())" },
  { pattern: /axios\.post\s*\(\s*(.*?),\s*(.*?)\s*\)/g, replacement: 'fetch($1, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify($2) }).then(r => r.json())' },
  { pattern: /axios\.put\s*\(\s*(.*?),\s*(.*?)\s*\)/g, replacement: 'fetch($1, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify($2) }).then(r => r.json())' },
  { pattern: /axios\.delete\s*\(\s*(.*?)\s*\)/g, replacement: 'fetch($1, { method: "DELETE" }).then(r => r.json())' },
];

function enforceVersions(
  pkg: Record<string, unknown>,
  mandatedDeps: Record<string, string>,
  mandatedDevDeps: Record<string, string>,
): { modified: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let modified = false;

  const deps = (pkg.dependencies || {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies || {}) as Record<string, string>;

  for (const [name, version] of Object.entries(mandatedDeps)) {
    if (!deps[name]) {
      fixes.push(`Added missing ${name}@${version}`);
      deps[name] = version;
      modified = true;
    } else if (deps[name] !== version) {
      fixes.push(`${name}: ${deps[name]} → ${version}`);
      deps[name] = version;
      modified = true;
    }
  }

  for (const [name, version] of Object.entries(mandatedDevDeps)) {
    if (!devDeps[name]) {
      fixes.push(`Added missing ${name}@${version} (dev)`);
      devDeps[name] = version;
      modified = true;
    } else if (devDeps[name] !== version) {
      fixes.push(`${name} (dev): ${devDeps[name]} → ${version}`);
      devDeps[name] = version;
      modified = true;
    }
  }

  for (const [wrongPkg, sub] of Object.entries(PACKAGE_SUBSTITUTIONS)) {
    if (deps[wrongPkg]) {
      fixes.push(`Substituted ${wrongPkg} → ${sub.replacement}@${sub.version}`);
      delete deps[wrongPkg];
      deps[sub.replacement] = sub.version;
      modified = true;
    }
  }

  for (const banned of BANNED_PACKAGES) {
    if (deps[banned]) {
      fixes.push(`Removed banned package: ${banned}`);
      delete deps[banned];
      modified = true;
    }
    if (devDeps[banned]) {
      fixes.push(`Removed banned devDependency: ${banned}`);
      delete devDeps[banned];
      modified = true;
    }
  }

  for (const [pkg_name, typePkg] of Object.entries(TYPES_MAP)) {
    if (deps[pkg_name] && !devDeps[typePkg]) {
      devDeps[typePkg] = "latest";
      fixes.push(`Added missing ${typePkg} for ${pkg_name}`);
      modified = true;
    }
  }

  for (const [knownPkg, knownVersion] of Object.entries(KNOWN_GOOD_VERSIONS)) {
    if (deps[knownPkg] && deps[knownPkg] !== knownVersion) {
      fixes.push(`${knownPkg}: ${deps[knownPkg]} → ${knownVersion} (pinned)`);
      deps[knownPkg] = knownVersion;
      modified = true;
    }
    if (devDeps[knownPkg] && devDeps[knownPkg] !== knownVersion) {
      fixes.push(`${knownPkg} (dev): ${devDeps[knownPkg]} → ${knownVersion} (pinned)`);
      devDeps[knownPkg] = knownVersion;
      modified = true;
    }
  }

  if (deps["three"] && !devDeps["@types/three"]) {
    devDeps["@types/three"] = KNOWN_GOOD_VERSIONS["@types/three"];
    fixes.push("Added missing @types/three for three");
    modified = true;
  }

  if (modified) {
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
  }

  return { modified: modified || Object.keys(deps).length > 0, fixes };
}

function rewriteSourceImports(
  files: Array<{ path: string; content: string }>,
  substitutedPackages: Set<string>,
): { files: Array<{ path: string; content: string }>; fixes: string[] } {
  if (substitutedPackages.size === 0) return { files, fixes: [] };

  const fixes: string[] = [];

  const updatedFiles = files.map(file => {
    if (!file.path.match(/\.[tj]sx?$/) || file.path.endsWith(".d.ts")) return file;

    let content = file.content;
    let modified = false;

    for (const rule of IMPORT_REWRITE_RULES) {
      if (!substitutedPackages.has(rule.fromModule)) continue;

      const importPattern = new RegExp(
        `(?:import\\s+.*?from\\s+["']${rule.fromModule}(?:\\/[^"']*)?["']|require\\s*\\(\\s*["']${rule.fromModule}(?:\\/[^"']*)?["']\\s*\\))\\s*;?`,
        "g"
      );

      if (new RegExp(importPattern.source).test(content)) {
        content = content.replace(importPattern, (match) => rule.importRewrite(match));
        content = rule.bodyRewrite(content);

        const adapterPattern = new RegExp(
          `["']${rule.drizzleAdapterFrom.replace(/[/]/g, "\\/")}["']`,
          "g"
        );
        content = content.replace(adapterPattern, `"${rule.drizzleAdapterTo}"`);

        fixes.push(`[${file.path}] Rewrote ${rule.fromModule} → ${rule.toModule} imports + API usage`);
        modified = true;
      }
    }

    if (substitutedPackages.has("axios") || content.includes("from \"axios\"") || content.includes("from 'axios'")) {
      for (const { pattern, replacement } of AXIOS_REWRITE) {
        const before = content;
        content = content.replace(pattern, replacement);
        if (content !== before) modified = true;
      }
      if (modified && !fixes.some(f => f.includes(file.path) && f.includes("axios"))) {
        fixes.push(`[${file.path}] Replaced axios calls with native fetch()`);
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: updatedFiles, fixes };
}

function detectSubstitutedPackages(
  files: Array<{ path: string; content: string }>,
): Set<string> {
  const substituted = new Set<string>();

  for (const file of files) {
    if (!file.path.match(/\.[tj]sx?$/) || file.path.endsWith(".d.ts")) continue;

    const lines = file.content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

      for (const rule of IMPORT_REWRITE_RULES) {
        const modulePattern = new RegExp(`["']${rule.fromModule}(?:/[^"']*)?["']`);
        if (modulePattern.test(trimmed) && (trimmed.includes("import") || trimmed.includes("require"))) {
          substituted.add(rule.fromModule);
        }
      }

      if (/["']axios["']/.test(trimmed) && (trimmed.includes("import") || trimmed.includes("require"))) {
        substituted.add("axios");
      }
    }
  }

  return substituted;
}

function fixDrizzleColumnTypes(
  files: Array<{ path: string; content: string }>,
): { files: Array<{ path: string; content: string }>; fixes: string[] } {
  const fixes: string[] = [];
  const updatedFiles = files.map(file => {
    if (!file.path.includes("schema") || !file.path.match(/\.[tj]sx?$/)) return file;
    let content = file.content;
    let modified = false;

    if (/\bfloat\b/.test(content) && content.includes("drizzle-orm/pg-core")) {
      content = content.replace(
        /(import\s*\{[^}]*)\bfloat\b([^}]*\}\s*from\s*["']drizzle-orm\/pg-core["'])/g,
        (_, before, after) => `${before}doublePrecision${after}`
      );
      content = content.replace(/\bfloat\s*\(/g, "doublePrecision(");
      fixes.push(`[${file.path}] Replaced 'float' with 'doublePrecision' (pg-core)`);
      modified = true;
    }

    return modified ? { path: file.path, content } : file;
  });
  return { files: updatedFiles, fixes };
}

export function enforcePackageVersions(
  files: Array<{ path: string; content: string }>,
): { files: Array<{ path: string; content: string }>; fixes: string[] } {
  const allFixes: string[] = [];

  const bannedInSource = detectSubstitutedPackages(files);

  let updatedFiles = files.map(file => {
    if (!file.path.endsWith("package.json")) return file;

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(file.content);
    } catch {
      return file;
    }

    const isServer = file.path.includes("server");
    const isClient = file.path.includes("client");

    if (!isServer && !isClient) return file;

    const mandatedDeps = isServer ? MANDATED_SERVER_DEPS : MANDATED_CLIENT_DEPS;
    const mandatedDevDeps = isServer ? MANDATED_SERVER_DEV_DEPS : MANDATED_CLIENT_DEV_DEPS;

    const { modified, fixes } = enforceVersions(pkg, mandatedDeps, mandatedDevDeps);

    if (modified) {
      allFixes.push(...fixes.map(f => `[${file.path}] ${f}`));
      return { path: file.path, content: JSON.stringify(pkg, null, 2) + "\n" };
    }

    return file;
  });

  if (bannedInSource.size > 0) {
    const importResult = rewriteSourceImports(updatedFiles, bannedInSource);
    updatedFiles = importResult.files;
    allFixes.push(...importResult.fixes);
  }

  const drizzleResult = fixDrizzleColumnTypes(updatedFiles);
  updatedFiles = drizzleResult.files;
  allFixes.push(...drizzleResult.fixes);

  updatedFiles = updatedFiles.map(file => {
    if (!file.path.match(/\.[tj]sx?$/) || file.path.endsWith(".d.ts")) return file;
    let content = file.content;
    let modified = false;
    for (const pkg of SIDE_EFFECT_BANNED) {
      const re = new RegExp(
        `^\\s*(?:import\\s+["']${pkg}["']|require\\s*\\(\\s*["']${pkg}["']\\s*\\))\\s*;?\\s*$`,
        "gm"
      );
      const before = content;
      content = content.replace(re, "");
      if (content !== before) {
        modified = true;
        allFixes.push(`[${file.path}] Removed banned side-effect import: ${pkg}`);
      }
    }
    return modified ? { path: file.path, content } : file;
  });

  return { files: updatedFiles, fixes: allFixes };
}
