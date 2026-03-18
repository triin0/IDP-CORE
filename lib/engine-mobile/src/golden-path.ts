import type { GoldenPathRule } from "@workspace/engine-common";

export const MOBILE_GOLDEN_PATH_RULES: GoldenPathRule[] = [
  {
    name: "expo-router",
    description: "App uses Expo Router file-based navigation with app/ directory",
    promptInstruction: "Use Expo Router with file-based routing in the app/ directory",
    critical: true,
    check: { type: "file-exists", file: "app/_layout.tsx" },
  },
  {
    name: "nativewind-styling",
    description: "Components use NativeWind (Tailwind) className for styling",
    promptInstruction: "Use NativeWind className prop for all styling, never StyleSheet.create",
    critical: true,
    check: { type: "content-match", pattern: "className=" },
  },
  {
    name: "typed-navigation",
    description: "Navigation uses typed route params via Expo Router's useLocalSearchParams",
    promptInstruction: "Use useLocalSearchParams<T>() with typed params for route parameters",
    critical: false,
    check: { type: "content-match", pattern: "useLocalSearchParams" },
  },
  {
    name: "safe-area-provider",
    description: "Root layout wraps content in SafeAreaProvider",
    promptInstruction: "Wrap root layout in SafeAreaProvider from react-native-safe-area-context",
    critical: true,
    check: { type: "content-match", pattern: "SafeAreaProvider" },
  },
  {
    name: "lucide-icons",
    description: "Icons use lucide-react-native for consistent iconography",
    promptInstruction: "Use lucide-react-native for all icons",
    critical: false,
    check: { type: "content-match", pattern: "lucide-react-native" },
  },
  {
    name: "async-storage-state",
    description: "Local persistence uses @react-native-async-storage/async-storage",
    promptInstruction: "Use AsyncStorage for local data persistence, never localStorage",
    critical: true,
    check: { type: "content-match", pattern: "AsyncStorage" },
  },
  {
    name: "typescript-strict",
    description: "All files use TypeScript with strict type annotations",
    promptInstruction: "Use TypeScript with strict mode, type all props and state",
    critical: true,
    check: { type: "file-extension", pattern: ".tsx" },
  },
  {
    name: "platform-adaptive",
    description: "UI adapts to platform using Platform.OS or platform-specific files",
    promptInstruction: "Use Platform.OS checks or .ios.tsx/.android.tsx for platform-specific behavior",
    critical: false,
    check: { type: "content-match", pattern: "Platform" },
  },
  {
    name: "haptic-feedback",
    description: "Interactive elements include haptic feedback via expo-haptics",
    promptInstruction: "Add Haptics.impactAsync() on button presses and significant interactions",
    critical: false,
    check: { type: "content-match", pattern: "expo-haptics" },
  },
  {
    name: "app-json-config",
    description: "app.json exists with proper Expo configuration",
    promptInstruction: "Include app.json with name, slug, version, orientation, and platform configs",
    critical: true,
    check: { type: "file-exists", file: "app.json" },
  },
  {
    name: "package-json-pinned",
    description: "package.json has pinned dependency versions for reproducibility",
    promptInstruction: "Pin all dependency versions in package.json (no ^ or ~ prefixes)",
    critical: true,
    check: { type: "file-exists", file: "package.json" },
  },
];

interface FileInput {
  path: string;
  content: string;
}

interface CheckResult {
  name: string;
  passed: boolean;
  description: string;
  critical: boolean;
}

export function runMobileGoldenPathChecks(files: FileInput[]): CheckResult[] {
  const allContent = files.map((f) => f.content).join("\n");
  const filePaths = files.map((f) => f.path);

  return MOBILE_GOLDEN_PATH_RULES.map((rule) => {
    let passed = false;

    switch (rule.check.type) {
      case "file-exists":
        passed = filePaths.some((p) => p === rule.check.file || p.endsWith(`/${rule.check.file}`));
        break;
      case "content-match":
        passed = rule.check.pattern ? allContent.includes(rule.check.pattern) : false;
        break;
      case "file-extension":
        passed = rule.check.pattern ? filePaths.some((p) => p.endsWith(rule.check.pattern!)) : false;
        break;
      default:
        passed = false;
    }

    return {
      name: rule.name,
      passed,
      description: rule.description,
      critical: rule.critical ?? false,
    };
  });
}
