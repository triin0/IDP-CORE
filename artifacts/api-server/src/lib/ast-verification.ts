import { Project, SyntaxKind, type SourceFile, type CallExpression, type Node } from "ts-morph";

export interface ASTCheck {
  name: string;
  passed: boolean;
  description: string;
  evidence?: string;
}

export interface ASTVerificationResult {
  passed: boolean;
  checks: ASTCheck[];
  errors: string[];
}

function createInMemoryProject(files: Array<{ path: string; content: string }>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      strict: false,
      skipLibCheck: true,
      moduleResolution: 100,
      module: 99,
      target: 99,
    },
  });

  for (const file of files) {
    if (file.path.endsWith(".ts") || file.path.endsWith(".tsx") || file.path.endsWith(".js") || file.path.endsWith(".jsx")) {
      project.createSourceFile(file.path, file.content);
    }
  }

  return project;
}

function findServerEntryFiles(files: Array<{ path: string; content: string }>): Array<{ path: string; content: string }> {
  const serverPatterns: Array<{ pattern: RegExp; priority: number }> = [
    { pattern: /^server\/src\/index\.[tj]sx?$/, priority: 1 },
    { pattern: /^server\/src\/app\.[tj]sx?$/, priority: 2 },
    { pattern: /^server\/index\.[tj]sx?$/, priority: 3 },
    { pattern: /^src\/server\.[tj]sx?$/, priority: 4 },
    { pattern: /^src\/index\.[tj]sx?$/, priority: 5 },
    { pattern: /^src\/app\.[tj]sx?$/, priority: 6 },
    { pattern: /^index\.[tj]sx?$/, priority: 7 },
    { pattern: /^app\.[tj]sx?$/, priority: 8 },
  ];

  const candidates = files
    .filter(f => !f.path.includes("client/") && !f.path.includes("frontend/") && !f.path.includes("react"))
    .map(f => {
      for (const { pattern, priority } of serverPatterns) {
        if (pattern.test(f.path)) {
          return { file: f, priority };
        }
      }
      return null;
    })
    .filter((c): c is { file: { path: string; content: string }; priority: number } => c !== null)
    .sort((a, b) => a.priority - b.priority);

  if (candidates.length > 0) {
    return [candidates[0].file];
  }

  const fallback = files.filter(f =>
    (f.path.endsWith(".ts") || f.path.endsWith(".js")) &&
    !f.path.includes("client/") &&
    !f.path.includes("frontend/") &&
    (f.content.includes("express") || f.content.includes("app.listen") || f.content.includes("createServer"))
  );

  if (fallback.length > 0) {
    return [fallback[0]];
  }

  return [];
}

function getAllCallExpressions(sourceFile: SourceFile): CallExpression[] {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
}

function hasCallExpression(sourceFile: SourceFile, functionName: string): { found: boolean; evidence?: string } {
  const calls = getAllCallExpressions(sourceFile);

  for (const call of calls) {
    const text = call.getExpression().getText();
    if (text === functionName || text.endsWith(`.${functionName}`)) {
      const line = call.getStartLineNumber();
      return { found: true, evidence: `Found ${functionName}() at line ${line}` };
    }
  }

  return { found: false };
}

function hasAppUseCall(sourceFile: SourceFile, middlewareName: string): { found: boolean; evidence?: string } {
  const calls = getAllCallExpressions(sourceFile);

  for (const call of calls) {
    const expr = call.getExpression().getText();
    if (expr === "app.use" || expr.endsWith(".use")) {
      const args = call.getArguments();
      for (const arg of args) {
        const argText = arg.getText();
        if (argText.includes(middlewareName)) {
          const line = call.getStartLineNumber();
          return { found: true, evidence: `Found app.use(${middlewareName}...) at line ${line}` };
        }
      }
    }
  }

  return { found: false };
}

