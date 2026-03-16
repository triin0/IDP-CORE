import { Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface CodeViewerProps {
  content: string;
  path: string;
}

export function CodeViewer({ content, path }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card">
        <div className="text-sm font-mono text-zinc-400">
          {path || "Select a file to view"}
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
      
      <div className="flex-1 overflow-auto p-4 scrollbar-thin relative">
        {content ? (
          <motion.pre 
            key={path} // Force re-render animation on path change
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-mono text-[13px] leading-relaxed text-zinc-300 w-full"
          >
            <code>{content}</code>
          </motion.pre>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 font-mono text-sm">
            // No file selected
          </div>
        )}
      </div>
    </div>
  );
}
