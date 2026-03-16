import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface StatusTerminalProps {
  status: string;
}

const LOG_MESSAGES = [
  "Initializing orchestrator...",
  "Allocating resources...",
  "Bootstrapping environment...",
  "Analyzing architectural prompt...",
  "Generating system schemas...",
  "Writing database migrations...",
  "Scaffolding API routes...",
  "Implementing business logic...",
  "Running Golden Path compliance checks...",
  "Verifying enterprise standards...",
  "Finalizing artifact bundle...",
];

export function StatusTerminal({ status }: StatusTerminalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    if (status !== "generating" && status !== "pending") return;

    const interval = setInterval(() => {
      setLogIndex((prev) => {
        if (prev < LOG_MESSAGES.length - 1) {
          setLogs((current) => [...current, LOG_MESSAGES[prev]]);
          return prev + 1;
        }
        return prev;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [status]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-3xl mx-auto mt-12 overflow-hidden rounded-xl bg-card border border-border shadow-2xl"
    >
      <div className="flex items-center px-4 py-3 border-b border-border/50 bg-secondary/50">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
          <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
          <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
        </div>
        <div className="mx-auto text-xs font-mono text-muted-foreground flex items-center">
          BUILD_PROCESS.SH
        </div>
      </div>
      
      <div className="p-6 font-mono text-sm h-80 overflow-y-auto bg-zinc-950 scrollbar-thin">
        <div className="text-primary mb-4 flex items-center">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          <span>[SYSTEM] Code generation in progress...</span>
        </div>
        
        <div className="space-y-2">
          {logs.map((log, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-zinc-400 flex"
            >
              <span className="text-zinc-600 mr-4">{(i + 1).toString().padStart(2, '0')}:</span>
              <span>{log}</span>
            </motion.div>
          ))}
          
          {(status === "generating" || status === "pending") && (
            <div className="text-zinc-500 flex animate-pulse mt-2">
              <span className="text-zinc-600 mr-4">{(logs.length + 1).toString().padStart(2, '0')}:</span>
              <span className="flex items-center">Processing<span className="animate-cursor-blink bg-zinc-500 w-2 h-4 ml-1 inline-block"></span></span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
