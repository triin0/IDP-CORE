interface PipelineFile {
  path: string;
  content: string;
}

interface HardenerResult {
  files: PipelineFile[];
  fixes: string[];
}

export function hardenMobileTypes(
  files: PipelineFile[],
): HardenerResult {
  let currentFiles = [...files];
  const allFixes: string[] = [];

  const stylesheetFix = fixStyleSheetCreate(currentFiles);
  currentFiles = stylesheetFix.files;
  allFixes.push(...stylesheetFix.fixes);

  const localStorageFix = fixLocalStorageUsage(currentFiles);
  currentFiles = localStorageFix.files;
  allFixes.push(...localStorageFix.fixes);

  const safeAreaFix = fixSafeAreaProvider(currentFiles);
  currentFiles = safeAreaFix.files;
  allFixes.push(...safeAreaFix.fixes);

  const depPinFix = fixDependencyPins(currentFiles);
  currentFiles = depPinFix.files;
  allFixes.push(...depPinFix.fixes);

  const assetFix = fixMobileAssetLimits(currentFiles);
  currentFiles = assetFix.files;
  allFixes.push(...assetFix.fixes);

  const navFix = fixDirectReactNavigation(currentFiles);
  currentFiles = navFix.files;
  allFixes.push(...navFix.fixes);

  const flatListFix = fixFlatListEnforcement(currentFiles);
  currentFiles = flatListFix.files;
  allFixes.push(...flatListFix.fixes);

  const imageFix = fixImageOptimization(currentFiles);
  currentFiles = imageFix.files;
  allFixes.push(...imageFix.fixes);

  const memoFix = fixHeavyReRenders(currentFiles);
  currentFiles = memoFix.files;
  allFixes.push(...memoFix.fixes);

  const animFix = fixAnimationPerformance(currentFiles);
  currentFiles = animFix.files;
  allFixes.push(...animFix.fixes);

  const perfConstFix = fixMobilePerformanceConstants(currentFiles);
  currentFiles = perfConstFix.files;
  allFixes.push(...perfConstFix.fixes);

  const hapticPresenceFix = fixHapticPresence(currentFiles);
  currentFiles = hapticPresenceFix.files;
  allFixes.push(...hapticPresenceFix.fixes);

  return { files: currentFiles, fixes: allFixes };
}

