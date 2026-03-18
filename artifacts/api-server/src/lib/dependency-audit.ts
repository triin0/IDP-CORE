export interface DependencyAuditResult {
  passed: boolean;
  errors: string[];
}

const FETCH_TIMEOUT_MS = 10000;
const MIN_AGE_DAYS = 30;
const MIN_WEEKLY_DOWNLOADS = 1000;

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getWeeklyDownloads(name: string): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { downloads?: number };
    return data.downloads ?? null;
  } catch {
    return null;
  }
}

async function auditPackage(name: string, version: string, errors: string[], isDevOnly: boolean = false): Promise<void> {
  const cleanVersion = version.replace(/[\^~><=]/g, "").trim();

  const npmRes = await fetchWithTimeout(`https://registry.npmjs.org/${encodeURIComponent(name)}`);

  if (npmRes.status === 404) {
    errors.push(`[Hallucination] Package '${name}' does not exist on npm.`);
    return;
  }

  if (!npmRes.ok) {
    errors.push(`[Inconclusive] Could not verify package '${name}' — npm registry returned ${npmRes.status}.`);
    return;
  }

  const npmData = (await npmRes.json()) as { time?: { created?: string } };
  const createdStr = npmData.time?.created;

  if (createdStr) {
    const ageDays = (Date.now() - new Date(createdStr).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < MIN_AGE_DAYS) {
      errors.push(
        `[Slopsquatting] Package '${name}' is suspiciously new (${Math.round(ageDays)} days old, threshold: ${MIN_AGE_DAYS} days).`,
      );
    }
  }

  const downloads = await getWeeklyDownloads(name);
  if (downloads !== null && downloads < MIN_WEEKLY_DOWNLOADS) {
    errors.push(
      `[LowPopularity] Package '${name}' has very low weekly downloads (${downloads}, threshold: ${MIN_WEEKLY_DOWNLOADS}).`,
    );
  }

  if (!isDevOnly) {
    const osvRes = await fetchWithTimeout("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: cleanVersion,
        package: { name, ecosystem: "npm" },
      }),
    });

    if (osvRes.ok) {
      const osvData = (await osvRes.json()) as { vulns?: unknown[] };
      if (osvData.vulns && osvData.vulns.length > 0) {
        errors.push(`[CVE] Package '${name}@${cleanVersion}' has known vulnerabilities in the OSV database.`);
      }
    } else {
      errors.push(`[Inconclusive] Could not check vulnerabilities for '${name}' — OSV returned ${osvRes.status}.`);
    }
  }
}

export async function validateDependencies(packageJsonString: string): Promise<DependencyAuditResult> {
  const errors: string[] = [];

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(packageJsonString);
  } catch {
    return { passed: false, errors: ["Golden Path #10: Invalid package.json format generated."] };
  }

  const prodDeps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  const allDeps = { ...devDeps, ...prodDeps };
  if (Object.keys(allDeps).length === 0) return { passed: true, errors: [] };

  await Promise.all(
    Object.entries(allDeps).map(async ([name, version]) => {
      try {
        const isDevOnly = !(name in prodDeps);
        await auditPackage(name, version as string, errors, isDevOnly);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Dependency Audit] Failed to validate package ${name}:`, message);
        errors.push(`[Inconclusive] Audit failed for '${name}': ${message}`);
      }
    }),
  );

  return {
    passed: errors.length === 0,
    errors,
  };
}

export async function validateAllManifests(
  files: Array<{ path: string; content: string }>,
): Promise<DependencyAuditResult> {
  const manifests = files.filter((f) => f.path.endsWith("package.json"));

  if (manifests.length === 0) {
    return { passed: true, errors: [] };
  }

  const allErrors: string[] = [];

  for (const manifest of manifests) {
    const result = await validateDependencies(manifest.content);
    if (!result.passed) {
      allErrors.push(...result.errors.map((e) => `[${manifest.path}] ${e}`));
    }
  }

  return {
    passed: allErrors.length === 0,
    errors: allErrors,
  };
}
