const SKIP_FILES = new Set([
  "package.json", "vite.config.ts", "vite.config.js",
  "tsconfig.json", "tsconfig.node.json",
  "postcss.config.js", "tailwind.config.js", "tailwind.config.ts",
]);

export function prepareSandpackFiles(files: Array<{ path: string; content: string }>) {
  const sandpackFiles: Record<string, { code: string; active?: boolean }> = {};

  const clientFiles = files.filter((f) => f.path.startsWith("client/"));
  const hasClient = clientFiles.length > 0;
  const sourceFiles = hasClient ? clientFiles : files;
  const basePrefix = hasClient ? "client/" : "";

  for (const file of sourceFiles) {
    let filePath = file.path;
    if (basePrefix && filePath.startsWith(basePrefix)) {
      filePath = filePath.slice(basePrefix.length);
    }
    if (filePath.startsWith("src/")) {
      filePath = filePath.slice(4);
    }
    if (SKIP_FILES.has(filePath)) continue;
    if (filePath === "public/index.html" || filePath === "index.html") continue;

    sandpackFiles[`/${filePath}`] = { code: file.content };
  }

  const appEntry = sandpackFiles["/App.tsx"] || sandpackFiles["/App.jsx"];
  if (appEntry) {
    appEntry.active = true;
  }

  return { files: sandpackFiles };
}

export const SANDPACK_THEME = {
  colors: {
    surface1: "#12121a",
    surface2: "#1a1a24",
    surface3: "#22222e",
    clickable: "#71717a",
    base: "#e4e4e7",
    disabled: "#3f3f46",
    hover: "#22d3ee",
    accent: "#22d3ee",
    error: "#f87171",
    errorSurface: "#2a1515",
  },
  syntax: {
    plain: "#e4e4e7",
    comment: { color: "#52525b", fontStyle: "italic" as const },
    keyword: "#c084fc",
    tag: "#22d3ee",
    punctuation: "#71717a",
    definition: "#4ade80",
    property: "#60a5fa",
    static: "#f59e0b",
    string: "#34d399",
  },
  font: {
    body: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
    mono: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
    size: "13px",
    lineHeight: "1.6",
  },
};
