const SKIP_FILES = new Set([
  "package.json", "vite.config.ts", "vite.config.js",
  "tsconfig.json", "tsconfig.node.json",
  "postcss.config.js", "tailwind.config.js", "tailwind.config.ts",
]);

interface SandpackFileEntry {
  code: string;
  active?: boolean;
  hidden?: boolean;
  readOnly?: boolean;
}

function normalizePath(filePath: string, basePrefix: string): string | null {
  let p = filePath;
  if (basePrefix && p.startsWith(basePrefix)) {
    p = p.slice(basePrefix.length);
  }
  if (p.startsWith("src/")) {
    p = p.slice(4);
  }
  if (SKIP_FILES.has(p)) return null;
  if (p === "public/index.html" || p === "index.html") return null;
  return `/${p}`;
}

export const XRAY_BRIDGE_PATH = "/__idp-xray-bridge.js";

const XRAY_BRIDGE_CODE = `
(function() {
  var active = false;
  var overlay = null;
  var tooltip = null;
  var ATTR = "data-idp-source";

  function createOverlay() {
    overlay = document.createElement("div");
    overlay.id = "__idp-xray-overlay";
    overlay.style.cssText = "position:fixed;pointer-events:none;border:2px solid #22d3ee;background:rgba(34,211,238,0.08);z-index:99999;transition:all 0.15s ease;display:none;border-radius:4px;";
    tooltip = document.createElement("div");
    tooltip.id = "__idp-xray-tooltip";
    tooltip.style.cssText = "position:fixed;pointer-events:none;z-index:100000;background:#0a0a0f;color:#22d3ee;font-family:monospace;font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid rgba(34,211,238,0.3);display:none;white-space:nowrap;";
    document.body.appendChild(overlay);
    document.body.appendChild(tooltip);
  }

  function findAnnotated(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.getAttribute && node.getAttribute(ATTR)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function onMouseMove(e) {
    if (!active || !overlay) return;
    var target = findAnnotated(e.target);
    if (target) {
      var rect = target.getBoundingClientRect();
      overlay.style.left = rect.left + "px";
      overlay.style.top = rect.top + "px";
      overlay.style.width = rect.width + "px";
      overlay.style.height = rect.height + "px";
      overlay.style.display = "block";
      var source = target.getAttribute(ATTR);
      var parts = source.split(":");
      var file = parts.slice(0, -2).join(":");
      var shortName = file.split("/").pop();
      tooltip.textContent = shortName + " :" + parts[parts.length - 2];
      tooltip.style.left = rect.left + "px";
      tooltip.style.top = Math.max(0, rect.top - 24) + "px";
      tooltip.style.display = "block";
    } else {
      overlay.style.display = "none";
      tooltip.style.display = "none";
    }
  }

  function onClick(e) {
    if (!active) return;
    var target = findAnnotated(e.target);
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      var source = target.getAttribute(ATTR);
      window.parent.postMessage({ type: "idp-xray-select", source: source }, "*");
    }
  }

  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "idp-xray-activate") {
      active = true;
      if (!overlay) createOverlay();
      document.body.style.cursor = "crosshair";
    } else if (e.data && e.data.type === "idp-xray-deactivate") {
      active = false;
      if (overlay) overlay.style.display = "none";
      if (tooltip) tooltip.style.display = "none";
      document.body.style.cursor = "";
    }
  });

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
})();
`;

export function prepareSandpackFiles(
  files: Array<{ path: string; content: string }>,
  annotatedFiles?: Array<{ path: string; content: string }>,
) {
  const sandpackFiles: Record<string, SandpackFileEntry> = {};
  const annotatedMap = new Map<string, string>();

  if (annotatedFiles) {
    for (const af of annotatedFiles) {
      annotatedMap.set(af.path, af.content);
    }
  }

  const clientFiles = files.filter((f) => f.path.startsWith("client/"));
  const hasClient = clientFiles.length > 0;
  const sourceFiles = hasClient ? clientFiles : files;
  const basePrefix = hasClient ? "client/" : "";

  for (const file of sourceFiles) {
    const sandpackPath = normalizePath(file.path, basePrefix);
    if (!sandpackPath) continue;

    const annotatedContent = annotatedMap.get(file.path);
    let code = annotatedContent ?? file.content;
    code = code.replace(/import\.meta\.env\.(\w+)/g, (_match, key) => {
      if (key === "VITE_API_URL" || key === "VITE_API_BASE_URL") return '"/api"';
      if (key === "DEV") return "true";
      if (key === "PROD") return "false";
      if (key === "MODE") return '"development"';
      if (key === "BASE_URL") return '"/"';
      return '""';
    });
    code = code.replace(/import\.meta\.env/g, '({})');
    if (sandpackPath.endsWith(".css")) {
      code = code.replace(/@import\s+["']tailwindcss["']\s*;?/g, "");
      code = code.replace(/@tailwind\s+\w+\s*;?/g, "");
    }
    sandpackFiles[sandpackPath] = { code };
  }

  const TAILWIND_CDN_PATH = "/__tailwind-cdn.js";
  const hasTailwind = clientFiles.some(f =>
    f.content.includes("tailwindcss") || f.content.includes("@tailwind")
  );
  if (hasTailwind) {
    const TAILWIND_CDN_CODE = `
if (!document.getElementById("__tw-cdn")) {
  var s = document.createElement("script");
  s.id = "__tw-cdn";
  s.src = "https://cdn.tailwindcss.com";
  document.head.appendChild(s);
  s.onload = function() {
    if (window.tailwind) {
      window.tailwind.config = {
        darkMode: "class",
        theme: { extend: { fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "monospace"] } } }
      };
    }
  };
}
`;
    sandpackFiles[TAILWIND_CDN_PATH] = { code: TAILWIND_CDN_CODE, hidden: true, readOnly: true };
  }

  const API_MOCK_PATH = "/__api-mock.js";
  const API_MOCK_CODE = `
const _origFetch = window.fetch;
window.fetch = function(url, opts) {
  if (typeof url === "string" && (url.startsWith("/api") || url.includes("/api/"))) {
    const method = (opts && opts.method || "GET").toUpperCase();
    const body = method === "GET" ? "[]" : '{"id":1,"ok":true}';
    return Promise.resolve(new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  }
  return _origFetch.apply(this, arguments);
};
`;
  sandpackFiles[API_MOCK_PATH] = { code: API_MOCK_CODE, hidden: true, readOnly: true };

  const appEntry = sandpackFiles["/App.tsx"] || sandpackFiles["/App.jsx"];
  if (appEntry) {
    appEntry.active = true;
    const injections: string[] = [];
    if (hasTailwind) injections.push(`import "${TAILWIND_CDN_PATH}";`);
    injections.push(`import "${API_MOCK_PATH}";`);
    appEntry.code = injections.join("\n") + "\n" + appEntry.code;
  }

  if (annotatedFiles && annotatedFiles.length > 0) {
    sandpackFiles[XRAY_BRIDGE_PATH] = {
      code: XRAY_BRIDGE_CODE,
      hidden: true,
      readOnly: true,
    };

    if (appEntry) {
      appEntry.code = `import "${XRAY_BRIDGE_PATH}";\n${appEntry.code}`;
    }
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
