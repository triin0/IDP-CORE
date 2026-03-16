import { Copy, CheckCircle2 } from "lucide-react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeViewerProps {
  content: string;
  path: string;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  md: "markdown",
  css: "css",
  html: "html",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  env: "bash",
  prisma: "prisma",
  graphql: "graphql",
  toml: "toml",
  xml: "xml",
  py: "python",
  go: "go",
  rs: "rust",
  dockerfile: "docker",
};

function detectLanguage(path: string): string {
  const filename = path.split("/").pop() || "";
  const lower = filename.toLowerCase();

  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return "docker";
  if (lower === "makefile") return "makefile";
  if (lower.startsWith(".env")) return "bash";

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_LANG[ext] || "text";
}

function getLanguageLabel(lang: string): string {
  const labels: Record<string, string> = {
    typescript: "TypeScript",
    tsx: "TSX",
    javascript: "JavaScript",
    jsx: "JSX",
    json: "JSON",
    markdown: "Markdown",
    css: "CSS",
    html: "HTML",
    yaml: "YAML",
    sql: "SQL",
    bash: "Shell",
    prisma: "Prisma",
    graphql: "GraphQL",
    python: "Python",
    go: "Go",
    rust: "Rust",
    docker: "Docker",
    text: "Plain Text",
  };
  return labels[lang] || lang.toUpperCase();
}

const customStyle: Record<string, React.CSSProperties> = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...(oneDark['pre[class*="language-"]'] as React.CSSProperties),
    background: "transparent",
    margin: 0,
    padding: "1rem",
    fontSize: "13px",
    lineHeight: "1.6",
  },
  'code[class*="language-"]': {
    ...(oneDark['code[class*="language-"]'] as React.CSSProperties),
    background: "transparent",
    fontSize: "13px",
    lineHeight: "1.6",
  },
};

export function CodeViewer({ content, path }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const language = useMemo(() => detectLanguage(path), [path]);
  const languageLabel = useMemo(() => getLanguageLabel(language), [language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = content ? content.split("\n").length : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-zinc-400">
            {path || "Select a file to view"}
          </span>
          {content && (
            <>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                {languageLabel}
              </span>
              <span className="text-[10px] font-mono text-zinc-600">
                {lineCount} lines
              </span>
            </>
          )}
        </div>

        {content && (
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-secondary transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin relative">
        {content ? (
          <motion.div
            key={path}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <SyntaxHighlighter
              language={language}
              style={customStyle}
              showLineNumbers
              lineNumberStyle={{
                minWidth: "3em",
                paddingRight: "1em",
                color: "#3f3f46",
                fontSize: "12px",
                userSelect: "none",
              }}
              wrapLongLines
              customStyle={{
                background: "transparent",
                margin: 0,
                padding: 0,
              }}
            >
              {content}
            </SyntaxHighlighter>
          </motion.div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 font-mono text-sm">
            {"// No file selected"}
          </div>
        )}
      </div>
    </div>
  );
}
