import { eq } from "drizzle-orm";
import { db, projectsTable, type Project } from "@workspace/db";

export interface DeployResult {
  id: string;
  status: "deployed";
  deployUrl: string;
}

function getLanguageClass(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", css: "css", html: "html", sql: "sql", md: "markdown",
    yaml: "yaml", yml: "yaml", env: "bash", sh: "bash",
  };
  return map[ext] || "plaintext";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildFolderTree(files: Array<{ path: string }>): string {
  const tree: Record<string, unknown> = {};
  for (const file of files) {
    const parts = file.path.split("/");
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (i === parts.length - 1) {
        node[part] = null;
      } else {
        if (!node[part] || typeof node[part] !== "object") {
          node[part] = {};
        }
        node = node[part] as Record<string, unknown>;
      }
    }
  }
  return renderTree(tree, "", 0);
}

function renderTree(node: Record<string, unknown>, prefix: string, depth: number): string {
  const entries = Object.entries(node).sort(([a, va], [b, vb]) => {
    const aIsDir = va !== null;
    const bIsDir = vb !== null;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.localeCompare(b);
  });

  return entries
    .map(([name, value]) => {
      const indent = "  ".repeat(depth);
      const fullPath = prefix ? `${prefix}/${name}` : name;
      if (value === null) {
        return `${indent}<div class="tree-file" data-path="${escapeHtml(fullPath)}">\u{1F4C4} ${escapeHtml(name)}</div>`;
      }
      return `${indent}<div class="tree-folder">\u{1F4C1} ${escapeHtml(name)}</div>\n${renderTree(value as Record<string, unknown>, fullPath, depth + 1)}`;
    })
    .join("\n");
}