function fixStyleSheetCreate(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".tsx") && !file.path.endsWith(".ts")) return file;

    let content = file.content;
    let modified = false;

    if (content.includes("StyleSheet.create")) {
      content = content.replace(
        /const\s+styles\s*=\s*StyleSheet\.create\(\{[\s\S]*?\}\);?\s*/g,
        "// StyleSheet.create removed — use NativeWind className prop instead\n",
      );
      content = content.replace(
        /import\s*\{([^}]*?)StyleSheet,?\s*([^}]*?)\}\s*from\s*["']react-native["']/g,
        (match, before, after) => {
          const remaining = (before + after).replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
          return remaining
            ? `import { ${remaining} } from "react-native"`
            : `import { View, Text } from "react-native"`;
        },
      );
      content = content.replace(/style=\{styles\.(\w+)\}/g, 'className="$1"');
      modified = true;
      fixes.push(`[${file.path}] Removed StyleSheet.create — NativeWind className is the only valid styling method`);
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixLocalStorageUsage(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".tsx") && !file.path.endsWith(".ts")) return file;

    let content = file.content;
    let modified = false;

    if (content.includes("localStorage.")) {
      content = content.replace(
        /localStorage\.getItem\(\s*["']([^"']+)["']\s*\)/g,
        'await AsyncStorage.getItem("$1")',
      );
      content = content.replace(
        /localStorage\.setItem\(\s*["']([^"']+)["']\s*,\s*([^)]+)\)/g,
        'await AsyncStorage.setItem("$1", $2)',
      );
      content = content.replace(
        /localStorage\.removeItem\(\s*["']([^"']+)["']\s*\)/g,
        'await AsyncStorage.removeItem("$1")',
      );

      if (!content.includes("AsyncStorage")) {
        content = `import AsyncStorage from "@react-native-async-storage/async-storage";\n` + content;
      }

      modified = true;
      fixes.push(`[${file.path}] Replaced localStorage with AsyncStorage (React Native has no localStorage)`);
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixSafeAreaProvider(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const layoutFile = files.find(f => f.path === "app/_layout.tsx");
  if (!layoutFile) return { files, fixes };

  if (layoutFile.content.includes("SafeAreaProvider")) return { files, fixes };

  let content = layoutFile.content;
  let modified = false;

  if (!content.includes("SafeAreaProvider")) {
    const importLine = `import { SafeAreaProvider } from "react-native-safe-area-context";\n`;
    const lastImport = content.lastIndexOf("\nimport ");
    if (lastImport !== -1) {
      const lineEnd = content.indexOf("\n", lastImport + 1);
      content = content.slice(0, lineEnd + 1) + importLine + content.slice(lineEnd + 1);
    } else {
      content = importLine + content;
    }

    const returnMatch = content.match(/return\s*\(\s*\n(\s*)/);
    if (returnMatch) {
      const indent = returnMatch[1];
      content = content.replace(
        /return\s*\(\s*\n(\s*)/,
        `return (\n${indent}<SafeAreaProvider>\n${indent}  `,
      );
      content = content.replace(
        /(\n\s*\);)\s*$/,
        `\n${indent}</SafeAreaProvider>\n${indent.slice(2)});`,
      );
      modified = true;
    }
  }

  if (!modified) return { files, fixes };

  fixes.push("[app/_layout.tsx] Injected SafeAreaProvider wrapper in root layout");
  const result = files.map(f =>
    f.path === "app/_layout.tsx" ? { path: f.path, content } : f,
  );
  return { files: result, fixes };
}

function fixDependencyPins(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const pkgFile = files.find(f => f.path === "package.json");
  if (!pkgFile) return { files, fixes };

  let content = pkgFile.content;
  let modified = false;

  const caretTilde = /["']\^|["']~/g;
  if (caretTilde.test(content)) {
    content = content.replace(/"(\^|~)([^"]+)"/g, '"$2"');
    content = content.replace(/'(\^|~)([^']+)'/g, "'$2'");
    modified = true;
    fixes.push("[package.json] Removed ^ and ~ from dependency versions for reproducible builds");
  }

  if (!modified) return { files, fixes };

  const result = files.map(f =>
    f.path === "package.json" ? { path: f.path, content } : f,
  );
  return { files: result, fixes };
}

function fixMobileAssetLimits(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const hasAssetUsage = files.some(f =>
    f.content.includes("require(") && f.content.match(/\.(png|jpg|jpeg|gif|webp)/) ||
    f.content.includes("Image") && f.content.includes("source="),
  );
  if (!hasAssetUsage) return { files, fixes };

  const hasLimitsFile = files.some(f =>
    f.path === "lib/asset-limits.ts" && f.content.includes("MOBILE_ASSET_LIMITS"),
  );
  if (hasLimitsFile) return { files, fixes };

  const assetLimitsModule = `export const MOBILE_ASSET_LIMITS = {
  MAX_IMAGE_WIDTH: 1024,
  MAX_IMAGE_HEIGHT: 1024,
  MAX_BUNDLE_SIZE_KB: 500,
  ALLOWED_FORMATS: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"] as const,
} as const;

export function validateImageSource(uri: string): boolean {
  const ext = uri.slice(uri.lastIndexOf(".")).toLowerCase();
  return MOBILE_ASSET_LIMITS.ALLOWED_FORMATS.includes(ext as any);
}
`;

  const result = [...files, { path: "lib/asset-limits.ts", content: assetLimitsModule }];
  fixes.push("[lib/asset-limits.ts] Injected mobile asset limits (1024px max, format whitelist) for VRAM safety");

  return { files: result, fixes };
}

