import { useState, useMemo } from "react";
import type { ProjectDetails } from "@workspace/api-client-react";
import {
  Eye, Brain, Database, Shield, Layers, ChevronDown,
  FileCode2, Globe, Server, Layout, Lock, Cpu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AppAnatomyProps {
  project: ProjectDetails;
}

interface OrganSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  items: OrganItem[];
}

interface OrganItem {
  label: string;
  detail?: string;
  badge?: string;
  badgeColor?: string;
}

function classifyFiles(files: string[]) {
  const pages: string[] = [];
  const components: string[] = [];
  const serverRoutes: string[] = [];
  const serverLogic: string[] = [];
  const schemas: string[] = [];
  const configs: string[] = [];

  for (const f of files) {
    const name = f.split("/").pop() || f;
    if (f.includes("pages/") || f.includes("Pages/") || name === "App.tsx") {
      pages.push(name);
    } else if (f.includes("components/") || f.includes("Components/")) {
      components.push(name);
    } else if (f.includes("routes/") || f.includes("Routes/")) {
      serverRoutes.push(name);
    } else if (f.includes("schema") || f.includes("migration") || f.includes("drizzle")) {
      schemas.push(name);
    } else if (f.includes("server/") && !f.includes("schema")) {
      serverLogic.push(name);
    } else if (name.includes("config") || name.includes("tsconfig") || name === "package.json" || name === ".env.example") {
      configs.push(name);
    }
  }

  return { pages, components, serverRoutes, serverLogic, schemas, configs };
}

