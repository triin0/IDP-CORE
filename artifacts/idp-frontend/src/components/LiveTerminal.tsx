import { useEffect, useRef, useState } from "react";
import { Terminal, ChevronDown, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveTerminalProps {
  lines: string[];
  maxHeight?: string;
}

function colorize(line: string): { text: string; className: string } {
  if (line.startsWith("[stderr]") || line.includes("FAILED") || line.includes("ERROR")) {
    return { text: line, className: "text-red-400" };
  }
  if (line.includes("SUCCEEDED") || line.includes("COMPLETE") || line.includes("PASSED")) {
    return { text: line, className: "text-green-400" };
  }
  if (line.startsWith("[self-heal]") || line.includes("Recovery")) {
    return { text: line, className: "text-orange-400" };
  }
  if (line.startsWith("[verification]")) {
    return { text: line, className: "text-cyan-400" };
  }
  if (line.startsWith("[SSE]")) {
    return { text: line, className: "text-zinc-600" };
  }
  if (line.startsWith("[build]")) {
    return { text: line, className: "text-yellow-400/80" };
  }
  return { text: line, className: "text-zinc-400" };
}

export function LiveTerminal({ lines, maxHeight = "100%" }: LiveTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="flex flex-col h-full" style={{ maxHeight }}>
      <div className="px-3 py-1.5 text-xs font-mono font-semibold text-zinc-500 border-b border-border/50 bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider">Pipeline Output</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAutoScroll(!autoScroll);
              if (!autoScroll && containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
              }
            }}
            className={cn(
              "p-1 rounded hover:bg-zinc-800 transition-colors",
              autoScroll ? "text-green-400" : "text-zinc-600",
            )}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          >
            {autoScroll ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
          {!autoScroll && (
            <button
              onClick={() => {
                if (containerRef.current) {
                  containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
                setAutoScroll(true);
              }}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
              title="Scroll to bottom"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
          <span className="text-[10px] text-zinc-600">{lines.length} lines</span>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-zinc-950 p-2 font-mono text-[11px] leading-relaxed scrollbar-thin"
      >
        {lines.length === 0 ? (
          <div className="text-zinc-700 italic">Waiting for pipeline events...</div>
        ) : (
          lines.map((line, i) => {
            const { text, className } = colorize(line);
            return (
              <div key={i} className={cn("py-px whitespace-pre-wrap break-all", className)}>
                <span className="text-zinc-700 mr-2 select-none">
                  {String(i + 1).padStart(3, "0")}
                </span>
                {text}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