function fixDirectReactNavigation(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".tsx") && !file.path.endsWith(".ts")) return file;

    let content = file.content;
    let modified = false;

    if (content.includes("@react-navigation/native") && !content.includes("expo-router")) {
      content = content.replace(
        /import\s+\{[^}]*useNavigation[^}]*\}\s+from\s+["']@react-navigation\/native["']/g,
        'import { useRouter } from "expo-router"',
      );
      content = content.replace(/\bnavigation\.navigate\(/g, "router.push(");
      content = content.replace(/\bnavigation\.goBack\(/g, "router.back(");
      content = content.replace(/\buseNavigation\(\)/g, "useRouter()");
      content = content.replace(/\bnavigation\b/g, "router");
      modified = true;
      fixes.push(`[${file.path}] Replaced @react-navigation/native with expo-router (file-based routing is mandatory)`);
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixFlatListEnforcement(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".tsx")) return file;

    let content = file.content;
    let modified = false;

    const scrollMapPattern = /<ScrollView([^>]*)>([\s\S]*?)\.map\(\s*\((\w+)[^)]*\)\s*=>\s*\(?([\s\S]*?)\)?\s*\)([\s\S]*?)<\/ScrollView>/;
    const match = content.match(scrollMapPattern);

    if (match && content.includes("ScrollView") && content.includes(".map(")) {
      const [fullMatch, scrollProps, beforeMap, itemVar, mapBody, afterMap] = match;

      const dataSource = content.match(new RegExp(`(\\w+)\\.map\\(\\s*\\(${itemVar}`))?.[1] || "data";

      const keyExtract = mapBody.match(/key=\{([^}]+)\}/)?.[1] || `${itemVar}.id`;

      const renderItem = mapBody
        .replace(/key=\{[^}]+\}\s*/g, "")
        .trim();

      const replacement = `<FlatList${scrollProps}\n        data={${dataSource}}\n        keyExtractor={(${itemVar}) => String(${keyExtract})}\n        renderItem={({ item: ${itemVar} }) => (\n          ${renderItem}\n        )}\n      />`;

      content = content.replace(fullMatch, replacement);

      if (content.includes("ScrollView") && !content.includes("<ScrollView")) {
        content = content.replace(
          /import\s*\{([^}]*?)ScrollView,?\s*([^}]*?)\}\s*from\s*["']react-native["']/g,
          (m, before, after) => {
            let remaining = (before + after).replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
            if (!remaining.includes("FlatList")) {
              remaining = remaining ? `${remaining}, FlatList` : "FlatList";
            }
            return `import { ${remaining} } from "react-native"`;
          },
        );
      } else {
        content = content.replace(
          /import\s*\{([^}]*?)\}\s*from\s*["']react-native["']/,
          (m, imports) => {
            if (!imports.includes("FlatList")) {
              return `import { ${imports.trim()}, FlatList } from "react-native"`;
            }
            return m;
          },
        );
      }

      modified = true;
      fixes.push(`[${file.path}] Replaced ScrollView + .map() with FlatList for virtualized rendering (60fps list performance)`);
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixImageOptimization(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".tsx")) return file;

    let content = file.content;
    let modified = false;

    const imgPattern = /<Image\s+([^>]*?)source=\{\{[^}]*uri:\s*([^}]+)\}\}([^>]*?)\/>/g;
    if (imgPattern.test(content)) {
      content = content.replace(
        /<Image\s+([^>]*?)source=\{\{([^}]*?uri:\s*[^}]+)\}\}([^>]*?)\/>/g,
        (match, before, sourceInner, after) => {
          let props = before + after;
          if (!props.includes("resizeMode")) {
            props = props.trim() + ' resizeMode="cover"';
          }
          if (!props.includes("loading") && !match.includes("loading=")) {
            props = props.trim() + ' loading="lazy"';
          }
          return `<Image ${props.trim()} source={{${sourceInner}}} />`;
        },
      );
      modified = true;
      fixes.push(`[${file.path}] Injected resizeMode="cover" and loading="lazy" on network Image components`);
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixHeavyReRenders(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".tsx")) return file;
    if (file.path.includes("_layout")) return file;

    let content = file.content;
    let modified = false;

    const componentPattern = /^(export\s+(?:default\s+)?)?function\s+([A-Z]\w+)\s*\(/m;
    const match = content.match(componentPattern);

    if (match && !content.includes("React.memo") && !content.includes("memo(")) {
      const [fullMatch, exportPrefix, componentName] = match;

      const hasExpensiveOps = content.includes("useEffect") ||
        content.includes(".map(") ||
        content.includes(".filter(") ||
        content.includes("fetch(");

      if (hasExpensiveOps) {
        const isDefaultExport = exportPrefix?.includes("default");
        const isExport = !!exportPrefix;

        if (isDefaultExport) {
          content = content.replace(
            new RegExp(`export\\s+default\\s+function\\s+${componentName}\\s*\\(`),
            `function ${componentName}(`,
          );
          content += `\nexport default React.memo(${componentName});\n`;
        } else if (isExport) {
          content = content.replace(
            new RegExp(`export\\s+function\\s+${componentName}\\s*\\(`),
            `function ${componentName}(`,
          );
          content += `\nexport const Memoized${componentName} = React.memo(${componentName});\nexport { Memoized${componentName} as ${componentName} };\n`;
        }

        if (!content.includes("import React") && !content.includes("import * as React")) {
          content = `import React from "react";\n` + content;
        }

        modified = true;
        fixes.push(`[${file.path}] Wrapped ${componentName} in React.memo() to prevent unnecessary re-renders`);
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixAnimationPerformance(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const result = files.map(file => {
    if (!file.path.endsWith(".tsx") && !file.path.endsWith(".ts")) return file;

    let content = file.content;
    let modified = false;

    if (content.includes("from \"react-native\"") && content.includes("Animated") &&
      !content.includes("react-native-reanimated")) {
      const importMatch = content.match(
        /import\s*\{([^}]*?)\bAnimated\b([^}]*?)\}\s*from\s*["']react-native["']/,
      );
      if (importMatch) {
        const [fullImport, before, after] = importMatch;
        const remaining = (before + after).replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
        if (remaining) {
          content = content.replace(fullImport, `import { ${remaining} } from "react-native"`);
        } else {
          content = content.replace(fullImport, "");
        }

        content = `import Animated, { FadeIn, FadeOut, SlideInRight } from "react-native-reanimated";\n` + content;
        modified = true;
        fixes.push(`[${file.path}] Replaced react-native Animated with react-native-reanimated for 60fps native animations`);
      }
    }

    return modified ? { path: file.path, content } : file;
  });

  return { files: result, fixes };
}

function fixMobilePerformanceConstants(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const hasPerfFile = files.some(
    f => f.path === "lib/performance-wall.ts" && f.content.includes("MOBILE_PERF_LIMITS"),
  );
  if (hasPerfFile) return { files, fixes };

  const hasScreens = files.some(f => f.path.startsWith("app/") && f.path.endsWith(".tsx"));
  if (!hasScreens) return { files, fixes };

  const MOBILE_PERF_MODULE = `export const MOBILE_PERF_LIMITS = {
  MAX_LIST_ITEMS_BEFORE_VIRTUALIZATION: 20,
  MAX_IMAGE_DIMENSION: 1024,
  MAX_SIMULTANEOUS_ANIMATIONS: 3,
  TARGET_FPS: 60,
  MAX_BUNDLE_SIZE_KB: 500,
  IMAGE_CACHE_SIZE_MB: 50,
  FLATLIST_WINDOW_SIZE: 5,
  FLATLIST_MAX_TO_RENDER_PER_BATCH: 10,
  FLATLIST_INITIAL_NUM_TO_RENDER: 10,
} as const;

export const PERF_HINTS = {
  USE_FLATLIST: "Replace ScrollView + .map() with FlatList for virtualized rendering",
  USE_REANIMATED: "Use react-native-reanimated instead of core Animated for 60fps animations",
  USE_MEMO: "Wrap heavy components in React.memo() to prevent unnecessary re-renders",
  USE_CALLBACK: "Use useCallback() for event handlers passed as props",
  LAZY_IMAGES: "Use loading='lazy' and resizeMode='cover' for network images",
} as const;
`;

  const result = [...files, { path: "lib/performance-wall.ts", content: MOBILE_PERF_MODULE }];
  fixes.push("[lib/performance-wall.ts] Injected MOBILE_PERF_LIMITS constants (FlatList window, animation caps, image cache, bundle limits)");

  return { files: result, fixes };
}

function fixHapticPresence(files: PipelineFile[]): HardenerResult {
  const fixes: string[] = [];

  const hasHapticPresence = files.some(
    f => f.path === "lib/haptic-presence.ts" && f.content.includes("triggerPresenceHaptic"),
  );
  if (hasHapticPresence) return { files, fixes };

  const hasLayout = files.some(f => f.path.includes("app/") && f.path.endsWith("_layout.tsx"));
  if (!hasLayout) return { files, fixes };

  const HAPTIC_PRESENCE_MODULE = `import { useEffect, useRef, useCallback } from "react";
import * as Haptics from "expo-haptics";

export type PresenceEventType =
  | "peer:joined"
  | "peer:left"
  | "object:moved"
  | "object:created"
  | "object:deleted"
  | "conflict:resolved";

const HAPTIC_MAP: Record<PresenceEventType, () => Promise<void>> = {
  "peer:joined": () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  "peer:left": () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  "object:moved": () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  "object:created": () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  "object:deleted": () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  "conflict:resolved": () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

const THROTTLE_MS = 100;

export function triggerPresenceHaptic(event: PresenceEventType): void {
  const handler = HAPTIC_MAP[event];
  if (handler) {
    handler().catch(() => {});
  }
}

export function usePresenceHaptics(wsUrl: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const lastHapticRef = useRef<number>(0);

  const throttledHaptic = useCallback((event: PresenceEventType) => {
    const now = Date.now();
    if (now - lastHapticRef.current < THROTTLE_MS) return;
    lastHapticRef.current = now;
    triggerPresenceHaptic(event);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "presence:update") {
          if (msg.selectedNodeId) {
            throttledHaptic("object:moved");
          }
        } else if (msg.type === "presence:leave") {
          throttledHaptic("peer:left");
        } else if (msg.type === "command:conflict") {
          throttledHaptic("conflict:resolved");
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [wsUrl, throttledHaptic]);

  return { triggerPresenceHaptic: throttledHaptic };
}
`;

  let result: PipelineFile[] = [...files, { path: "lib/haptic-presence.ts", content: HAPTIC_PRESENCE_MODULE }];
  fixes.push("[lib/haptic-presence.ts] Injected haptic presence system (6 event types, throttled haptic feedback, WebSocket listener)");

  const pkgFile = result.find(f => f.path === "package.json");
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      const deps = pkg.dependencies || {};
      if (!deps["expo-haptics"]) {
        deps["expo-haptics"] = "~13.0.0";
        pkg.dependencies = deps;
        result = result.map(f =>
          f.path === "package.json" ? { path: f.path, content: JSON.stringify(pkg, null, 2) } : f,
        );
        fixes.push("[package.json] Added expo-haptics dependency for presence feedback");
      }
    } catch {}
  }

  return { files: result, fixes };
}