export function generatePreviewHtml(
  project: Project,
  files: Array<{ path: string; content: string }>,
  checks: Array<{ name: string; passed: boolean; description?: string }>
): string {
  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  const shortId = project.id.substring(0, 8).toUpperCase();

  const fileDataJson = JSON.stringify(
    files.map((f) => ({
      path: f.path,
      content: f.content,
      lang: getLanguageClass(f.path),
    }))
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(project.prompt ?? "Generated Project")} | IDP.CORE</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/typescript.min.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0a0f; --surface: #12121a; --border: #1e1e2e;
      --text: #e4e4e7; --text-muted: #71717a; --primary: #22d3ee;
      --success: #4ade80; --fail: #f87171;
    }
    body { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; background: var(--bg); color: var(--text); min-height: 100vh; }
    .layout { display: grid; grid-template-columns: 280px 1fr; grid-template-rows: auto 1fr; height: 100vh; }
    header { grid-column: 1 / -1; padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--surface); display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .logo { color: var(--primary); font-weight: 700; font-size: 14px; letter-spacing: 1px; }
    .project-info { flex: 1; min-width: 200px; }
    .project-title { font-size: 13px; color: var(--text); font-weight: 500; }
    .project-id { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .badge { font-size: 10px; padding: 3px 8px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px; }
    .badge-deployed { background: rgba(34,211,238,0.15); color: var(--primary); border: 1px solid rgba(34,211,238,0.3); }
    .badge-score { background: rgba(74,222,128,0.15); color: var(--success); border: 1px solid rgba(74,222,128,0.3); }
    .badges { display: flex; gap: 8px; align-items: center; }
    .sidebar { background: var(--surface); border-right: 1px solid var(--border); overflow-y: auto; padding: 12px 0; }
    .sidebar-title { font-size: 10px; color: var(--text-muted); padding: 8px 16px; letter-spacing: 1px; text-transform: uppercase; }
    .tree-file, .tree-folder { font-size: 12px; padding: 4px 16px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tree-file:hover { background: rgba(34,211,238,0.08); color: var(--primary); }
    .tree-file.active { background: rgba(34,211,238,0.12); color: var(--primary); border-right: 2px solid var(--primary); }
    .tree-folder { color: var(--text-muted); font-weight: 500; }
    .main { overflow: auto; display: flex; flex-direction: column; }
    .file-header { padding: 10px 20px; background: var(--surface); border-bottom: 1px solid var(--border); font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10; }
    .file-path { color: var(--primary); }
    .line-count { font-size: 11px; }
    .code-container { flex: 1; overflow: auto; }
    pre { margin: 0; padding: 16px 20px; font-size: 13px; line-height: 1.6; }
    code { font-family: inherit; }
    .welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); gap: 12px; }
    .welcome-icon { font-size: 48px; opacity: 0.3; }
    .welcome-text { font-size: 13px; }
    .checks-panel { padding: 16px; }
    .check-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 12px; }
    .check-pass { color: var(--success); }
    .check-fail { color: var(--fail); }
    @media (max-width: 768px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { max-height: 200px; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <header>
      <div class="logo">&gt;_ IDP.CORE</div>
      <div class="project-info">
        <div class="project-title">${escapeHtml(project.prompt ?? "Generated Project")}</div>
        <div class="project-id">ID: ${shortId} &middot; ${files.length} files</div>
      </div>
      <div class="badges">
        <span class="badge badge-deployed">DEPLOYED</span>
        <span class="badge badge-score">${passedCount}/${totalCount} CHECKS</span>
      </div>
    </header>
    <div class="sidebar">
      <div class="sidebar-title">Explorer</div>
      <div id="file-tree">${buildFolderTree(files)}</div>
      <div class="sidebar-title" style="margin-top: 16px;">Golden Path</div>
      <div class="checks-panel">
        ${checks
          .map(
            (c) =>
              `<div class="check-item ${c.passed ? "check-pass" : "check-fail"}">${c.passed ? "\u2713" : "\u2717"} ${escapeHtml(c.name)}</div>`
          )
          .join("\n        ")}
      </div>
    </div>
    <div class="main">
      <div id="file-header" class="file-header" style="display:none;">
        <span class="file-path" id="current-file"></span>
        <span class="line-count" id="line-count"></span>
      </div>
      <div id="code-container" class="code-container">
        <div class="welcome">
          <div class="welcome-icon">&lt;/&gt;</div>
          <div class="welcome-text">Select a file from the explorer to view its source code</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const files = ${fileDataJson};
    const fileMap = {};
    files.forEach(f => { fileMap[f.path] = f; });

    function showFile(filePath) {
      const file = fileMap[filePath];
      if (!file) return;
      document.querySelectorAll('.tree-file').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tree-file').forEach(el => {
        if (el.dataset.path === filePath) el.classList.add('active');
      });
      const header = document.getElementById('file-header');
      const container = document.getElementById('code-container');
      const currentFile = document.getElementById('current-file');
      const lineCount = document.getElementById('line-count');
      header.style.display = 'flex';
      currentFile.textContent = filePath;
      const lines = file.content.split('\\n').length;
      lineCount.textContent = lines + ' lines';
      container.innerHTML = '<pre><code class="language-' + file.lang + '"></code></pre>';
      const codeEl = container.querySelector('code');
      codeEl.textContent = file.content;
      hljs.highlightElement(codeEl);
    }

    document.querySelectorAll('.tree-file').forEach(el => {
      el.addEventListener('click', () => {
        showFile(el.dataset.path);
      });
    });

    if (files.length > 0) {
      const readme = files.find(f => f.path.toLowerCase().includes('readme'));
      const pkg = files.find(f => f.path.endsWith('package.json'));
      const first = readme || pkg || files[0];
      showFile(first.path);
    }
  <\/script>
</body>
</html>`;
}

export async function deployProject(project: Project): Promise<DeployResult> {
  const files = project.files as Array<{ path: string; content: string }> | null;
  if (!files || files.length === 0) {
    throw new Error("No files to deploy");
  }

  const domains = process.env["REPLIT_DOMAINS"] ?? process.env["REPLIT_DEV_DOMAIN"] ?? "localhost";
  const primaryDomain = domains.split(",")[0]?.trim() ?? "localhost";
  const protocol = primaryDomain === "localhost" ? "http" : "https";
  const deployUrl = `${protocol}://${primaryDomain}/api/projects/${project.id}/preview`;

  await db
    .update(projectsTable)
    .set({ status: "deployed", deployUrl })
    .where(eq(projectsTable.id, project.id));

  return {
    id: project.id,
    status: "deployed",
    deployUrl,
  };
}
