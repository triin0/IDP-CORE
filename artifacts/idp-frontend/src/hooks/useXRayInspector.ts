import { useState, useEffect, useCallback, useRef } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";

export interface CodeMirrorRef {
  getCodemirror: () => unknown;
}

interface CMEditorView {
  state: {
    doc: {
      lines: number;
      line: (n: number) => { from: number; length: number };
    };
  };
  dispatch: (tr: { selection: { anchor: number }; scrollIntoView: boolean }) => void;
  focus: () => void;
}

function parseSourcePayload(source: string): { file: string; line: number; col: number } | null {
  const lastColon = source.lastIndexOf(":");
  if (lastColon === -1) return null;
  const beforeLastColon = source.lastIndexOf(":", lastColon - 1);
  if (beforeLastColon === -1) return null;

  const file = source.slice(0, beforeLastColon);
  const line = parseInt(source.slice(beforeLastColon + 1, lastColon), 10);
  const col = parseInt(source.slice(lastColon + 1), 10);

  if (!file || isNaN(line) || isNaN(col)) return null;
  return { file, line, col };
}

function toSandpackPath(filePath: string): string {
  let p = filePath;
  if (p.startsWith("client/")) {
    p = p.slice("client/".length);
  }
  if (p.startsWith("src/")) {
    p = p.slice("src/".length);
  }
  return `/${p}`;
}

function useSandpackSafe() {
  try {
    return useSandpack();
  } catch {
    return null;
  }
}

export function useXRayInspector(editorRef: React.RefObject<CodeMirrorRef | null>) {
  const [inspectActive, setInspectActive] = useState(false);
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const sandpackCtx = useSandpackSafe();
  const sandpack = sandpackCtx?.sandpack ?? null;
  const pendingScroll = useRef<{ line: number; col: number } | null>(null);

  const sendToPreviewIframe = useCallback((type: string) => {
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage({ type }, "*");
      } catch {
        // cross-origin — ignore
      }
    });
  }, []);

  const toggleInspect = useCallback(() => {
    setInspectActive((prev) => {
      const next = !prev;
      sendToPreviewIframe(next ? "idp-xray-activate" : "idp-xray-deactivate");
      return next;
    });
  }, [sendToPreviewIframe]);

  const scrollEditorToLine = useCallback((line: number, col: number) => {
    const raw = editorRef.current?.getCodemirror();
    if (!raw) return false;
    const cmView = raw as CMEditorView;

    try {
      const doc = cmView.state.doc;
      const targetLine = Math.min(line, doc.lines);
      if (targetLine < 1) return false;

      const lineInfo = doc.line(targetLine);
      const charOffset = Math.min(col - 1, lineInfo.length);
      const pos = lineInfo.from + Math.max(0, charOffset);

      cmView.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      });

      cmView.focus();
      return true;
    } catch {
      return false;
    }
  }, [editorRef]);

  useEffect(() => {
    if (!pendingScroll.current || !sandpack) return;

    const { line, col } = pendingScroll.current;
    const timer = setTimeout(() => {
      if (pendingScroll.current) {
        scrollEditorToLine(line, col);
        pendingScroll.current = null;
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [sandpack?.activeFile, scrollEditorToLine, sandpack]);

  useEffect(() => {
    if (!sandpack) return;

    function handleMessage(event: MessageEvent) {
      if (!event.data || event.data.type !== "idp-xray-select") return;

      const source = event.data.source as string;
      if (!source) return;

      const parsed = parseSourcePayload(source);
      if (!parsed) return;

      setLastSelected(source);

      const spPath = toSandpackPath(parsed.file);

      const availableFiles = Object.keys(sandpack!.files);
      if (!availableFiles.includes(spPath)) return;

      sandpack!.openFile(spPath);

      if (sandpack!.activeFile === spPath) {
        setTimeout(() => scrollEditorToLine(parsed.line, parsed.col), 80);
      } else {
        pendingScroll.current = { line: parsed.line, col: parsed.col };
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sandpack, scrollEditorToLine]);

  useEffect(() => {
    return () => {
      sendToPreviewIframe("idp-xray-deactivate");
    };
  }, [sendToPreviewIframe]);

  return {
    inspectActive,
    toggleInspect,
    lastSelected,
  };
}
