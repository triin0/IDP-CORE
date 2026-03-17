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

    let installStdout = "";
    let installStderr = "";
    try {
      const installResult = await execFileAsync(
        "npm",
        ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
        {
          cwd: tempDir,
          timeout: BUILD_TIMEOUT_MS,
          env: { ...process.env, NODE_ENV: "development" },
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

    try {
      const buildResult = await execFileAsync("npm", ["run", "build"], {
        cwd: tempDir,
        timeout: BUILD_TIMEOUT_MS,
        env: { ...process.env, NODE_ENV: "production" },
      });
      return {
        passed: true,
        description: "npm install and npm run build both succeeded.",
        stdout: installStdout + "\n" + buildResult.stdout,
        stderr: installStderr + "\n" + buildResult.stderr,
      };
    } catch (err: unknown) {
      const execErr = err as { stderr?: string; stdout?: string; message?: string };
      return {
        passed: false,
        description: `npm run build failed: ${execErr.stderr || execErr.message || "Unknown error"}`,
        stdout: execErr.stdout ?? "",
        stderr: execErr.stderr ?? "",
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
