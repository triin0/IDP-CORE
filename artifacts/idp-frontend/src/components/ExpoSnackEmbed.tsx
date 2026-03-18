import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { ProjectDetails } from "@workspace/api-client-react";
import {
  Smartphone, Tablet, Monitor, RefreshCw, Loader2,
  AlertCircle, ExternalLink, Maximize2, Minimize2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type SnackPlatform = "ios" | "android" | "web";

interface ExpoSnackEmbedProps {
  project: ProjectDetails;
}

interface SnackFile {
  type: "CODE";
  contents: string;
}

interface SnackSaveResponse {
  id: string;
  hashId: string;
}

function extractDependencies(files: Array<{ path: string; content: string }>): Record<string, string> {
  const pkgFile = files.find((f) => f.path === "package.json");
  if (!pkgFile) return getDefaultDependencies();

  try {
    const pkg = JSON.parse(pkgFile.content);
    const deps: Record<string, string> = {};

    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

    const snackBuiltins = new Set([
      "react", "react-native", "expo", "react-dom",
    ]);

    for (const [name, version] of Object.entries(allDeps)) {
      if (snackBuiltins.has(name)) continue;
      deps[name] = String(version).replace(/^[\^~]/, "");
    }

    if (!deps["expo-router"]) deps["expo-router"] = "4.0.0";
    if (!deps["nativewind"]) deps["nativewind"] = "4.1.23";
    if (!deps["react-native-safe-area-context"]) deps["react-native-safe-area-context"] = "4.14.1";
    if (!deps["react-native-screens"]) deps["react-native-screens"] = "4.4.0";
    if (!deps["react-native-reanimated"]) deps["react-native-reanimated"] = "3.16.7";
    if (!deps["expo-haptics"]) deps["expo-haptics"] = "14.0.1";
    if (!deps["@react-native-async-storage/async-storage"]) deps["@react-native-async-storage/async-storage"] = "2.1.2";
    if (!deps["lucide-react-native"]) deps["lucide-react-native"] = "0.475.0";
    if (!deps["react-native-svg"]) deps["react-native-svg"] = "15.11.2";
    if (!deps["expo-constants"]) deps["expo-constants"] = "17.0.8";
    if (!deps["expo-linking"]) deps["expo-linking"] = "7.0.8";
    if (!deps["expo-status-bar"]) deps["expo-status-bar"] = "2.0.2";

    return deps;
  } catch {
    return getDefaultDependencies();
  }
}

function getDefaultDependencies(): Record<string, string> {
  return {
    "expo-router": "4.0.0",
    "nativewind": "4.1.23",
    "react-native-safe-area-context": "4.14.1",
    "react-native-screens": "4.4.0",
    "react-native-reanimated": "3.16.7",
    "expo-haptics": "14.0.1",
    "@react-native-async-storage/async-storage": "2.1.2",
    "lucide-react-native": "0.475.0",
    "react-native-svg": "15.11.2",
    "expo-constants": "17.0.8",
    "expo-linking": "7.0.8",
    "expo-status-bar": "2.0.2",
  };
}

function buildSnackEntryPoint(files: Array<{ path: string; content: string }>): string {
  const hasExpoRouter = files.some((f) => f.path === "app/_layout.tsx" || f.path === "app/_layout.jsx");

  if (hasExpoRouter) {
    return `import 'expo-router/entry';`;
  }

  const indexScreen = files.find((f) =>
    f.path === "app/index.tsx" || f.path === "app/index.jsx" ||
    f.path === "App.tsx" || f.path === "App.jsx"
  );

  if (indexScreen) {
    const importPath = indexScreen.path.replace(/\.(tsx|jsx|ts|js)$/, "");
    return `export { default } from './${importPath}';`;
  }

  return `import { View, Text } from 'react-native';
export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' }}>
      <Text style={{ color: '#f4f4f5', fontSize: 18 }}>IDP Mobile App</Text>
    </View>
  );
}`;
}

function transformFilesForSnack(files: Array<{ path: string; content: string }>): Record<string, SnackFile> {
  const snackFiles: Record<string, SnackFile> = {};

  const skipFiles = new Set(["package.json", "tsconfig.json", "babel.config.js", "metro.config.js"]);

  for (const file of files) {
    if (skipFiles.has(file.path)) continue;

    if (file.path === "app.json") {
      try {
        const appConfig = JSON.parse(file.content);
        if (!appConfig.expo) {
          appConfig.expo = appConfig;
        }
        snackFiles["app.json"] = {
          type: "CODE",
          contents: JSON.stringify(appConfig, null, 2),
        };
      } catch {
        snackFiles["app.json"] = { type: "CODE", contents: file.content };
      }
      continue;
    }

    if (file.path === "tailwind.config.js" || file.path === "tailwind.config.ts") {
      snackFiles[file.path] = { type: "CODE", contents: file.content };
      continue;
    }

    if (file.path === "global.css") {
      snackFiles[file.path] = { type: "CODE", contents: file.content };
      continue;
    }

    snackFiles[file.path] = { type: "CODE", contents: file.content };
  }

  if (!snackFiles["App.js"] && !snackFiles["App.tsx"] && !snackFiles["index.js"]) {
    snackFiles["App.js"] = {
      type: "CODE",
      contents: buildSnackEntryPoint(files),
    };
  }

  return snackFiles;
}

async function saveSnack(
  name: string,
  description: string,
  files: Record<string, SnackFile>,
  dependencies: Record<string, string>,
): Promise<SnackSaveResponse> {
  const payload = {
    name,
    description,
    sdkVersion: "52.0.0",
    dependencies,
    files,
  };

  const response = await fetch("https://exp.host/--/api/v2/snack/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Snack save failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return { id: data.id, hashId: data.hashId ?? data.id };
}

function buildSnackEmbedUrl(snackId: string, platform: SnackPlatform): string {
  const params = new URLSearchParams({
    platform,
    preview: "true",
    theme: "dark",
    loading: "lazy",
  });
  return `https://snack.expo.dev/embedded/${snackId}?${params.toString()}`;
}

const PLATFORM_CONFIG: Array<{ id: SnackPlatform; label: string; icon: typeof Smartphone }> = [
  { id: "ios", label: "iOS", icon: Smartphone },
  { id: "android", label: "Android", icon: Smartphone },
  { id: "web", label: "Web", icon: Monitor },
];

export function ExpoSnackEmbed({ project }: ExpoSnackEmbedProps) {
  const [platform, setPlatform] = useState<SnackPlatform>("ios");
  const [snackId, setSnackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const filesHashRef = useRef<string>("");

  const projectFiles = useMemo(() => {
    return (project.files ?? []) as Array<{ path: string; content: string }>;
  }, [project.files]);

  const filesHash = useMemo(() => {
    let hash = 0;
    for (const f of projectFiles) {
      for (let i = 0; i < f.path.length; i++) hash = ((hash << 5) - hash + f.path.charCodeAt(i)) | 0;
      for (let i = 0; i < f.content.length; i++) hash = ((hash << 5) - hash + f.content.charCodeAt(i)) | 0;
    }
    return String(hash);
  }, [projectFiles]);

  const createSnack = useCallback(async () => {
    if (projectFiles.length === 0) {
      setError("No files available to preview");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const snackFiles = transformFilesForSnack(projectFiles);
      const dependencies = extractDependencies(projectFiles);

      const appName = project.prompt
        ? project.prompt.slice(0, 60).replace(/[^a-zA-Z0-9\s-]/g, "")
        : "IDP Mobile App";

      const result = await saveSnack(
        appName,
        `Generated by IDP.CORE — ${project.prompt ?? "Mobile App"}`,
        snackFiles,
        dependencies,
      );

      setSnackId(result.id);
      filesHashRef.current = filesHash;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create Snack preview";
      setError(message);
      console.error("[SnackEmbed] Save failed:", err);
    } finally {
      setLoading(false);
    }
  }, [projectFiles, filesHash, project.prompt]);

  useEffect(() => {
    if (projectFiles.length > 0 && filesHash !== filesHashRef.current) {
      createSnack();
    }
  }, [projectFiles, filesHash, createSnack]);

  const embedUrl = useMemo(() => {
    if (!snackId) return null;
    return buildSnackEmbedUrl(snackId, platform);
  }, [snackId, platform]);

  const snackWebUrl = snackId ? `https://snack.expo.dev/${snackId}` : null;

  return (
    <div className={cn(
      "flex flex-col h-full bg-zinc-950",
      isExpanded && "fixed inset-0 z-50",
    )}>
      <div className="flex items-center justify-between px-2 py-1.5 bg-card border-b border-border/50 shrink-0">
        <div className="flex items-center gap-1">
          {PLATFORM_CONFIG.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setPlatform(id); setIframeKey((k) => k + 1); }}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors",
                platform === id
                  ? id === "ios" ? "bg-blue-500/15 text-blue-400"
                  : id === "android" ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-violet-500/15 text-violet-400"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {loading && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Booting…
            </span>
          )}
          <button
            onClick={() => { setSnackId(null); filesHashRef.current = ""; createSnack(); }}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
            title="Rebuild Snack"
            disabled={loading}
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          </button>
          {snackWebUrl && (
            <a
              href={snackWebUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
              title="Open in Expo Snack"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {loading && !snackId && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-10"
            >
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-900 border border-cyan-500/40 flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                </div>
              </div>
              <p className="text-xs font-mono text-zinc-400 mb-1">
                Uploading to Expo Snack…
              </p>
              <p className="text-[10px] font-mono text-zinc-600">
                {projectFiles.length} files → Virtual Device
              </p>
            </motion.div>
          )}

          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-10 p-6"
            >
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-xs font-mono text-zinc-400 mb-2 text-center max-w-sm">
                {error}
              </p>
              <button
                onClick={createSnack}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-[11px] font-mono hover:bg-zinc-700 transition-colors"
              >
                Retry
              </button>
            </motion.div>
          )}

          {embedUrl && !error && (
            <motion.div
              key="iframe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full h-full"
            >
              <iframe
                key={`snack-${iframeKey}-${platform}`}
                src={embedUrl}
                className="w-full h-full border-0"
                title={`Expo Snack — ${platform}`}
                allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
              />
            </motion.div>
          )}

          {!loading && !error && !embedUrl && projectFiles.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6">
                <Smartphone className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-xs font-mono text-zinc-500">
                  Waiting for mobile app generation…
                </p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
