import { ReplitConnectors } from "@replit/connectors-sdk";

let connectorsInstance: ReplitConnectors | null = null;

function getConnectors(): ReplitConnectors {
  if (!connectorsInstance) {
    connectorsInstance = new ReplitConnectors();
  }
  return connectorsInstance;
}

async function githubApi(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const connectors = getConnectors();
  const response = await connectors.proxy("github", path, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error (${response.status} ${path}): ${errorText}`);
  }

  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

export interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
}

export interface GitHubRepo {
  full_name: string;
  html_url: string;
  default_branch: string;
}

export async function getAuthenticatedUser(): Promise<GitHubUser> {
  return githubApi("/user") as Promise<GitHubUser>;
}

export async function createRepository(
  name: string,
  description: string,
  isPrivate: boolean = true,
): Promise<GitHubRepo> {
  return githubApi("/user/repos", {
    method: "POST",
    body: {
      name,
      description,
      private: isPrivate,
      auto_init: false,
    },
  }) as Promise<GitHubRepo>;
}

export async function commitFileTree(
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string }>,
  message: string,
  branch: string = "main",
): Promise<{ sha: string; htmlUrl: string }> {
  const blobs = await Promise.all(
    files.map(async (file) => {
      const blob = (await githubApi(`/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        body: {
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        },
      })) as { sha: string };

      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    }),
  );

  const tree = (await githubApi(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: { tree: blobs },
  })) as { sha: string };

  const commit = (await githubApi(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: {
      message,
      tree: tree.sha,
      parents: [],
    },
  })) as { sha: string; html_url: string };

  await githubApi(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    },
  });

  return { sha: commit.sha, htmlUrl: `https://github.com/${owner}/${repo}` };
}

export function generateVerifyWorkflow(): string {
  return `name: Zero-Trust Verification
on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript compile check
        run: npx tsc --noEmit

      - name: Build verification
        run: npm run build

      - name: Verify SHA-256 manifest
        run: |
          node -e "
            const crypto = require('crypto');
            const fs = require('fs');
            const path = require('path');
            const manifest = JSON.parse(fs.readFileSync('sha256-manifest.json', 'utf-8'));
            let passed = 0, failed = 0;
            for (const entry of manifest.hashes) {
              const content = fs.readFileSync(entry.path, 'utf-8');
              const hash = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
              if (hash === entry.sha256) { passed++; }
              else { console.error('MISMATCH:', entry.path); failed++; }
            }
            console.log('SHA-256 Verification:', passed, 'passed,', failed, 'failed');
            if (failed > 0) process.exit(1);
          "

      - name: Security header check
        run: |
          node -e "
            const fs = require('fs');
            const entryFiles = ['src/index.ts', 'src/app.ts', 'src/server.ts', 'index.ts'];
            let found = false;
            for (const f of entryFiles) {
              if (fs.existsSync(f)) {
                const content = fs.readFileSync(f, 'utf-8');
                if (content.includes('helmet')) { found = true; break; }
              }
            }
            if (!found) { console.error('WARNING: helmet not found in entry files'); }
            else { console.log('Security headers: helmet detected'); }
          "
`;
}
