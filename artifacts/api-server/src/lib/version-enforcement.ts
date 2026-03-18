const MANDATED_SERVER_DEPS: Record<string, string> = {
  "express": "^5.1.0",
  "helmet": "^8.1.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.5.0",
  "zod": "^3.25.0",
  "drizzle-orm": "^0.44.0",
  "pg": "^8.16.0",
  "dotenv": "^16.5.0",
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
};

const MANDATED_CLIENT_DEV_DEPS: Record<string, string> = {
  "vite": "^6.3.0",
  "@vitejs/plugin-react": "^4.5.0",
  "typescript": "^5.8.0",
  "@types/react": "^19.1.0",
  "@types/react-dom": "^19.1.0",
};

const TYPES_MAP: Record<string, string> = {
  "cookie-parser": "@types/cookie-parser",
  "bcryptjs": "@types/bcryptjs",
  "jsonwebtoken": "@types/jsonwebtoken",
  "express-session": "@types/express-session",
  "compression": "@types/compression",
  "morgan": "@types/morgan",
  "multer": "@types/multer",
};

const BANNED_PACKAGES = ["@libsql/client", "better-sqlite3", "mysql2", "axios"];

const PACKAGE_SUBSTITUTIONS: Record<string, { replacement: string; version: string }> = {
  "postgres": { replacement: "pg", version: "^8.16.0" },
  "better-sqlite3": { replacement: "pg", version: "^8.16.0" },
  "mysql2": { replacement: "pg", version: "^8.16.0" },
};

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
    if (deps[name] && deps[name] !== version) {
      fixes.push(`${name}: ${deps[name]} → ${version}`);
      deps[name] = version;
      modified = true;
    }
  }

  for (const [name, version] of Object.entries(mandatedDevDeps)) {
    if (devDeps[name] && devDeps[name] !== version) {
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

  if (modified) {
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
  }

  return { modified, fixes };
}

export function enforcePackageVersions(
  files: Array<{ path: string; content: string }>,
): { files: Array<{ path: string; content: string }>; fixes: string[] } {
  const allFixes: string[] = [];
  const updatedFiles = files.map(file => {
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

  return { files: updatedFiles, fixes: allFixes };
}