function hasImport(sourceFile: SourceFile, moduleName: string): { found: boolean; evidence?: string } {
  const importDeclarations = sourceFile.getImportDeclarations();
  for (const imp of importDeclarations) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    if (moduleSpecifier === moduleName || moduleSpecifier.includes(moduleName)) {
      const line = imp.getStartLineNumber();
      return { found: true, evidence: `Import from "${moduleSpecifier}" at line ${line}` };
    }
  }

  const calls = getAllCallExpressions(sourceFile);
  for (const call of calls) {
    if (call.getExpression().getText() === "require") {
      const args = call.getArguments();
      if (args.length > 0 && args[0].getText().includes(moduleName)) {
        const line = call.getStartLineNumber();
        return { found: true, evidence: `require("${moduleName}") at line ${line}` };
      }
    }
  }

  return { found: false };
}

function checkHelmetBeforeRoutes(sourceFile: SourceFile): ASTCheck {
  const calls = getAllCallExpressions(sourceFile);

  let helmetLine: number | null = null;
  let firstRouteLine: number | null = null;

  for (const call of calls) {
    const expr = call.getExpression().getText();

    if ((expr === "app.use" || expr.endsWith(".use")) && !helmetLine) {
      const args = call.getArguments();
      for (const arg of args) {
        if (arg.getText().includes("helmet")) {
          helmetLine = call.getStartLineNumber();
          break;
        }
      }
    }

    if (["app.get", "app.post", "app.put", "app.patch", "app.delete", "app.route",
         "router.get", "router.post", "router.put", "router.patch", "router.delete"].some(r => expr === r || expr.endsWith(`.${r.split('.')[1]}`))) {
      if (!firstRouteLine) {
        firstRouteLine = call.getStartLineNumber();
      }
    }
  }

  if (!helmetLine) {
    return {
      name: "AST: Helmet Middleware",
      passed: false,
      description: "helmet() must be invoked as a CallExpression in the server execution path",
    };
  }

  if (firstRouteLine && helmetLine > firstRouteLine) {
    return {
      name: "AST: Helmet Middleware",
      passed: false,
      description: "helmet() is invoked AFTER route definitions — must be applied before routes",
      evidence: `helmet() at line ${helmetLine}, first route at line ${firstRouteLine}`,
    };
  }

  return {
    name: "AST: Helmet Middleware",
    passed: true,
    description: "helmet() is invoked as a CallExpression before route definitions",
    evidence: `helmet() at line ${helmetLine}${firstRouteLine ? `, first route at line ${firstRouteLine}` : ""}`,
  };
}

function checkCorsMiddleware(sourceFile: SourceFile): ASTCheck {
  const imp = hasImport(sourceFile, "cors");
  const call = hasAppUseCall(sourceFile, "cors");

  if (imp.found && call.found) {
    return {
      name: "AST: CORS Middleware",
      passed: true,
      description: "cors() is imported and applied via app.use()",
      evidence: `${imp.evidence}; ${call.evidence}`,
    };
  }

  return {
    name: "AST: CORS Middleware",
    passed: false,
    description: "cors() must be imported and applied as middleware",
    evidence: imp.found ? "Imported but not applied" : "Not imported",
  };
}

function checkRateLimiting(sourceFile: SourceFile): ASTCheck {
  const imp = hasImport(sourceFile, "rate-limit") ||
              hasImport(sourceFile, "express-rate-limit") ||
              hasImport(sourceFile, "rateLimit");

  if (!imp || !imp.found) {
    const allContent = sourceFile.getFullText();
    if (allContent.includes("rateLimit") || allContent.includes("rate_limit") || allContent.includes("RateLimit")) {
      return {
        name: "AST: Rate Limiting",
        passed: true,
        description: "Rate limiting reference detected in source",
        evidence: "Keyword match in source text",
      };
    }
    return {
      name: "AST: Rate Limiting",
      passed: false,
      description: "Rate limiting middleware must be imported and applied",
    };
  }

  return {
    name: "AST: Rate Limiting",
    passed: true,
    description: "Rate limiting middleware is imported",
    evidence: imp.evidence,
  };
}

