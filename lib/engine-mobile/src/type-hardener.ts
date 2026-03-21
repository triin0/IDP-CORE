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