function OrganCard({ section }: { section: OrganSection }) {
  const [expanded, setExpanded] = useState(false);
  const itemCount = section.items.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border overflow-hidden transition-all",
        section.borderColor,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 transition-colors",
          section.bgColor,
          "hover:brightness-125",
        )}
      >
        <div className={cn("p-2 rounded-lg", section.bgColor)}>
          {section.icon}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-semibold", section.color)}>
              {section.label}
            </span>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded">
              {itemCount}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">{section.description}</p>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-zinc-500 transition-transform",
          expanded && "rotate-180",
        )} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2 space-y-1 bg-zinc-950/50">
              {section.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", section.color.replace("text-", "bg-"))} />
                    <span className="text-xs text-zinc-300 truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.detail && (
                      <span className="text-[10px] font-mono text-zinc-600">{item.detail}</span>
                    )}
                    {item.badge && (
                      <span className={cn(
                        "text-[9px] font-mono px-1.5 py-0.5 rounded",
                        item.badgeColor || "bg-zinc-800 text-zinc-400",
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatBubble({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-1 p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30",
    )}>
      <div className={cn("p-1.5 rounded-lg", color)}>
        {icon}
      </div>
      <span className="text-lg font-bold text-zinc-200">{value}</span>
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function AppAnatomy({ project }: AppAnatomyProps) {
  const spec = project.spec;
  const files = useMemo(() => spec?.fileStructure ?? [], [spec]);
  const classified = useMemo(() => classifyFiles(files), [files]);

  const sections: OrganSection[] = useMemo(() => {
    const result: OrganSection[] = [];

    const uiItems: OrganItem[] = [
      ...classified.pages.map((p) => ({
        label: p.replace(/\.(tsx|jsx|ts|js)$/, ""),
        badge: "Page",
        badgeColor: "bg-violet-500/10 text-violet-400",
      })),
      ...classified.components.map((c) => ({
        label: c.replace(/\.(tsx|jsx|ts|js)$/, ""),
        badge: "Component",
        badgeColor: "bg-blue-500/10 text-blue-400",
      })),
    ];
    if (uiItems.length > 0) {
      result.push({
        id: "face",
        label: "The Face",
        icon: <Eye className="w-4 h-4 text-violet-400" />,
        color: "text-violet-400",
        bgColor: "bg-violet-500/[0.06]",
        borderColor: "border-violet-500/10",
        description: "What your users see — pages and visual components",
        items: uiItems,
      });
    }

    const brainItems: OrganItem[] = [
      ...(spec?.apiEndpoints ?? []).map((ep) => ({
        label: `${ep.path}`,
        detail: ep.description.length > 40 ? ep.description.slice(0, 37) + "..." : ep.description,
        badge: ep.method,
        badgeColor: ep.method === "GET"
          ? "bg-emerald-500/10 text-emerald-400"
          : ep.method === "POST"
            ? "bg-blue-500/10 text-blue-400"
            : ep.method === "PUT" || ep.method === "PATCH"
              ? "bg-amber-500/10 text-amber-400"
              : "bg-red-500/10 text-red-400",
      })),
    ];
    if (brainItems.length > 0) {
      result.push({
        id: "brain",
        label: "The Brain",
        icon: <Brain className="w-4 h-4 text-cyan-400" />,
        color: "text-cyan-400",
        bgColor: "bg-cyan-500/[0.06]",
        borderColor: "border-cyan-500/10",
        description: "How your app thinks — API endpoints and server logic",
        items: brainItems,
      });
    }

    const memoryItems: OrganItem[] = (spec?.databaseTables ?? []).map((t) => ({
      label: t.name,
      detail: `${t.columns.length} columns`,
      badge: "Table",
      badgeColor: "bg-emerald-500/10 text-emerald-400",
    }));
    if (memoryItems.length > 0) {
      result.push({
        id: "memory",
        label: "The Memory",
        icon: <Database className="w-4 h-4 text-emerald-400" />,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/[0.06]",
        borderColor: "border-emerald-500/10",
        description: "Where your data lives — database tables and storage",
        items: memoryItems,
      });
    }

    const shieldItems: OrganItem[] = (spec?.middleware ?? []).map((m) => ({
      label: m,
      badge: "Active",
      badgeColor: "bg-amber-500/10 text-amber-400",
    }));
    if (shieldItems.length > 0) {
      result.push({
        id: "shield",
        label: "The Shield",
        icon: <Shield className="w-4 h-4 text-amber-400" />,
        color: "text-amber-400",
        bgColor: "bg-amber-500/[0.06]",
        borderColor: "border-amber-500/10",
        description: "What keeps it safe — security middleware and protections",
        items: shieldItems,
      });
    }

    const foundationItems: OrganItem[] = (spec?.architecturalDecisions ?? []).map((d) => ({
      label: d,
    }));
    if (foundationItems.length > 0) {
      result.push({
        id: "foundation",
        label: "The Foundation",
        icon: <Layers className="w-4 h-4 text-pink-400" />,
        color: "text-pink-400",
        bgColor: "bg-pink-500/[0.06]",
        borderColor: "border-pink-500/10",
        description: "How it's built — the technical decisions under the hood",
        items: foundationItems,
      });
    }

    return result;
  }, [spec, classified]);

  const totalPages = classified.pages.length;
  const totalEndpoints = spec?.apiEndpoints?.length ?? 0;
  const totalTables = spec?.databaseTables?.length ?? 0;
  const totalFiles = files.length;

  if (!spec) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <Cpu className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-mono text-zinc-500">No spec available yet</p>
          <p className="text-xs text-zinc-600 mt-1">Build the project to see its anatomy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-zinc-200">App Anatomy</h2>
          </div>
          <p className="text-[11px] text-zinc-500">
            A visual map of everything inside your application
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <StatBubble
            icon={<Layout className="w-3.5 h-3.5 text-violet-400" />}
            value={totalPages}
            label="Pages"
            color="bg-violet-500/10"
          />
          <StatBubble
            icon={<Globe className="w-3.5 h-3.5 text-cyan-400" />}
            value={totalEndpoints}
            label="APIs"
            color="bg-cyan-500/10"
          />
          <StatBubble
            icon={<Database className="w-3.5 h-3.5 text-emerald-400" />}
            value={totalTables}
            label="Tables"
            color="bg-emerald-500/10"
          />
          <StatBubble
            icon={<FileCode2 className="w-3.5 h-3.5 text-zinc-400" />}
            value={totalFiles}
            label="Files"
            color="bg-zinc-500/10"
          />
        </div>

        {spec.overview && (
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-3">
            <p className="text-xs text-zinc-400 leading-relaxed">{spec.overview}</p>
          </div>
        )}

        <div className="space-y-2">
          {sections.map((section, i) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <OrganCard section={section} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
