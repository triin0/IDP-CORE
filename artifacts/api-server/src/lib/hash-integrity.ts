import { createHash } from "node:crypto";

export interface FileHash {
  path: string;
  sha256: string;
}

export interface HashManifest {
  hashes: FileHash[];
  computedAt: string;
}

export interface FullTreeHashResult {
  manifest: HashManifest;
  payloadHash: string;
  fileCount: number;
  specComparison: {
    matched: string[];
    missing: string[];
    unexpected: string[];
    matchRatio: number;
  };
}

export function computeSHA256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function computeFullTreeManifest(
  files: Array<{ path: string; content: string }>,
): HashManifest {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  const hashes: FileHash[] = sorted.map((f) => ({
    path: f.path,
    sha256: computeSHA256(f.content),
  }));

  return {
    hashes,
    computedAt: new Date().toISOString(),
  };
}

export function computePayloadHash(manifest: HashManifest): string {
  const canonical = manifest.hashes
    .map((h) => `${h.path}:${h.sha256}`)
    .join("\n");
  return computeSHA256(canonical);
}

export function compareAgainstSpec(
  files: Array<{ path: string; content: string }>,
  specFileStructure: string[],
): FullTreeHashResult["specComparison"] {
  const actualPaths = new Set(files.map((f) => f.path));
  const expectedPaths = new Set(specFileStructure);

  const matched: string[] = [];
  const missing: string[] = [];
  const unexpected: string[] = [];

  for (const expected of expectedPaths) {
    if (actualPaths.has(expected)) {
      matched.push(expected);
    } else {
      const normalizedExpected = expected.replace(/^\/+/, "");
      if (actualPaths.has(normalizedExpected)) {
        matched.push(normalizedExpected);
      } else {
        missing.push(expected);
      }
    }
  }

  for (const actual of actualPaths) {
    const normalizedActual = actual.replace(/^\/+/, "");
    if (!expectedPaths.has(actual) && !expectedPaths.has(normalizedActual) && !expectedPaths.has(`/${normalizedActual}`)) {
      unexpected.push(actual);
    }
  }

  const total = expectedPaths.size;
  const matchRatio = total > 0 ? matched.length / total : 1;

  return { matched, missing, unexpected, matchRatio };
}

export function computeFullTreeHash(
  files: Array<{ path: string; content: string }>,
  specFileStructure?: string[],
): FullTreeHashResult {
  const manifest = computeFullTreeManifest(files);
  const payloadHash = computePayloadHash(manifest);

  const specComparison = specFileStructure && specFileStructure.length > 0
    ? compareAgainstSpec(files, specFileStructure)
    : { matched: files.map(f => f.path), missing: [], unexpected: [], matchRatio: 1 };

  return {
    manifest,
    payloadHash,
    fileCount: files.length,
    specComparison,
  };
}

const CORE_CONFIG_PATTERNS = [
  "package.json",
  "tsconfig.json",
  ".env.example",
];

function isCoreConfigFile(filePath: string): boolean {
  return CORE_CONFIG_PATTERNS.some(
    (pattern) => filePath === pattern || filePath.endsWith(`/${pattern}`),
  );
}

export function computeHashManifest(
  files: Array<{ path: string; content: string }>,
): HashManifest {
  const coreFiles = files.filter((f) => isCoreConfigFile(f.path));

  const hashes: FileHash[] = coreFiles.map((f) => ({
    path: f.path,
    sha256: computeSHA256(f.content),
  }));

  return {
    hashes,
    computedAt: new Date().toISOString(),
  };
}

export function compareHashManifests(
  current: HashManifest,
  expected: HashManifest,
): Array<{ path: string; status: "match" | "mismatch" | "missing" | "unexpected"; currentHash?: string; expectedHash?: string }> {
  const results: Array<{ path: string; status: "match" | "mismatch" | "missing" | "unexpected"; currentHash?: string; expectedHash?: string }> = [];

  const expectedMap = new Map(expected.hashes.map((h) => [h.path, h.sha256]));
  const currentMap = new Map(current.hashes.map((h) => [h.path, h.sha256]));

  for (const [path, expectedHash] of expectedMap) {
    const currentHash = currentMap.get(path);
    if (!currentHash) {
      results.push({ path, status: "missing", expectedHash });
    } else if (currentHash !== expectedHash) {
      results.push({ path, status: "mismatch", currentHash, expectedHash });
    } else {
      results.push({ path, status: "match", currentHash, expectedHash });
    }
  }

  for (const [path, currentHash] of currentMap) {
    if (!expectedMap.has(path)) {
      results.push({ path, status: "unexpected", currentHash });
    }
  }

  return results;
}
