import { runASTVerification } from "../ast-verification";
import { computeFullTreeHash, computeSHA256, computePayloadHash, computeFullTreeManifest } from "../hash-integrity";

const VALID_SERVER_CODE: Array<{ path: string; content: string }> = [
  {
    path: "package.json",
    content: JSON.stringify({
      name: "test-app",
      scripts: { build: "tsc", start: "node dist/index.js" },
      dependencies: {
        express: "^4.18.0",
        helmet: "^7.0.0",
        cors: "^2.8.5",
        "express-rate-limit": "^7.0.0",
        zod: "^3.22.0",
      },
    }, null, 2),
  },
  {
    path: "tsconfig.json",
    content: JSON.stringify({ compilerOptions: { target: "ES2020", module: "commonjs", outDir: "dist", strict: true } }, null, 2),
  },
  {
    path: "server/src/index.ts",
    content: `
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

const userSchema = z.object({ name: z.string(), email: z.string().email() });

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/users", (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error });
  res.json({ user: parsed.data });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(3000, () => console.log("Server running on port 3000"));
`,
  },
  {
    path: "server/src/schema/user.ts",
    content: `import { z } from "zod";\nexport const UserSchema = z.object({ id: z.string(), name: z.string() });`,
  },
  {
    path: "client/src/App.tsx",
    content: `export default function App() { return <div>Hello</div>; }`,
  },
];

const INSECURE_SERVER_CODE: Array<{ path: string; content: string }> = [
  {
    path: "package.json",
    content: JSON.stringify({
      name: "insecure-app",
      dependencies: { express: "^4.18.0" },
    }, null, 2),
  },
  {
    path: "src/index.ts",
    content: `
import express from "express";

const app = express();

app.get("/api/data", (req, res) => {
  res.json({ data: "hello" });
});

app.listen(3000);
`,
  },
];

console.log("=== AST VERIFICATION TESTS ===\n");

console.log("--- Test 1: Valid server with all security middleware ---");
const validResult = runASTVerification(VALID_SERVER_CODE);
console.log(`Overall passed: ${validResult.passed}`);
for (const check of validResult.checks) {
  console.log(`  [${check.passed ? "PASS" : "FAIL"}] ${check.name}: ${check.description}`);
  if (check.evidence) console.log(`         Evidence: ${check.evidence}`);
}
console.assert(validResult.passed === true, "Valid server should pass all AST checks");
console.log("");

console.log("--- Test 2: Insecure server missing security middleware ---");
const insecureResult = runASTVerification(INSECURE_SERVER_CODE);
console.log(`Overall passed: ${insecureResult.passed}`);
for (const check of insecureResult.checks) {
  console.log(`  [${check.passed ? "PASS" : "FAIL"}] ${check.name}: ${check.description}`);
}
console.assert(insecureResult.passed === false, "Insecure server should fail AST checks");
const failedChecks = insecureResult.checks.filter(c => !c.passed);
console.assert(failedChecks.length >= 3, `Expected at least 3 failures, got ${failedChecks.length}`);
console.log(`  Errors (${insecureResult.errors.length}): ${insecureResult.errors.join("; ")}`);
console.log("");

console.log("--- Test 3: Client-only project (no server entry) ---");
const clientOnly = runASTVerification([
  { path: "client/src/App.tsx", content: `export default function App() { return <div/>; }` },
]);
console.log(`Overall passed: ${clientOnly.passed} (should be true — skipped)`);
console.assert(clientOnly.passed === true, "Client-only should skip AST checks gracefully");
console.log("");

console.log("--- Test 4: Helmet AFTER routes (ordering violation) ---");
const helmetAfterRoutes = runASTVerification([
  {
    path: "src/index.ts",
    content: `
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { z } from "zod";

const app = express();
app.use(cors());

app.get("/api/data", (req, res) => { res.json({}); });
app.post("/api/items", (req, res) => { res.json({}); });

// Oops — helmet applied AFTER routes
app.use(helmet());

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({ error: "fail" });
});

app.listen(3000);
`,
  },
]);
const helmetCheck = helmetAfterRoutes.checks.find(c => c.name === "AST: Helmet Middleware");
console.log(`Helmet ordering check passed: ${helmetCheck?.passed} (should be false — helmet after routes)`);
if (helmetCheck?.evidence) console.log(`  Evidence: ${helmetCheck.evidence}`);
console.assert(helmetCheck?.passed === false, "Helmet after routes should fail");
console.log("");