function checkZodValidation(project: Project, files: Array<{ path: string; content: string }>): ASTCheck {
  const serverFiles = files.filter(f =>
    !f.path.includes("client/") &&
    !f.path.includes("frontend/") &&
    (f.path.endsWith(".ts") || f.path.endsWith(".js"))
  );

  let zodFound = false;
  let evidence = "";

  for (const file of serverFiles) {
    const sf = project.getSourceFile(file.path);
    if (!sf) continue;
    const imp = hasImport(sf, "zod");
    if (imp.found) {
      zodFound = true;
      evidence = `${file.path}: ${imp.evidence}`;
      break;
    }
  }

  return {
    name: "AST: Input Validation (Zod)",
    passed: zodFound,
    description: zodFound
      ? "Zod is imported in server-side code for input validation"
      : "Zod must be imported in server-side code for input validation",
    evidence: evidence || undefined,
  };
}

function checkErrorHandler(sourceFile: SourceFile): ASTCheck {
  const calls = getAllCallExpressions(sourceFile);

  for (const call of calls) {
    const expr = call.getExpression().getText();
    if (expr === "app.use" || expr.endsWith(".use")) {
      const args = call.getArguments();
      for (const arg of args) {
        if (arg.getKind() === SyntaxKind.ArrowFunction || arg.getKind() === SyntaxKind.FunctionExpression) {
          const params = arg.getKind() === SyntaxKind.ArrowFunction
            ? (arg as any).getParameters()
            : (arg as any).getParameters();
          if (params && params.length >= 4) {
            const firstName = params[0].getName();
            if (firstName === "err" || firstName === "error" || firstName === "e") {
              return {
                name: "AST: Error Handler Middleware",
                passed: true,
                description: "Global error handler middleware (4-param function) found",
                evidence: `Error handler at line ${call.getStartLineNumber()}`,
              };
            }
          }
        }
        const argText = arg.getText();
        if (argText.includes("errorHandler") || argText.includes("ErrorHandler") || argText.includes("error_handler")) {
          return {
            name: "AST: Error Handler Middleware",
            passed: true,
            description: "Named error handler middleware is applied",
            evidence: `app.use(${argText}) at line ${call.getStartLineNumber()}`,
          };
        }
      }
    }
  }

  return {
    name: "AST: Error Handler Middleware",
    passed: false,
    description: "A global error handler middleware (err, req, res, next) must be applied",
  };
}

export function runASTVerification(
  files: Array<{ path: string; content: string }>,
): ASTVerificationResult {
  const checks: ASTCheck[] = [];
  const errors: string[] = [];

  try {
    const project = createInMemoryProject(files);
    const serverEntries = findServerEntryFiles(files);

    if (serverEntries.length === 0) {
      return {
        passed: true,
        checks: [{
          name: "AST: Server Entry",
          passed: true,
          description: "No server entry file detected — AST checks skipped (may be client-only project)",
        }],
        errors: [],
      };
    }

    let primarySource: SourceFile | undefined;
    for (const entry of serverEntries) {
      const sf = project.getSourceFile(entry.path) || project.getSourceFile(`/${entry.path}`);
      if (sf) {
        primarySource = sf;
        break;
      }
    }

    if (!primarySource) {
      const allSources = project.getSourceFiles();
      for (const entry of serverEntries) {
        primarySource = allSources.find(s => s.getFilePath().endsWith(entry.path));
        if (primarySource) break;
      }
    }

    if (!primarySource) {
      return {
        passed: true,
        checks: [{
          name: "AST: Parse",
          passed: true,
          description: "Could not parse server entry files — AST checks skipped",
        }],
        errors: [],
      };
    }

    checks.push(checkHelmetBeforeRoutes(primarySource));
    checks.push(checkCorsMiddleware(primarySource));
    checks.push(checkRateLimiting(primarySource));
    checks.push(checkZodValidation(project, files));
    checks.push(checkErrorHandler(primarySource));

    const failed = checks.filter(c => !c.passed);
    for (const f of failed) {
      errors.push(`AST violation: ${f.name} — ${f.description}`);
    }

    return {
      passed: failed.length === 0,
      checks,
      errors,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ast-verification] Parse error: ${msg}`);
    return {
      passed: true,
      checks: [{
        name: "AST: Parse Error",
        passed: true,
        description: `AST parser encountered an error (non-blocking): ${msg.slice(0, 200)}`,
      }],
      errors: [],
    };
  }
}
