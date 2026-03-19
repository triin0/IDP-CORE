import { hardenGeneratedTypes } from "./type-hardener";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

console.log("\n=== Pass 1: fixServerTsconfig ===");
{
  const files = [
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          outDir: "./dist",
          strict: true,
        },
        include: ["src/**/*"],
      }, null, 2),
    },
    { path: "server/src/index.ts", content: "console.log('hi');" },
  ];

  const result = hardenGeneratedTypes(files);
  const tsconfig = JSON.parse(result.files.find(f => f.path === "server/tsconfig.json")!.content);

  assert(tsconfig.compilerOptions.moduleResolution === "bundler",
    `moduleResolution changed to bundler (got: ${tsconfig.compilerOptions.moduleResolution})`);
  assert(tsconfig.compilerOptions.module === "ES2022",
    `module changed to ES2022 (got: ${tsconfig.compilerOptions.module})`);
  assert(result.fixes.some(f => f.includes("moduleResolution")),
    "Fix message mentions moduleResolution");
  assert(tsconfig.compilerOptions.strict === true,
    "Other tsconfig fields preserved");
  assert(tsconfig.include[0] === "src/**/*",
    "include array preserved");
}

console.log("\n=== Pass 1b: fixServerTsconfig - node16 lowercase ===");
{
  const files = [
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          module: "node16",
          moduleResolution: "node16",
        },
      }, null, 2),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const tsconfig = JSON.parse(result.files.find(f => f.path === "server/tsconfig.json")!.content);

  assert(tsconfig.compilerOptions.moduleResolution === "bundler",
    `node16 moduleResolution changed to bundler (got: ${tsconfig.compilerOptions.moduleResolution})`);
  assert(tsconfig.compilerOptions.module === "ES2022",
    `node16 module changed to ES2022 (got: ${tsconfig.compilerOptions.module})`);
}

console.log("\n=== Pass 1c: fixServerTsconfig - no-op when already bundler ===");
{
  const files = [
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          module: "ES2022",
          moduleResolution: "bundler",
        },
      }, null, 2),
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("moduleResolution")),
    "No fix when already using bundler");
}