console.log("\n=== FULL-TREE HASH MANIFEST TESTS ===\n");

console.log("--- Test 5: Full tree hash computation ---");
const hashResult = computeFullTreeHash(VALID_SERVER_CODE, [
  "package.json",
  "tsconfig.json",
  "server/src/index.ts",
  "server/src/schema/user.ts",
  "client/src/App.tsx",
]);
console.log(`File count: ${hashResult.fileCount}`);
console.log(`Payload hash: ${hashResult.payloadHash}`);
console.log(`Manifest hashes: ${hashResult.manifest.hashes.length}`);
console.log(`Spec match ratio: ${(hashResult.specComparison.matchRatio * 100).toFixed(0)}%`);
console.log(`Missing files: ${hashResult.specComparison.missing.length}`);
console.log(`Unexpected files: ${hashResult.specComparison.unexpected.length}`);
console.assert(hashResult.fileCount === 5, "Should have 5 files");
console.assert(hashResult.manifest.hashes.length === 5, "Should hash all 5 files");
console.assert(hashResult.payloadHash.length === 64, "SHA-256 should be 64 hex chars");
console.assert(hashResult.specComparison.matchRatio === 1, "All spec files should match");
console.assert(hashResult.specComparison.missing.length === 0, "No missing files");
console.log("");

console.log("--- Test 6: Spec mismatch detection (missing files) ---");
const mismatchResult = computeFullTreeHash(
  [{ path: "package.json", content: "{}" }],
  ["package.json", "tsconfig.json", "server/src/index.ts"],
);
console.log(`Match ratio: ${(mismatchResult.specComparison.matchRatio * 100).toFixed(0)}%`);
console.log(`Missing: ${mismatchResult.specComparison.missing.join(", ")}`);
console.assert(mismatchResult.specComparison.missing.length === 2, "Should detect 2 missing files");
console.assert(mismatchResult.specComparison.matchRatio < 0.5, "Match ratio should be low");
console.log("");

console.log("--- Test 7: Deterministic payload hash ---");
const hash1 = computeFullTreeHash(VALID_SERVER_CODE).payloadHash;
const hash2 = computeFullTreeHash(VALID_SERVER_CODE).payloadHash;
console.log(`Hash 1: ${hash1}`);
console.log(`Hash 2: ${hash2}`);
console.log(`Deterministic: ${hash1 === hash2}`);
console.assert(hash1 === hash2, "Same input should produce same hash");
console.log("");

console.log("--- Test 8: Content change = different hash ---");
const modifiedFiles = [...VALID_SERVER_CODE];
modifiedFiles[0] = { ...modifiedFiles[0], content: modifiedFiles[0].content + "\n" };
const hash3 = computeFullTreeHash(modifiedFiles).payloadHash;
console.log(`Original hash: ${hash1}`);
console.log(`Modified hash: ${hash3}`);
console.log(`Different: ${hash1 !== hash3}`);
console.assert(hash1 !== hash3, "Modified content should produce different hash");
console.log("");

console.log("--- Test 9: Individual SHA-256 ---");
const sha = computeSHA256("hello world");
console.log(`SHA-256 of "hello world": ${sha}`);
console.assert(sha === "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9", "SHA-256 should match known value");
console.log("");

let allPassed = true;
const tests = [
  { name: "Valid server passes AST", result: validResult.passed === true },
  { name: "Insecure server fails AST", result: insecureResult.passed === false },
  { name: "Client-only skips AST", result: clientOnly.passed === true },
  { name: "Helmet ordering detected", result: helmetCheck?.passed === false },
  { name: "Full tree hashes all files", result: hashResult.manifest.hashes.length === 5 },
  { name: "Spec match 100%", result: hashResult.specComparison.matchRatio === 1 },
  { name: "Spec mismatch detected", result: mismatchResult.specComparison.missing.length === 2 },
  { name: "Deterministic hash", result: hash1 === hash2 },
  { name: "Content change = different hash", result: hash1 !== hash3 },
  { name: "SHA-256 matches known value", result: sha === "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9" },
];

console.log("\n=== SUMMARY ===");
for (const t of tests) {
  const icon = t.result ? "✓" : "✗";
  console.log(`  ${icon} ${t.name}`);
  if (!t.result) allPassed = false;
}
console.log(`\n${allPassed ? "ALL 10 TESTS PASSED" : "SOME TESTS FAILED"}`);
if (!allPassed) process.exit(1);
