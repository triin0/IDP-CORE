---
name: supply-chain-security
description: Protect AI-generated code from supply chain attacks including slopsquatting, dependency confusion, and typosquatting. Use when validating AI-generated package dependencies, auditing imports, building safe-import guards, or hardening the code generation pipeline against malicious packages.
---

# Supply Chain Security for AI-Generated Code

## The Threat: Slopsquatting

AI coding agents frequently hallucinate plausible but non-existent package names. Attackers monitor these hallucinations and register malicious packages with identical names on public registries (npm, PyPI). This is called **slopsquatting**.

### Attack Flow
```
1. AI generates: import { auth } from "fastify-auth-helpers"
2. "fastify-auth-helpers" doesn't exist (hallucinated)
3. Attacker registers it on npm with malicious payload
4. User runs npm install → backdoor installed
5. Malicious code exfiltrates secrets
```

## Why AI-Native IDEs Are Especially Vulnerable

- AI generates dozens of dependencies per project
- Users trust AI suggestions implicitly
- Hallucinated names sound real ("express-session-plus")
- npm audit won't flag it — no CVEs exist for new packages
- Attack is proactive — trap is set before victim arrives

## Safe-Import Guard Architecture

```
AI Code Generator → Safe-Import Guard → Build Pipeline
                          ↓
                  Safe Package Registry
                  (curated allowlist)
```

### Validation Checks (Priority Order)

| Check | Rule | Why |
|-------|------|-----|
| Existence | Package must exist on official registry | Catches hallucinated packages |
| Age | Must be > 30 days old | Catches freshly registered attack packages |
| Downloads | Must have > 1,000 weekly downloads | Filters abandoned/suspicious packages |
| Typosquatting | Levenshtein distance < 2 from popular pkg | Catches `lodas` (→ `lodash`) |
| Maintainer | Must have verified identity + history | Catches throwaway accounts |
| CVE Scan | No critical/high vulnerabilities | Standard vulnerability check |
| Scope | Prefer @scoped packages | Harder to squat scoped names |

### npm Registry API

Check if a package exists and get metadata:
```bash
curl -s https://registry.npmjs.org/<package-name> | jq '{name, time, versions}'
```

Check download counts:
```bash
curl -s https://api.npmjs.org/downloads/point/last-week/<package-name> | jq '.downloads'
```

### Implementation Pattern

```typescript
interface DependencyAuditResult {
  package: string;
  version: string;
  status: "safe" | "warning" | "blocked";
  reason: string;
}

async function auditDependency(name: string): Promise<DependencyAuditResult> {
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const response = await fetch(registryUrl);
  
  if (response.status === 404) {
    return { package: name, version: "*", status: "blocked", reason: "Package does not exist on npm (likely hallucinated)" };
  }
  
  const data = await response.json();
  const created = new Date(data.time?.created);
  const ageInDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  
  if (ageInDays < 30) {
    return { package: name, version: "*", status: "warning", reason: `Package is only ${Math.floor(ageInDays)} days old` };
  }
  
  return { package: name, version: data["dist-tags"]?.latest || "*", status: "safe", reason: "Package verified" };
}
```

### Integration with Golden Path Engine

Add as Check #10 in `artifacts/api-server/src/lib/golden-path.ts`:

```typescript
{
  name: "Dependency Audit",
  passed: /* all deps verified safe */,
  description: "All AI-suggested packages verified against known-safe registry"
}
```

### Extraction Pattern

Parse dependencies from generated `package.json` files:
```typescript
function extractDependencies(files: Array<{path: string, content: string}>): string[] {
  const pkgFiles = files.filter(f => f.path.endsWith("package.json"));
  const deps: string[] = [];
  for (const f of pkgFiles) {
    const pkg = JSON.parse(f.content);
    deps.push(...Object.keys(pkg.dependencies || {}));
    deps.push(...Object.keys(pkg.devDependencies || {}));
  }
  return [...new Set(deps)];
}
```

## Other Supply Chain Threats

### Dependency Confusion
- Attacker publishes public package with same name as internal package
- Mitigation: Use scoped packages (@org/pkg) for all internal deps

### Typosquatting
- `coler` instead of `color`, `lodas` instead of `lodash`
- Mitigation: Levenshtein distance check against top-1000 npm packages

### Maintainer Hijacking
- Legitimate package taken over by attacker
- Mitigation: Pin exact versions, use lockfiles, monitor for ownership changes

## Curated Allowlist Approach

For maximum security, maintain a curated allowlist of ~50,000 vetted packages:
1. Block all direct pulls from open internet
2. Route all installs through curated proxy
3. Only mirror explicitly trusted packages
4. Auto-scan on every registry update
5. Alert on any blocked install attempt

This is the recommended approach for enterprise deployment of AI-generated code.
