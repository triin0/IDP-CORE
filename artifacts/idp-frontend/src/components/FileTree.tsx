import { useState } from "react";
import { Folder, File, ChevronRight, ChevronDown, FileJson, FileCode2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectFile } from "@workspace/api-client-react/src/generated/api.schemas";

interface FileTreeProps {
  files: ProjectFile[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}

// Simple logic to turn flat paths into a tree structure
type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: Record<string, TreeNode>;
};

function buildTree(files: ProjectFile[]): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  files.forEach(file => {
    const parts = file.path.split('/');
    let current = root;

    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current[part]) {
        current[part] = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : {}
        };
      }

      if (!isFile) {
        current = current[part].children!;
      }
    });
  });

  return root;
}

function getFileIcon(filename: string) {
  if (filename.endsWith('.json') || filename.endsWith('.lock')) return <FileJson className="w-4 h-4 text-yellow-500/80" />;
  if (filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.js')) return <FileCode2 className="w-4 h-4 text-blue-400/80" />;
  if (filename.endsWith('.md') || filename.endsWith('.txt')) return <FileText className="w-4 h-4 text-zinc-400" />;
  return <File className="w-4 h-4 text-zinc-400" />;
}

function TreeItem({ 
  node, 
  level, 
  activeFile, 
  onSelect 
}: { 
  node: TreeNode, 
  level: number, 
  activeFile: string | null, 
  onSelect: (p: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isFolder = node.type === 'folder';
  const isActive = activeFile === node.path;

  return (
    <div>
      <div 
        className={cn(
          "flex items-center py-1.5 px-2 cursor-pointer hover:bg-secondary/50 select-none group transition-colors",
          isActive && "bg-primary/10 text-primary hover:bg-primary/20"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) setIsOpen(!isOpen);
          else onSelect(node.path);
        }}
      >
        <span className="w-4 h-4 mr-1.5 flex items-center justify-center opacity-70 group-hover:opacity-100">
          {isFolder ? (
            isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <span className="w-3.5 h-3.5" /> // spacer
          )}
        </span>
        
        <span className="mr-2">
          {isFolder ? <Folder className="w-4 h-4 text-primary/70" /> : getFileIcon(node.name)}
        </span>
        
        <span className={cn(
          "text-sm font-mono truncate",
          isActive ? "font-semibold" : "text-zinc-400 group-hover:text-zinc-200"
        )}>
          {node.name}
        </span>
      </div>
      
      {isFolder && isOpen && node.children && (
        <div>
          {Object.values(node.children)
            .sort((a, b) => {
              // Folders first
              if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map(child => (
            <TreeItem 
              key={child.path} 
              node={child} 
              level={level + 1} 
              activeFile={activeFile} 
              onSelect={onSelect} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ files, activeFile, onSelectFile }: FileTreeProps) {
  const tree = buildTree(files);

  return (
    <div className="h-full overflow-y-auto py-2 scrollbar-thin">
      {Object.values(tree).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }).map(node => (
        <TreeItem 
          key={node.path} 
          node={node} 
          level={0} 
          activeFile={activeFile} 
          onSelect={onSelectFile} 
        />
      ))}
    </div>
  );
}
