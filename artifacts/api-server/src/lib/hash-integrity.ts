import { createHash } from "node:crypto";

export interface FileHash {
  path: string;
  sha256: string;
}

export interface HashManifest {
  hashes: FileHash[];
  computedAt: string;
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

export function computeSHA256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
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
