import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join, resolve, normalize } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface BuildVerificationResult {
  passed: boolean;
  description: string;
  stdout: string;
  stderr: string;
}

const BUILD_TIMEOUT_MS = 120_000;

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const keep = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "USER", "SHELL", "TERM"];
  for (const key of keep) {
    if (process.env[key]) env[key] = process.env[key]!;
  }
  env["NODE_ENV"] = "development";
  env["npm_config_loglevel"] = "error";
  return env;
}

function extractTscErrors(combined: string): string {
  const lines = combined.split("\n");
  const errorLines = lines.filter(
    (l) =>
      l.includes("error TS") ||
      l.includes("Cannot find") ||
      l.includes("has no exported member") ||
      l.includes("is not assignable") ||
      l.includes("is not a module") ||
      l.includes("has no default export") ||
      l.includes("Type '") ||
      l.includes("Argument of type") ||
      l.includes("Expected") ||
      (l.includes("Property '") && l.includes("does not exist")) ||
      (l.includes("Module '") && l.includes("has no")) ||
      (l.includes(": error") && !l.startsWith("npm"))
  );
  if (errorLines.length > 0) {
    return errorLines.slice(0, 30).join("\n");
  }
  return lines
    .filter((l) => !l.startsWith("npm warn") && !l.startsWith("npm error") && !l.startsWith("npm notice") && l.trim().length > 0)
    .slice(0, 30)
    .join("\n");
}

async function writeProjectFiles(
  dir: string,
  files: Array<{ path: string; content: string }>,
): Promise<void> {
  const createdDirs = new Set<string>();

  const resolvedDir = resolve(dir);

  for (const file of files) {
    const normalized = normalize(file.path);
    if (normalized.startsWith("..") || normalized.startsWith("/")) {
      throw new Error(`Unsafe file path rejected: ${file.path}`);
    }

    const fullPath = resolve(dir, normalized);
    if (!fullPath.startsWith(resolvedDir)) {
      throw new Error(`Path traversal detected: ${file.path}`);
    }

    const dirPath = join(fullPath, "..");

    if (!createdDirs.has(dirPath)) {
      await mkdir(dirPath, { recursive: true });
      createdDirs.add(dirPath);
    }

    await writeFile(fullPath, file.content, "utf-8");
  }
}

export async function runBuildVerification(
  files: Array<{ path: string; content: string }>,
): Promise<BuildVerificationResult> {
  const hasPackageJson = files.some((f) => f.path === "package.json");
  if (!hasPackageJson) {
    return {
      passed: false,
      description: "No root package.json found in generated files.",
      stdout: "",
      stderr: "",
    };
  }

  const pkgFile = files.find((f) => f.path === "package.json");
  let hasBuildScript = false;
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content) as { scripts?: Record<string, string> };
      hasBuildScript = !!pkg.scripts?.build;
    } catch {
      return {
        passed: false,
        description: "Root package.json contains invalid JSON.",
        stdout: "",
        stderr: "",
      };
    }
  }

  let tempDir: string | null = null;

  try {
    tempDir = await mkdtemp(join(tmpdir(), "gp-build-"));
    await writeProjectFiles(tempDir, files);

    const env = cleanEnv();

    let installStdout = "";
    let installStderr = "";
    try {
      const installResult = await execFileAsync(
        "npm",
        ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps"],
        {
          cwd: tempDir,
          timeout: BUILD_TIMEOUT_MS,
          env,
        },
      );
      installStdout = installResult.stdout;
      installStderr = installResult.stderr;
    } catch (err: unknown) {
      const execErr = err as { stderr?: string; stdout?: string; message?: string };
      return {
        passed: false,
        description: `npm install failed: ${execErr.stderr || execErr.message || "Unknown error"}`,
        stdout: execErr.stdout ?? "",
        stderr: execErr.stderr ?? "",
      };
    }

    if (!hasBuildScript) {
      return {
        passed: true,
        description: "npm install succeeded. No build script defined — skipping build step.",
        stdout: installStdout,
        stderr: installStderr,
      };
    }

    env["NODE_ENV"] = "production";

    try {
      const buildResult = await execFileAsync("npm", ["run", "build"], {
        cwd: tempDir,
        timeout: BUILD_TIMEOUT_MS,
        env,
      });
      return {
        passed: true,
        description: "npm install and npm run build both succeeded.",
        stdout: installStdout + "\n" + buildResult.stdout,
        stderr: installStderr + "\n" + buildResult.stderr,
      };
    } catch (err: unknown) {
      const execErr = err as { stderr?: string; stdout?: string; message?: string };
      const rawStdout = execErr.stdout ?? "";
      const rawStderr = execErr.stderr ?? "";
      const combined = rawStdout + "\n" + rawStderr;
      const tscErrors = extractTscErrors(combined);
      return {
        passed: false,
        description: tscErrors
          ? `Build failed. TypeScript errors:\n${tscErrors}`
          : `Build failed: ${rawStderr.split("\n").filter(l => !l.startsWith("npm") && l.trim()).slice(0, 10).join("\n") || "Unknown error"}`,
        stdout: rawStdout,
        stderr: rawStderr,
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      passed: false,
      description: `Build verification setup failed: ${message}`,
      stdout: "",
      stderr: "",
    };
  } finally {
    if (tempDir) {
      rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
