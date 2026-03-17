import { useState } from "react";
import { ExternalLink, Maximize2, Minimize2, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface SandboxPreviewProps {
  deployUrl: string | null;
  status: string;
}

export function SandboxPreview({ deployUrl, status }: SandboxPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  if (!deployUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950 rounded-lg border border-zinc-800">
        <div className="text-center p-6">
          <Zap className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-xs font-mono text-zinc-600">
            {status === "ready" ? "Deploy to see live preview" : "Preview available after deployment"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden transition-all",
      isExpanded && "fixed inset-4 z-50 shadow-2xl",
    )}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[200px]">
            {deployUrl.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIframeKey(k => k + 1)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <a
            href={deployUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <iframe
          key={iframeKey}
          src={deployUrl}
          className="w-full h-full border-0"
          title="Sandbox Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          style={{ minHeight: isExpanded ? "calc(100vh - 120px)" : "300px" }}
        />
      </div>
    </div>
  );
}