console.log("\n=== Pass 2: fixMissingTypeDeclarations ===");
{
  const files = [
    {
      path: "server/package.json",
      content: JSON.stringify({
        name: "server",
        dependencies: {
          express: "^4.18.0",
          cors: "^2.8.5",
          "cookie-parser": "^1.4.6",
          bcryptjs: "^2.4.3",
          jsonwebtoken: "^9.0.0",
        },
      }, null, 2),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const pkg = JSON.parse(result.files.find(f => f.path === "server/package.json")!.content);

  assert(pkg.devDependencies["@types/express"] === "*",
    `@types/express injected (got: ${pkg.devDependencies["@types/express"]})`);
  assert(pkg.devDependencies["@types/cors"] === "*",
    `@types/cors injected (got: ${pkg.devDependencies["@types/cors"]})`);
  assert(pkg.devDependencies["@types/cookie-parser"] === "*",
    `@types/cookie-parser injected`);
  assert(pkg.devDependencies["@types/bcryptjs"] === "*",
    `@types/bcryptjs injected`);
  assert(pkg.devDependencies["@types/jsonwebtoken"] === "*",
    `@types/jsonwebtoken injected`);
  assert(pkg.devDependencies["@types/node"] === "^20.0.0",
    `@types/node injected (got: ${pkg.devDependencies["@types/node"]})`);
  assert(result.fixes.filter(f => f.includes("Injected")).length === 6,
    `6 injection fixes reported (got: ${result.fixes.filter(f => f.includes("Injected")).length})`);
}

console.log("\n=== Pass 2b: fixMissingTypeDeclarations - no-op when types exist ===");
{
  const files = [
    {
      path: "server/package.json",
      content: JSON.stringify({
        name: "server",
        dependencies: { express: "^4.18.0" },
        devDependencies: { "@types/express": "^4.17.0", "@types/node": "^20.0.0" },
      }, null, 2),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const pkg = JSON.parse(result.files.find(f => f.path === "server/package.json")!.content);

  assert(pkg.devDependencies["@types/express"] === "^4.17.0",
    "Existing @types/express version preserved");
  assert(!result.fixes.some(f => f.includes("@types/express")),
    "No fix for already-present @types/express");
}

console.log("\n=== Pass 3: fixDrizzleInsertSchemaImports ===");
{
  const files = [
    {
      path: "server/src/schema/incidents.ts",
      content: `import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});`,
    },
    {
      path: "server/src/routes/incidents.ts",
      content: `import { incidents, insertIncidentsSchema } from "../schema";
import { eq } from "drizzle-orm";

router.post("/", async (req, res) => {
  const data = insertIncidentsSchema.parse(req.body);
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/incidents.ts")!;

  assert(routeFile.content.includes('createInsertSchema'),
    "createInsertSchema added to route file");
  assert(routeFile.content.includes('from "drizzle-zod"'),
    "drizzle-zod import added");
  assert(routeFile.content.includes('createInsertSchema(incidents)'),
    `insertIncidentsSchema derived from createInsertSchema(incidents)`);
  assert(result.fixes.some(f => f.includes("schema imports")),
    "Fix message mentions schema imports");
}

console.log("\n=== Pass 4: fixExpressV5Params ===");
{
  const files = [
    {
      path: "server/src/routes/incidents.ts",
      content: `import { Router } from "express";
const router = Router();

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const incident = await db.query.incidents.findFirst({
    where: eq(incidents.id, parseInt(id))
  });
  res.json(incident);
});

router.get("/:incidentId/timeline", async (req, res) => {
  const timelineId = req.params.incidentId;
  res.json({ id: timelineId });
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/incidents.ts")!;

  assert(routeFile.content.includes("req.params.id as string;"),
    `Destructured params replaced with 'as string' cast`);
  assert(!routeFile.content.includes("const { id } = req.params"),
    "Destructuring removed");
  assert(routeFile.content.includes("(req.params.incidentId as string)"),
    `Direct params access gets 'as string' cast`);
  assert(result.fixes.some(f => f.includes("Express v5")),
    "Fix message mentions Express v5");
}

console.log("\n=== Pass 5: fixDrizzleEnumFiltering ===");
{
  const files = [
    {
      path: "server/src/schema/incidents.ts",
      content: `import { pgEnum, pgTable, serial, text } from "drizzle-orm/pg-core";
export const severityEnum = pgEnum("severity", ["critical", "high", "medium", "low"]);
export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  severity: severityEnum("severity"),
});`,
    },
    {
      path: "server/src/routes/incidents.ts",
      content: `import { eq } from "drizzle-orm";
router.get("/", async (req, res) => {
  const result = await db.select().from(incidents).where(eq(incidents.severity, req.query.severity));
  res.json(result);
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/incidents.ts")!;

  assert(routeFile.content.includes("as any)"),
    `eq() enum value cast with 'as any'`);
  assert(result.fixes.some(f => f.includes("enum filtering")),
    "Fix message mentions enum filtering");
}

console.log("\n=== Pass 6: fixDrizzleTableFields ===");
{
  const files = [
    {
      path: "server/src/routes/admin.ts",
      content: `import { eq } from "drizzle-orm";
import { users } from "../schema";

router.get("/columns", async (req, res) => {
  const columns = users.fields;
  res.json(columns);
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/admin.ts")!;

  assert(routeFile.content.includes("getTableColumns(users)"),
    `users.fields replaced with getTableColumns(users)`);
  assert(!routeFile.content.includes("users.fields"),
    "users.fields no longer present");
  assert(routeFile.content.includes("getTableColumns"),
    "getTableColumns import added");
  assert(result.fixes.some(f => f.includes("getTableColumns")),
    "Fix message mentions getTableColumns");
}

console.log("\n=== Pass 7: fixAdminRouteTypes (via Pass 4 pre-handling) ===");
{
  const files = [
    {
      path: "server/src/routes/admin.ts",
      content: `import { Router } from "express";
const router = Router();
const tables: Record<string, any> = { users, incidents };

router.get("/:table", async (req, res) => {
  const table = tables[req.params.table];
  const id = Number(req.params.id);
  res.json({ table, id });
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/admin.ts")!;

  assert(routeFile.content.includes("tables[(req.params.table as string)]"),
    `tables[req.params.table] gets 'as string' cast via Pass 4`);
  assert(routeFile.content.includes("Number((req.params.id as string))"),
    `Number(req.params.id) gets 'as string' cast via Pass 4`);
  assert(result.fixes.some(f => f.includes("Express v5") || f.includes("admin route")),
    "Fix message mentions Express v5 or admin route");
}

console.log("\n=== Pass 8: fixFramerMotionPropSpreads ===");
{
  const files = [
    {
      path: "client/src/components/ui/Button.tsx",
      content: `import { motion } from "framer-motion";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ children, variant = "primary", className, ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      {...props}
      className={className}
    >
      {children}
    </motion.button>
  );
}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const btnFile = result.files.find(f => f.path === "client/src/components/ui/Button.tsx")!;

  assert(btnFile.content.includes("{...(props as any)}"),
    `motion.button prop spread cast to any`);
  assert(!btnFile.content.includes("{...props}"),
    "Raw {...props} no longer present");
  assert(result.fixes.some(f => f.includes("motion component")),
    "Fix message mentions motion component");
}

console.log("\n=== Pass 8b: fixFramerMotionPropSpreads - no-op without motion ===");
{
  const files = [
    {
      path: "client/src/components/Card.tsx",
      content: `import React from "react";
export function Card({ ...props }) {
  return <div {...props} />;
}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const cardFile = result.files.find(f => f.path === "client/src/components/Card.tsx")!;
  assert(!result.fixes.some(f => f.includes("motion")),
    "No fix when no motion components");
  assert(cardFile.content.includes("{...props}"),
    "Non-motion spread unchanged");
}

console.log("\n=== Pass 8c: fixFramerMotionPropSpreads - motion.div with spread ===");
{
  const files = [
    {
      path: "client/src/components/AnimatedCard.tsx",
      content: `import { motion } from "framer-motion";
export function AnimatedCard({ className, ...rest }: any) {
  return <motion.div animate={{ opacity: 1 }} {...rest} className={className} />;
}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const file = result.files.find(f => f.path === "client/src/components/AnimatedCard.tsx")!;

  assert(file.content.includes("{...(rest as any)}"),
    "motion.div prop spread cast to any");
}

console.log("\n=== Integration: all passes together (realistic generation) ===");
{
  const files = [
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          outDir: "./dist",
          strict: true,
        },
      }, null, 2),
    },
    {
      path: "server/package.json",
      content: JSON.stringify({
        name: "server",
        dependencies: {
          express: "^4.18.0",
          cors: "^2.8.5",
          "cookie-parser": "^1.4.6",
          bcryptjs: "^2.4.3",
        },
      }, null, 2),
    },
    {
      path: "server/src/schema/incidents.ts",
      content: `import { pgEnum, pgTable, serial, text } from "drizzle-orm/pg-core";
export const severityEnum = pgEnum("severity", ["critical", "high", "medium", "low"]);
export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  severity: severityEnum("severity"),
});`,
    },
    {
      path: "server/src/routes/incidents.ts",
      content: `import { Router } from "express";
import { eq } from "drizzle-orm";
import { incidents, insertIncidentsSchema } from "../schema";
const router = Router();

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const incident = await db.select().from(incidents).where(eq(incidents.id, parseInt(id)));
  res.json(incident);
});

router.get("/by-severity", async (req, res) => {
  const result = await db.select().from(incidents).where(eq(incidents.severity, req.query.severity));
  res.json(result);
});

router.post("/", async (req, res) => {
  const data = insertIncidentsSchema.parse(req.body);
  res.json(data);
});`,
    },
    {
      path: "server/src/routes/admin.ts",
      content: `import { Router } from "express";
import { eq } from "drizzle-orm";
import { incidents } from "../schema";
const router = Router();
const tables: Record<string, any> = { incidents };

router.get("/:table", async (req, res) => {
  const table = tables[req.params.table];
  const columns = incidents.fields;
  res.json({ columns });
});`,
    },
    { path: "client/src/App.tsx", content: "export default function App() { return <div>Hi</div>; }" },
    {
      path: "client/src/components/ui/Button.tsx",
      content: `import { motion } from "framer-motion";
export function Button({ children, ...props }: any) {
  return <motion.button whileTap={{ scale: 0.97 }} {...props}>{children}</motion.button>;
}`,
    },
  ];

  const result = hardenGeneratedTypes(files);

  const tsconfig = JSON.parse(result.files.find(f => f.path === "server/tsconfig.json")!.content);
  assert(tsconfig.compilerOptions.moduleResolution === "bundler", "Integration: tsconfig fixed");

  const pkg = JSON.parse(result.files.find(f => f.path === "server/package.json")!.content);
  assert(!!pkg.devDependencies["@types/express"], "Integration: @types/express injected");
  assert(!!pkg.devDependencies["@types/cors"], "Integration: @types/cors injected");
  assert(!!pkg.devDependencies["@types/cookie-parser"], "Integration: @types/cookie-parser injected");
  assert(!!pkg.devDependencies["@types/bcryptjs"], "Integration: @types/bcryptjs injected");

  const routeFile = result.files.find(f => f.path === "server/src/routes/incidents.ts")!;
  assert(routeFile.content.includes("as string"), "Integration: params hardened");
  assert(routeFile.content.includes("createInsertSchema"), "Integration: insert schema fixed");
  assert(routeFile.content.includes("as any)"), "Integration: enum filtering hardened");

  const adminFile = result.files.find(f => f.path === "server/src/routes/admin.ts")!;
  assert(adminFile.content.includes("(req.params.table as string)]"), "Integration: admin tables index hardened");
  assert(adminFile.content.includes("getTableColumns"), "Integration: .fields replaced");

  const clientFile = result.files.find(f => f.path === "client/src/App.tsx")!;
  assert(clientFile.content === "export default function App() { return <div>Hi</div>; }",
    "Integration: non-motion client files untouched");

  const btnFile = result.files.find(f => f.path === "client/src/components/ui/Button.tsx")!;
  assert(btnFile.content.includes("{...(props as any)}"),
    "Integration: motion.button prop spread cast");

  console.log(`\nIntegration total fixes: ${result.fixes.length}`);
  result.fixes.forEach(f => console.log(`  - ${f}`));
}

console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
