import * as babel from "@babel/core";
import * as t from "@babel/types";

const IDP_ATTR_NAME = "data-idp-source";

function sourceAnnotatorPlugin(filePath: string): babel.PluginObj {
  return {
    name: "idp-source-annotator",
    visitor: {
      JSXOpeningElement(path) {
        const existing = path.node.attributes.find(
          (attr) =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === IDP_ATTR_NAME,
        );
        if (existing) return;

        if (
          t.isJSXMemberExpression(path.node.name) ||
          (t.isJSXIdentifier(path.node.name) && path.node.name.name === "Fragment")
        ) {
          return;
        }

        const loc = path.node.loc;
        const line = loc?.start.line ?? 0;
        const col = loc?.start.column ?? 0;
        const sourceValue = `${filePath}:${line}:${col}`;

        const attr = t.jsxAttribute(
          t.jsxIdentifier(IDP_ATTR_NAME),
          t.stringLiteral(sourceValue),
        );

        path.node.attributes.push(attr);
      },
    },
  };
}

function isJSXFile(filePath: string): boolean {
  return /\.(tsx|jsx)$/.test(filePath);
}

function isClientFile(filePath: string): boolean {
  return (
    filePath.startsWith("client/") ||
    filePath.includes("/components/") ||
    filePath.includes("/pages/") ||
    filePath.includes("/Components/") ||
    filePath.includes("/Pages/") ||
    filePath.endsWith("App.tsx") ||
    filePath.endsWith("App.jsx")
  );
}

export function annotateFileSource(
  filePath: string,
  content: string,
): string | null {
  if (!isJSXFile(filePath)) return null;
  if (!isClientFile(filePath)) return null;

  try {
    const result = babel.transformSync(content, {
      sourceType: "module",
      plugins: [
        ["@babel/plugin-syntax-typescript", { isTSX: true }],
        "@babel/plugin-syntax-jsx",
        () => sourceAnnotatorPlugin(filePath),
      ],
      filename: filePath,
      retainLines: true,
      compact: false,
    });

    return result?.code ?? null;
  } catch (err) {
    console.warn(
      `[source-annotator] Failed to annotate ${filePath}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export interface AnnotatedFile {
  path: string;
  content: string;
}

export function annotateProjectFiles(
  files: Array<{ path: string; content: string }>,
): AnnotatedFile[] {
  const annotated: AnnotatedFile[] = [];

  for (const file of files) {
    const annotatedContent = annotateFileSource(file.path, file.content);
    if (annotatedContent !== null) {
      annotated.push({ path: file.path, content: annotatedContent });
    }
  }

  return annotated;
}

export function mergeAnnotatedFiles(
  originalFiles: Array<{ path: string; content: string }>,
  annotatedFiles: AnnotatedFile[],
): Array<{ path: string; content: string }> {
  const annotatedMap = new Map(annotatedFiles.map((f) => [f.path, f.content]));

  return originalFiles.map((file) => {
    const annotatedContent = annotatedMap.get(file.path);
    return annotatedContent
      ? { path: file.path, content: annotatedContent }
      : file;
  });
}
