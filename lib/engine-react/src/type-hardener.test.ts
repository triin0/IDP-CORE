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
  assert(tsconfig.compilerOptions.strict === false,
    "strict disabled to avoid TS7006 implicit any errors");
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
          skipLibCheck: true,
        },
      }, null, 2),
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("moduleResolution")),
    "No fix when already using bundler");
}

console.log("\n=== Pass 1d: fixServerTsconfig - CommonJS + Node resolution ===");
{
  const files = [
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          module: "CommonJS",
          moduleResolution: "Node",
          target: "ES2022",
        },
      }, null, 2),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const tsconfig = result.files.find(f => f.path === "server/tsconfig.json")!.content;
  const parsed = JSON.parse(tsconfig);

  assert(parsed.compilerOptions.module === "ES2022",
    "tsconfig CommonJS: module changed to ES2022");
  assert(parsed.compilerOptions.moduleResolution === "bundler",
    "tsconfig Node: moduleResolution changed to bundler");
}

console.log("\n=== Pass 1e: fixServerTsconfig - removes invalid types entries ===");
{
  const files = [
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          module: "ES2022",
          moduleResolution: "bundler",
          types: ["node", "bcryptjs", "express"],
        },
      }, null, 2),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const tsconfig = result.files.find(f => f.path === "server/tsconfig.json")!.content;
  const parsed = JSON.parse(tsconfig);

  assert(parsed.compilerOptions.types?.includes("node"),
    "tsconfig types: keeps valid 'node' entry");
  assert(!parsed.compilerOptions.types?.includes("bcryptjs"),
    "tsconfig types: removes invalid 'bcryptjs' entry");
  assert(!parsed.compilerOptions.types?.includes("express"),
    "tsconfig types: removes invalid 'express' entry");
  assert(result.fixes.some(f => f.includes("types cleanup")),
    "tsconfig types: fix logged");
}

console.log("\n=== Pass 1e: fixServerTsconfig - removes types array entirely when all invalid ===");
{
  const files = [
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          module: "ES2022",
          moduleResolution: "bundler",
          types: ["bcryptjs", "jsonwebtoken"],
        },
      }, null, 2),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const tsconfig = result.files.find(f => f.path === "server/tsconfig.json")!.content;
  const parsed = JSON.parse(tsconfig);

  assert(!("types" in parsed.compilerOptions),
    "tsconfig types: removes types key entirely when all entries invalid");
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
  assert(!pkg.devDependencies["@types/bcryptjs"],
    `@types/bcryptjs NOT injected (replaced by bcryptjs.d.ts)`);
  assert(pkg.devDependencies["@types/jsonwebtoken"] === "^9.0.0",
    `@types/jsonwebtoken injected with pinned version`);
  assert(pkg.devDependencies["@types/node"] === "^20.0.0",
    `@types/node injected (got: ${pkg.devDependencies["@types/node"]})`);
  assert(result.fixes.filter(f => f.includes("Injected")).length === 5,
    `5 injection fixes reported (got: ${result.fixes.filter(f => f.includes("Injected")).length})`);
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
      path: "server/src/lib/auth.ts",
      content: `import bcrypt from 'bcryptjs';\nexport async function hashPassword(pw: string) { return bcrypt.hash(pw, 10); }`,
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
  assert(!pkg.devDependencies["@types/bcryptjs"], "Integration: @types/bcryptjs removed (using .d.ts instead)");
  assert(result.files.some(f => f.path === "server/src/types/bcryptjs.d.ts"), "Integration: bcryptjs.d.ts generated");

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

console.log("\n=== Pass 9: fixSchemaColumnMismatches - buildSchemaMap ===");
{
  const files = [
    {
      path: "server/src/schema/users.ts",
      content: `import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});`,
    },
    {
      path: "server/src/schema/transactions.ts",
      content: `import { pgTable, serial, integer, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { entities } from './entities';

export const transactionTypeEnum = pgEnum('transaction_type', ['Credit', 'Debit']);
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  sourceEntityId: integer('source_entity_id'),
  amount: decimal('amount').notNull(),
  type: transactionTypeEnum('type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  sourceEntity: one(entities, {
    fields: [transactions.sourceEntityId],
    references: [entities.id],
    relationName: 'sourceEntity'
  }),
  destinationEntity: one(entities, {
    fields: [transactions.destinationEntityId],
    references: [entities.id],
    relationName: 'destinationEntity'
  }),
}));`,
    },
    {
      path: "server/src/routes/transactions.ts",
      content: `import { transactions } from '../schema';
import { desc } from 'drizzle-orm';

router.get('/', async (req, res) => {
  const all = await db.query.transactions.findMany({
    orderBy: [desc(transactions.executedAt)],
    with: {
      fromEntity: true,
      toEntity: true,
    }
  });
  res.json(all);
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/transactions.ts")!;

  assert(!routeFile.content.includes("executedAt"),
    "Schema Mirror: hallucinated column 'executedAt' replaced");
  assert(routeFile.content.includes("transactions.createdAt"),
    "Schema Mirror: 'executedAt' mapped to 'createdAt' (closest timestamp column)");

  assert(!routeFile.content.includes("fromEntity"),
    "Schema Mirror: hallucinated relation 'fromEntity' replaced");
  assert(!routeFile.content.includes("toEntity"),
    "Schema Mirror: hallucinated relation 'toEntity' replaced");
  assert(routeFile.content.includes("sourceEntity"),
    "Schema Mirror: 'fromEntity' mapped to 'sourceEntity'");
  assert(routeFile.content.includes("destinationEntity"),
    "Schema Mirror: 'toEntity' mapped to 'destinationEntity'");

  assert(result.fixes.some(f => f.includes("schema column/relation")),
    "Schema Mirror: fix message logged");
}

console.log("\n=== Pass 9b: fixSchemaColumnMismatches - valid columns untouched ===");
{
  const files = [
    {
      path: "server/src/schema/users.ts",
      content: `import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email').notNull(),
  name: varchar('name'),
});`,
    },
    {
      path: "server/src/routes/users.ts",
      content: `import { users } from '../schema';
const all = await db.select({ id: users.id, email: users.email }).from(users);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/users.ts")!;

  assert(routeFile.content.includes("users.id"),
    "Schema Mirror: valid column 'id' untouched");
  assert(routeFile.content.includes("users.email"),
    "Schema Mirror: valid column 'email' untouched");
  assert(!result.fixes.some(f => f.includes("schema column")),
    "Schema Mirror: no fixes needed for valid columns");
}

console.log("\n=== Pass 9c: fixSchemaColumnMismatches - schema files themselves not modified ===");
{
  const schemaContent = `import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';
export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  name: varchar('name'),
});`;

  const files = [
    { path: "server/src/schema/items.ts", content: schemaContent },
    {
      path: "server/src/routes/items.ts",
      content: `const x = items.bogusField;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const schema = result.files.find(f => f.path === "server/src/schema/items.ts")!;

  assert(schema.content === schemaContent,
    "Schema Mirror: schema file itself not modified");
}

console.log("\n=== Pass 9d: fixSchemaColumnMismatches - closest column fuzzy matching ===");
{
  const files = [
    {
      path: "server/src/schema/orders.ts",
      content: `import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  status: varchar('status'),
  totalAmount: varchar('total_amount'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});`,
    },
    {
      path: "server/src/routes/orders.ts",
      content: `const sorted = await db.select().from(orders).orderBy(orders.orderDate);
const filtered = await db.select({ amount: orders.total }).from(orders);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/orders.ts")!;

  assert(!routeFile.content.includes("orders.orderDate"),
    "Schema Mirror: 'orderDate' replaced (not a valid column)");
  assert(routeFile.content.includes("orders.createdAt") || routeFile.content.includes("orders.updatedAt"),
    "Schema Mirror: 'orderDate' mapped to a timestamp column");
}

console.log("\n=== Pass 9e: fixSchemaColumnMismatches - no schema files means no-op ===");
{
  const files = [
    {
      path: "server/src/routes/test.ts",
      content: `const x = someTable.fakeColumn;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/test.ts")!;

  assert(routeFile.content === `const x = someTable.fakeColumn;`,
    "Schema Mirror: no schema files → no modifications");
}

console.log("\n=== Pass 9f: fixSchemaColumnMismatches - relation removal when no fuzzy match ===");
{
  const files = [
    {
      path: "server/src/schema/posts.ts",
      content: `import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title'),
});
export const postsRelations = relations(posts, ({ many }) => ({
  comments: many(comments),
}));`,
    },
    {
      path: "server/src/routes/posts.ts",
      content: `const all = await db.query.posts.findMany({
  with: { replies: true, comments: true }
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/posts.ts")!;

  assert(!routeFile.content.includes("replies"),
    "Schema Mirror: 'replies' removed (no fuzzy match found)");
  assert(routeFile.content.includes("comments"),
    "Schema Mirror: valid relation 'comments' preserved");
}

console.log("\n=== Pass 9g: fixSchemaColumnMismatches - capital letter properties skipped ===");
{
  const files = [
    {
      path: "server/src/schema/items.ts",
      content: `import { pgTable, serial } from 'drizzle-orm/pg-core';
export const items = pgTable('items', {
  id: serial('id').primaryKey(),
});`,
    },
    {
      path: "server/src/routes/items.ts",
      content: `import { items } from '../schema';
const schema = createInsertSchema(items);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/items.ts")!;

  assert(!result.fixes.some(f => f.includes("items") && f.includes("schema column")),
    "Schema Mirror: capital-letter method calls not treated as column references");
}

console.log("\n=== Pass 9h: fixSchemaColumnMismatches - real Ledger scenario ===");
{
  const files = [
    {
      path: "server/src/schema/transactions.ts",
      content: `import { pgTable, serial, integer, decimal, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { entities } from './entities';

export const transactionTypeEnum = pgEnum('transaction_type', ['Credit', 'Debit', 'Transfer', 'Reversal', 'Fee']);
export const transactionStatusEnum = pgEnum('transaction_status', ['Pending', 'Cleared', 'Failed', 'Disputed']);

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  sourceEntityId: integer('source_entity_id').references(() => entities.id),
  destinationEntityId: integer('destination_entity_id').references(() => entities.id).notNull(),
  amount: decimal('amount', { precision: 19, scale: 4 }).notNull(),
  type: transactionTypeEnum('type').notNull(),
  status: transactionStatusEnum('status').default('Pending').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  sourceEntity: one(entities, {
    fields: [transactions.sourceEntityId],
    references: [entities.id],
    relationName: 'sourceEntity'
  }),
  destinationEntity: one(entities, {
    fields: [transactions.destinationEntityId],
    references: [entities.id],
    relationName: 'destinationEntity'
  }),
}));`,
    },
    {
      path: "server/src/schema/index.ts",
      content: `export * from './transactions';`,
    },
    {
      path: "server/src/routes/transactions.ts",
      content: `import { transactions } from '../schema';
import { desc, eq } from 'drizzle-orm';

router.get('/', async (req, res, next) => {
  try {
    const allTransactions = await db.query.transactions.findMany({
        orderBy: [desc(transactions.executedAt)],
        limit: 100,
        with: {
            fromEntity: true,
            toEntity: true,
        }
    });
    res.json(allTransactions);
  } catch (error) {
    next(error);
  }
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/transactions.ts")!;

  assert(!routeFile.content.includes("executedAt"),
    "Ledger scenario: 'executedAt' replaced");
  assert(routeFile.content.includes("transactions.createdAt"),
    "Ledger scenario: mapped to 'createdAt'");
  assert(!routeFile.content.includes("fromEntity"),
    "Ledger scenario: 'fromEntity' replaced");
  assert(!routeFile.content.includes("toEntity"),
    "Ledger scenario: 'toEntity' replaced");
  assert(routeFile.content.includes("sourceEntity"),
    "Ledger scenario: mapped to 'sourceEntity'");
  assert(routeFile.content.includes("destinationEntity"),
    "Ledger scenario: mapped to 'destinationEntity'");

  console.log("\n  Fixed content snippet:");
  const lines = routeFile.content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("orderBy") || lines[i].includes("with") || lines[i].includes("Entity")) {
      console.log(`    ${i + 1}: ${lines[i]}`);
    }
  }
}

console.log("\n=== Pass 3b: fixDrizzleInsertSchemaImports - selectSchema ===");
{
  const files = [
    {
      path: "server/src/schema/users.ts",
      content: `import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email').notNull(),
});`,
    },
    {
      path: "server/src/schema/index.ts",
      content: `export * from './users';`,
    },
    {
      path: "server/src/routes/users.ts",
      content: `import { users, selectUserSchema } from "../schema";\nconst validated = selectUserSchema.parse(data);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const routeFile = result.files.find(f => f.path === "server/src/routes/users.ts")!;

  assert(routeFile.content.includes("createSelectSchema"),
    "selectSchema: createSelectSchema generated");
  assert(routeFile.content.includes('from "drizzle-zod"'),
    "selectSchema: drizzle-zod import added");
  assert(routeFile.content.includes("selectUserSchema = createSelectSchema(users)"),
    "selectSchema: selectUserSchema derived from createSelectSchema(users)");
}

console.log("\n=== Pass 10: fixBcryptImports ===");
{
  const files = [
    {
      path: "server/package.json",
      content: JSON.stringify({
        dependencies: { bcrypt: "^5.1.0", express: "^5.1.0" },
        devDependencies: {},
      }, null, 2),
    },
    {
      path: "server/src/lib/auth.ts",
      content: `import bcrypt from 'bcrypt';\nconst hash = await bcrypt.hash(password, 10);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const pkg = JSON.parse(result.files.find(f => f.path === "server/package.json")!.content);
  const authFile = result.files.find(f => f.path === "server/src/lib/auth.ts")!;

  assert(pkg.dependencies["bcryptjs"] !== undefined,
    "bcrypt → bcryptjs: bcryptjs added to dependencies");
  assert(pkg.dependencies["bcrypt"] === undefined,
    "bcrypt → bcryptjs: bcrypt removed from dependencies");
  assert(authFile.content.includes("from 'bcryptjs'"),
    "bcrypt → bcryptjs: import rewritten");
  assert(!authFile.content.includes("from 'bcrypt'") || authFile.content.includes("from 'bcryptjs'"),
    "bcrypt → bcryptjs: old import gone");
  assert(result.fixes.some(f => f.includes("bcrypt")),
    "bcrypt → bcryptjs: fix logged");
}

console.log("\n=== Pass 10b: fixBcryptImports - no bcrypt usage ===");
{
  const files = [
    {
      path: "server/package.json",
      content: JSON.stringify({ dependencies: { express: "^5.1.0" } }, null, 2),
    },
    {
      path: "server/src/index.ts",
      content: `import express from 'express';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("bcrypt")),
    "bcrypt no-op: no bcrypt usage means no fix");
}

console.log("\n=== Pass 10c: fixBcryptImports - bcrypt used but not in deps ===");
{
  const files = [
    {
      path: "server/package.json",
      content: JSON.stringify({ dependencies: { express: "^5.1.0" } }, null, 2),
    },
    {
      path: "server/src/lib/auth.ts",
      content: `import bcrypt from 'bcrypt';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const pkg = JSON.parse(result.files.find(f => f.path === "server/package.json")!.content);

  assert(pkg.dependencies["bcryptjs"] !== undefined,
    "bcrypt missing: bcryptjs added to deps");
  assert(result.files.find(f => f.path === "server/src/lib/auth.ts")!.content.includes("bcryptjs"),
    "bcrypt missing: import rewritten to bcryptjs");
}

console.log("\n=== Pass 10d: fixBcryptImports - bcryptjs used but not in deps ===");
{
  const files = [
    {
      path: "server/package.json",
      content: JSON.stringify({ dependencies: { express: "^5.1.0" } }, null, 2),
    },
    {
      path: "server/src/lib/auth.ts",
      content: `import bcrypt from 'bcryptjs';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const pkg = JSON.parse(result.files.find(f => f.path === "server/package.json")!.content);

  assert(pkg.dependencies["bcryptjs"] !== undefined,
    "bcryptjs missing from deps: bcryptjs added");
  assert(result.fixes.some(f => f.includes("bcryptjs")),
    "bcryptjs missing from deps: fix logged");
}

console.log("\n=== Pass 11: fixExpressRequestAugmentation ===");
{
  const files = [
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", strict: true },
        include: ["src/**/*"],
      }, null, 2),
    },
    {
      path: "server/src/middleware/auth.ts",
      content: `export function authMiddleware(req, res, next) {\n  req.user = decoded;\n  next();\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const declFile = result.files.find(f => f.path === "server/src/types/express.d.ts");

  assert(declFile !== undefined,
    "req.user augmentation: declaration file created");
  assert(declFile!.content.includes("declare module"),
    "req.user augmentation: has declare module");
  assert(declFile!.content.includes("user?"),
    "req.user augmentation: declares user property");
  assert(result.fixes.some(f => f.includes("Express Request augmentation")),
    "req.user augmentation: fix logged");

  const tsconfig = JSON.parse(result.files.find(f => f.path === "server/tsconfig.json")!.content);
  assert(tsconfig.include.some((p: string) => p.includes("types")),
    "req.user augmentation: tsconfig include updated");
}

console.log("\n=== Pass 11b: fixExpressRequestAugmentation - no req.user ===");
{
  const files = [
    {
      path: "server/src/routes/index.ts",
      content: `router.get('/', (req, res) => { res.json({ ok: true }); });`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.files.some(f => f.path.includes("express.d.ts")),
    "req.user no-op: no declaration created when no req.user");
}

console.log("\n=== Pass 11c: fixExpressRequestAugmentation - existing declaration ===");
{
  const files = [
    {
      path: "server/src/types/custom.d.ts",
      content: `declare module "express-serve-static-core" { interface Request { user?: any; } }`,
    },
    {
      path: "server/src/middleware/auth.ts",
      content: `req.user = decoded;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("Express Request augmentation")),
    "req.user existing: no duplicate declaration when already present");
}

console.log("\n=== Pass 11d: fixExpressRequestAugmentation - userId-only declaration still injects user ===");
{
  const files = [
    {
      path: "server/src/types.d.ts",
      content: `declare global {\n  namespace Express {\n    interface Request {\n      userId?: string;\n    }\n  }\n}\n\nexport {};`,
    },
    {
      path: "server/src/middleware/auth.ts",
      content: `import { Request, Response, NextFunction } from 'express';\nreq.user = decoded;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(result.files.some(f => f.path === "server/src/types/express.d.ts"),
    "req.user userId-only: express.d.ts injected when only userId declared");
  assert(result.fixes.some(f => f.includes("Express Request augmentation")),
    "req.user userId-only: fix logged");
}

console.log("\n=== Pass 12: fixToFixedOnStrings ===");
{
  const files = [
    {
      path: "server/src/routes/analytics.ts",
      content: `const avg = result.avg.toFixed(2);\nconst total = row.sum.toFixed(4);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const content = result.files.find(f => f.path === "server/src/routes/analytics.ts")!.content;

  assert(content.includes("Number(result.avg).toFixed(2)"),
    "toFixed fix: wraps result.avg in Number()");
  assert(content.includes("Number(row.sum).toFixed(4)"),
    "toFixed fix: wraps row.sum in Number()");
  assert(result.fixes.some(f => f.includes("toFixed")),
    "toFixed fix: fix logged");
}

console.log("\n=== Pass 12b: fixToFixedOnStrings - already Number ===");
{
  const files = [
    {
      path: "server/src/routes/analytics.ts",
      content: `const avg = Number(result.avg).toFixed(2);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const content = result.files.find(f => f.path === "server/src/routes/analytics.ts")!.content;

  assert(content === `const avg = Number(result.avg).toFixed(2);`,
    "toFixed no-op: already wrapped in Number()");
  assert(!result.fixes.some(f => f.includes("toFixed")),
    "toFixed no-op: no fix logged");
}

console.log("\n=== Pass 12c: fixToFixedOnStrings - client files untouched ===");
{
  const files = [
    {
      path: "client/src/components/Chart.tsx",
      content: `const pct = value.toFixed(1);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const content = result.files.find(f => f.path === "client/src/components/Chart.tsx")!.content;

  assert(content === `const pct = value.toFixed(1);`,
    "toFixed client: not modified");
}

console.log("\n=== Pass 13: fixDtsModuleExports ===");
{
  const files = [
    {
      path: "server/src/types.d.ts",
      content: `declare interface User {\n  id: number;\n  email: string;\n}\n\ndeclare type Role = "admin" | "user";\n\ndeclare enum Status {\n  Active = "active",\n}`,
    },
    {
      path: "server/src/routes/auth.ts",
      content: `import { User, Role } from '../types';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const dts = result.files.find(f => f.path === "server/src/types.d.ts")!.content;

  assert(dts.includes("export interface User"),
    "dts fix: declare interface -> export interface");
  assert(dts.includes("export type Role"),
    "dts fix: declare type -> export type");
  assert(dts.includes("export enum Status"),
    "dts fix: declare enum -> export enum");
  assert(!dts.includes("declare interface"),
    "dts fix: no remaining declare interface");
  assert(result.fixes.some(f => f.includes("ambient declarations")),
    "dts fix: fix logged");
}

console.log("\n=== Pass 13b: fixDtsModuleExports - already exported ===");
{
  const files = [
    {
      path: "server/src/types.d.ts",
      content: `export interface User { id: number; }`,
    },
    {
      path: "server/src/routes/auth.ts",
      content: `import { User } from '../types';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("ambient declarations")),
    "dts no-op: already has exports");
}

console.log("\n=== Pass 13c: fixDtsModuleExports - no imports from dts ===");
{
  const files = [
    {
      path: "server/src/types.d.ts",
      content: `declare interface User { id: number; }`,
    },
    {
      path: "server/src/routes/auth.ts",
      content: `import express from 'express';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("ambient declarations")),
    "dts no-op: no files import from types.d.ts");
}

console.log("\n=== Pass 14: fixMissingBarrelExports ===");
{
  const files = [
    {
      path: "server/src/schema/users.ts",
      content: `export const usersTable = pgTable('users', { id: serial('id') });`,
    },
    {
      path: "server/src/schema/transactions.ts",
      content: `export const transactionsTable = pgTable('transactions', { id: serial('id') });`,
    },
    {
      path: "server/src/routes/auth.ts",
      content: `import { usersTable } from '../schema';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const barrel = result.files.find(f => f.path === "server/src/schema/index.ts");

  assert(barrel !== undefined,
    "barrel fix: index.ts created");
  assert(barrel!.content.includes("export * from './users'"),
    "barrel fix: re-exports users");
  assert(barrel!.content.includes("export * from './transactions'"),
    "barrel fix: re-exports transactions");
  assert(result.fixes.some(f => f.includes("barrel export")),
    "barrel fix: fix logged");
}

console.log("\n=== Pass 14b: fixMissingBarrelExports - barrel exists ===");
{
  const files = [
    {
      path: "server/src/schema/users.ts",
      content: `export const usersTable = pgTable('users', {});`,
    },
    {
      path: "server/src/schema/index.ts",
      content: `export * from './users';`,
    },
    {
      path: "server/src/routes/auth.ts",
      content: `import { usersTable } from '../schema';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("barrel export")),
    "barrel no-op: barrel already exists");
}

console.log("\n=== Pass 14c: fixMissingBarrelExports - no imports targeting dir ===");
{
  const files = [
    {
      path: "server/src/schema/users.ts",
      content: `export const usersTable = pgTable('users', {});`,
    },
    {
      path: "server/src/routes/auth.ts",
      content: `import express from 'express';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("barrel export")),
    "barrel no-op: no imports pointing to schema dir");
}

console.log("\n=== Pass 15: fixMissingDrizzleColumnImports ===");
{
  const files = [
    {
      path: "server/src/schema/transactions.ts",
      content: `import { pgTable, serial, text } from 'drizzle-orm/pg-core';\n\nexport const transactions = pgTable('transactions', {\n  id: serial('id'),\n  name: varchar('name', { length: 255 }),\n  amount: numeric('amount'),\n  notes: text('notes'),\n});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const content = result.files.find(f => f.path === "server/src/schema/transactions.ts")!.content;

  assert(content.includes("numeric"),
    "drizzle imports fix: numeric added");
  assert(content.includes("varchar"),
    "drizzle imports fix: varchar added");
  assert(result.fixes.some(f => f.includes("drizzle-orm/pg-core imports")),
    "drizzle imports fix: fix logged");
}

console.log("\n=== Pass 15b: fixMissingDrizzleColumnImports - all present ===");
{
  const files = [
    {
      path: "server/src/schema/users.ts",
      content: `import { pgTable, serial, text } from 'drizzle-orm/pg-core';\n\nexport const users = pgTable('users', { id: serial('id'), name: text('name') });`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("drizzle-orm/pg-core imports")),
    "drizzle imports no-op: all imports present");
}

console.log("\n=== Pass 16: fixMissingNamedExports ===");
{
  const files = [
    {
      path: "server/src/types/index.ts",
      content: `interface User {\n  id: number;\n  email: string;\n}\n\ntype UserRole = "admin" | "user";`,
    },
    {
      path: "server/src/middleware/auth.ts",
      content: `import { User, UserRole } from '../types';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const types = result.files.find(f => f.path === "server/src/types/index.ts")!.content;

  assert(types.includes("export interface User"),
    "named exports fix: interface User exported");
  assert(types.includes("export type UserRole"),
    "named exports fix: type UserRole exported");
  assert(result.fixes.some(f => f.includes("missing exports")),
    "named exports fix: fix logged");
}

console.log("\n=== Pass 16b: fixMissingNamedExports - already exported ===");
{
  const files = [
    {
      path: "server/src/types/index.ts",
      content: `export interface User { id: number; }\nexport type UserRole = "admin" | "user";`,
    },
    {
      path: "server/src/middleware/auth.ts",
      content: `import { User, UserRole } from '../types';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("missing exports")),
    "named exports no-op: already exported");
}

console.log("\n=== Pass 16c: fixMissingNamedExports - function export ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `function protect(req: any, res: any, next: any) { next(); }`,
    },
    {
      path: "server/src/routes/transactions.ts",
      content: `import { protect } from '../middleware/auth';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const auth = result.files.find(f => f.path === "server/src/middleware/auth.ts")!.content;

  assert(auth.includes("export function protect"),
    "named exports fix: function exported");
}

console.log("\n=== Pass 17: fixMissingTypeStubs ===");
{
  const files = [
    {
      path: "server/src/types/index.ts",
      content: `export interface Session { token: string; }`,
    },
    {
      path: "server/src/middleware/auth.ts",
      content: `import { User, UserRole } from '../types';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const types = result.files.find(f => f.path === "server/src/types/index.ts")!.content;

  assert(types.includes("export interface User"),
    "type stubs fix: User stub generated");
  assert(types.includes("export interface UserRole"),
    "type stubs fix: UserRole stub generated");
  assert(result.fixes.some(f => f.includes("stub types")),
    "type stubs fix: fix logged");
}

console.log("\n=== Pass 17b: fixMissingTypeStubs - types already exist ===");
{
  const files = [
    {
      path: "server/src/types/index.ts",
      content: `export interface User { id: number; }\nexport type UserRole = "admin" | "user";`,
    },
    {
      path: "server/src/middleware/auth.ts",
      content: `import { User, UserRole } from '../types';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("stub types")),
    "type stubs no-op: types already defined");
}

console.log("\n=== Pass 17c: fixMissingTypeStubs - lowercase names skipped ===");
{
  const files = [
    {
      path: "server/src/utils/helpers.ts",
      content: `export const something = true;`,
    },
    {
      path: "server/src/routes/main.ts",
      content: `import { validate } from '../utils/helpers';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("stub types")),
    "type stubs no-op: lowercase imports not treated as types");
}

console.log("\n=== Pass 18: fixSignatureMap - synonym match ===");
{
  const files = [
    {
      path: "server/src/middleware/validation.ts",
      content: `import { z } from 'zod';\nexport function validate(schema: any) { return (req: any, res: any, next: any) => next(); }`,
    },
    {
      path: "server/src/routes/entities.ts",
      content: `import { validateRequest } from '../middleware/validation';\n\nconst handler = validateRequest(schema);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/entities.ts")!.content;

  assert(route.includes("validate") && !route.includes("validateRequest"),
    "sig map: validateRequest → validate (synonym)");
  assert(result.fixes.some(f => f.includes("Signature Map") && f.includes("validateRequest→validate")),
    "sig map: fix logged with arrow notation");
}

console.log("\n=== Pass 18b: fixSignatureMap - auth middleware synonym ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `export function authenticate(req: any, res: any, next: any) { next(); }`,
    },
    {
      path: "server/src/routes/transactions.ts",
      content: `import { protect } from '../middleware/auth';\n\nrouter.use(protect);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/transactions.ts")!.content;

  assert(route.includes("authenticate") && !route.includes("protect"),
    "sig map: protect → authenticate (synonym)");
}

console.log("\n=== Pass 18c: fixSignatureMap - levenshtein fuzzy match ===");
{
  const files = [
    {
      path: "server/src/middleware/validation.ts",
      content: `export function validateBody(schema: any) { return (req: any, res: any, next: any) => next(); }`,
    },
    {
      path: "server/src/routes/items.ts",
      content: `import { validatBody } from '../middleware/validation';\n\nconst h = validatBody(schema);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/items.ts")!.content;

  assert(route.includes("validateBody") && !route.includes("validatBody"),
    "sig map: validatBody → validateBody (levenshtein typo fix)");
}

console.log("\n=== Pass 18d: fixSignatureMap - no-op when names match ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `export function protect(req: any, res: any, next: any) { next(); }`,
    },
    {
      path: "server/src/routes/admin.ts",
      content: `import { protect } from '../middleware/auth';\n\nrouter.use(protect);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("Signature Map")),
    "sig map no-op: names already match");
}

console.log("\n=== Pass 18e: fixSignatureMap - star re-export skipped ===");
{
  const files = [
    {
      path: "server/src/schema/index.ts",
      content: `export * from './users';`,
    },
    {
      path: "server/src/routes/admin.ts",
      content: `import { usersTable } from '../schema';\nconsole.log(usersTable);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("Signature Map")),
    "sig map no-op: star re-exports are not analyzed");
}

console.log("\n=== Pass 18f: fixSignatureMap - multiple rewrites in one file ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `export function authenticate(req: any, res: any, next: any) { next(); }\nexport function isAdmin(req: any, res: any, next: any) { next(); }`,
    },
    {
      path: "server/src/routes/admin.ts",
      content: `import { protect, requireAdmin } from '../middleware/auth';\n\nrouter.use(protect);\nrouter.use(requireAdmin);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/admin.ts")!.content;

  assert(route.includes("authenticate") && !route.includes("protect"),
    "sig map multi: protect → authenticate");
  assert(route.includes("isAdmin") && !route.includes("requireAdmin"),
    "sig map multi: requireAdmin → isAdmin");
}

console.log("\n=== Pass 18g: fixSignatureMap - case-insensitive match ===");
{
  const files = [
    {
      path: "server/src/lib/helpers.ts",
      content: `export function formatCurrency(amount: number) { return amount.toFixed(2); }`,
    },
    {
      path: "server/src/routes/analytics.ts",
      content: `import { formatcurrency } from '../lib/helpers';\nconst x = formatcurrency(100);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/analytics.ts")!.content;

  assert(route.includes("formatCurrency") && !route.includes("formatcurrency"),
    "sig map case: formatcurrency → formatCurrency (case-insensitive)");
}

console.log("\n=== Pass 18h: fixSignatureMap - aliased import preserved ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `export function authenticate(req: any, res: any, next: any) { next(); }`,
    },
    {
      path: "server/src/routes/users.ts",
      content: `import { protect as authGuard } from '../middleware/auth';\n\nrouter.use(authGuard);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/users.ts")!.content;

  assert(route.includes("authenticate"),
    "sig map alias: protect rewired to authenticate in import");
  assert(route.includes("authGuard"),
    "sig map alias: local alias authGuard preserved in usage");
}

console.log("\n=== Pass 18i: fixSignatureMap - distant name NOT matched ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `export function authenticate(req: any, res: any, next: any) { next(); }`,
    },
    {
      path: "server/src/routes/items.ts",
      content: `import { formatTransactionData } from '../middleware/auth';\n\nconst x = formatTransactionData();`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/items.ts")!.content;

  assert(route.includes("formatTransactionData"),
    "sig map no-match: distant name preserved (too different for levenshtein)");
  assert(!result.fixes.some(f => f.includes("Signature Map") && f.includes("formatTransactionData")),
    "sig map no-match: no fix logged for distant names");
}

console.log("\n=== Pass 19: fixHardcodedSecrets - JWT secret const ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `import jwt from 'jsonwebtoken';\n\nconst JWT_SECRET = "superSecretKey123abc";\n\nconst token = jwt.sign(payload, JWT_SECRET);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const auth = result.files.find(f => f.path === "server/src/middleware/auth.ts")!.content;

  assert(auth.includes('process.env.JWT_SECRET'),
    "secrets: JWT_SECRET replaced with process.env.JWT_SECRET");
  assert(!auth.includes('"superSecretKey123abc"'),
    "secrets: hardcoded value removed");
  assert(result.fixes.some(f => f.includes("hardcoded secret")),
    "secrets: fix logged");
}

console.log("\n=== Pass 19b: fixHardcodedSecrets - object property pattern ===");
{
  const files = [
    {
      path: "server/src/config/index.ts",
      content: `export const config = {\n  secret: "myAppSecret12345",\n  port: 3000,\n};`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const cfg = result.files.find(f => f.path === "server/src/config/index.ts")!.content;

  assert(cfg.includes('process.env.JWT_SECRET'),
    "secrets obj: secret property replaced with process.env");
  assert(!cfg.includes('"myAppSecret12345"'),
    "secrets obj: literal removed");
}

console.log("\n=== Pass 19c: fixHardcodedSecrets - env template injection ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `const JWT_SECRET = "hardcodedValue12345";\njwt.verify(token, JWT_SECRET);`,
    },
    {
      path: "server/.env.example",
      content: `PORT=3000\nDATABASE_URL=`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const env = result.files.find(f => f.path === "server/.env.example")!.content;

  assert(env.includes("JWT_SECRET="),
    "secrets env: JWT_SECRET added to .env.example");
  assert(result.fixes.some(f => f.includes("Added JWT_SECRET")),
    "secrets env: injection fix logged");
}

console.log("\n=== Pass 19d: fixHardcodedSecrets - no-op when already using process.env ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `const JWT_SECRET = process.env.JWT_SECRET || "";\njwt.verify(token, JWT_SECRET);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("hardcoded secret")),
    "secrets no-op: already using process.env");
}

console.log("\n=== Pass 19e: fixHardcodedSecrets - seed files skipped ===");
{
  const files = [
    {
      path: "server/src/seed.ts",
      content: `const API_KEY = "seedDataApiKey1234";\nconsole.log(API_KEY);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("hardcoded secret")),
    "secrets skip: seed files not processed");
}

console.log("\n=== Pass 19f: fixHardcodedSecrets - short values not matched ===");
{
  const files = [
    {
      path: "server/src/config.ts",
      content: `const secret = "short";\nconsole.log(secret);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("hardcoded secret")),
    "secrets short: values < 8 chars not matched");
}

console.log("\n=== Pass 19g: fixHardcodedSecrets - multiple secrets in one file ===");
{
  const files = [
    {
      path: "server/src/config/secrets.ts",
      content: `const JWT_SECRET = "jwtSecret12345678";\nconst SESSION_SECRET = "sessionKey99887766";\nconst DB_PASSWORD = "dbPass12345678ab";`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const cfg = result.files.find(f => f.path === "server/src/config/secrets.ts")!.content;

  assert(cfg.includes("process.env.JWT_SECRET"),
    "secrets multi: JWT_SECRET replaced");
  assert(cfg.includes("process.env.SESSION_SECRET"),
    "secrets multi: SESSION_SECRET replaced");
  assert(cfg.includes("process.env.DB_PASSWORD"),
    "secrets multi: DB_PASSWORD replaced");
}

console.log("\n=== Pass 19h: fixHardcodedSecrets - camelCase var name ===");
{
  const files = [
    {
      path: "server/src/auth.ts",
      content: `const jwtSecret = "myHardcoded12345";\njwt.sign(data, jwtSecret);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const auth = result.files.find(f => f.path === "server/src/auth.ts")!.content;

  assert(auth.includes("process.env.JWT_SECRET"),
    "secrets camel: jwtSecret → process.env.JWT_SECRET");
}

console.log("\n=== Pass 19i: fixSignatureMap - client files skipped ===");
{
  const files = [
    {
      path: "client/src/lib/helpers.ts",
      content: `export function formatDate(d: Date) { return d.toISOString(); }`,
    },
    {
      path: "client/src/components/Dashboard.tsx",
      content: `import { formatDt } from '../lib/helpers';\nconst x = formatDt(new Date());`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("Signature Map")),
    "sig map skip: client-side files not processed");
}

// ============ Test 20: fixDrizzleZodRefinementKeys ============

console.log("\n=== Pass 20a: fixDrizzleZodRefinementKeys - mismatched keys ===");
{
  const files = [
    {
      path: "server/src/db/schema.ts",
      content: `import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceEntityId: uuid('source_entity_id').notNull(),
  destinationEntityId: uuid('destination_entity_id').notNull(),
  amount: text('amount'),
});`,
    },
    {
      path: "server/src/types/index.ts",
      content: `import { createInsertSchema } from 'drizzle-zod';
import { transactions } from '../db/schema';
import { z } from 'zod';
export const insertTransactionSchema = createInsertSchema(transactions, {
    fromEntityId: z.string().uuid().optional(),
    toEntityId: z.string().uuid().optional()
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const typesFile = result.files.find(f => f.path === "server/src/types/index.ts")!;
  assert(typesFile.content.includes("sourceEntityId"), "should rewrite fromEntityId → sourceEntityId");
  assert(typesFile.content.includes("destinationEntityId"), "should rewrite toEntityId → destinationEntityId");
  assert(!typesFile.content.includes("fromEntityId"), "fromEntityId should be gone");
  assert(!typesFile.content.includes("toEntityId"), "toEntityId should be gone");
  assert(result.fixes.some(f => f.includes("drizzle-zod refinement keys")),
    "should log fix for refinement keys");
}

console.log("\n=== Pass 20b: fixDrizzleZodRefinementKeys - correct keys untouched ===");
{
  const files = [
    {
      path: "server/src/db/schema.ts",
      content: `import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
});`,
    },
    {
      path: "server/src/types/index.ts",
      content: `import { createInsertSchema } from 'drizzle-zod';
import { users } from '../db/schema';
import { z } from 'zod';
export const insertUserSchema = createInsertSchema(users, {
    email: z.string().email(),
    name: z.string().min(1)
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const typesFile = result.files.find(f => f.path === "server/src/types/index.ts")!;
  assert(typesFile.content.includes("email: z.string().email()"), "email key should remain");
  assert(typesFile.content.includes("name: z.string().min(1)"), "name key should remain");
  assert(!result.fixes.some(f => f.includes("drizzle-zod refinement keys")),
    "no fix should be logged when keys match");
}

console.log("\n=== Pass 20c: fixDrizzleZodRefinementKeys - createSelectSchema ===");
{
  const files = [
    {
      path: "server/src/db/schema.ts",
      content: `import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});`,
    },
    {
      path: "server/src/types/index.ts",
      content: `import { createSelectSchema } from 'drizzle-zod';
import { orders } from '../db/schema';
import { z } from 'zod';
export const selectOrderSchema = createSelectSchema(orders, {
    userId: z.string().uuid(),
    orderDate: z.date()
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const typesFile = result.files.find(f => f.path === "server/src/types/index.ts")!;
  assert(typesFile.content.includes("customerId"), "userId should rewrite to customerId");
  assert(typesFile.content.includes("createdAt"), "orderDate should rewrite to createdAt");
  assert(!typesFile.content.includes("userId"), "userId should be gone");
  assert(!typesFile.content.includes("orderDate"), "orderDate should be gone");
}

console.log("\n=== Pass 20d: fixDrizzleZodRefinementKeys - skips schema files ===");
{
  const files = [
    {
      path: "server/src/db/schema.ts",
      content: `import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
});
import { createInsertSchema } from 'drizzle-zod';
export const insertItemSchema = createInsertSchema(items, {
    name: z.string()
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const schemaFile = result.files.find(f => f.path === "server/src/db/schema.ts")!;
  assert(schemaFile.content.includes("name: z.string()"), "schema file should not be modified");
}

console.log("\n=== Pass 20e: fixDrizzleZodRefinementKeys - no-op without calls ===");
{
  const files = [
    {
      path: "server/src/db/schema.ts",
      content: `import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title'),
});`,
    },
    {
      path: "server/src/routes/tasks.ts",
      content: `import express from 'express';
const router = express.Router();
export default router;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("drizzle-zod refinement keys")),
    "no fix when no createInsertSchema/createSelectSchema present");
}

console.log("\n=== Pass 20f: fixDrizzleZodRefinementKeys - no schema files present ===");
{
  const files = [
    {
      path: "server/src/types/index.ts",
      content: `import { createInsertSchema } from 'drizzle-zod';
import { users } from '../db/schema';
import { z } from 'zod';
export const insertUserSchema = createInsertSchema(users, {
    email: z.string().email()
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("drizzle-zod refinement keys")),
    "no fix when no schema files to build column map from");
}

// ============ Test 21: fixDrizzleExecuteDestructuring ============

console.log("\n=== Pass 21a: fixDrizzleExecuteDestructuring - array destructuring ===");
{
  const files = [
    {
      path: "server/src/routes/admin.ts",
      content: `import { db } from '../db';
import { sql } from 'drizzle-orm';

router.get('/stats', async (req, res) => {
    const [{ count: entityCount }] = await db.execute(sql\`SELECT count(*) FROM "entities"\`);
    const [{ count: txCount }] = await db.execute(sql\`SELECT count(*) FROM "transactions"\`);
    res.json({ entityCount, txCount });
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const admin = result.files.find(f => f.path === "server/src/routes/admin.ts")!;
  assert(admin.content.includes(".rows"), "should add .rows accessor to db.execute");
  assert(admin.content.includes("(await db.execute("), "should wrap in parens for .rows");
  assert(result.fixes.some(f => f.includes("db.execute()") || f.includes("destructuring")),
    "should log fix for db.execute destructuring");
}

console.log("\n=== Pass 21b: fixDrizzleExecuteDestructuring - no-op without destructuring ===");
{
  const files = [
    {
      path: "server/src/routes/admin.ts",
      content: `import { db } from '../db';
const result = await db.execute(sql\`SELECT count(*) FROM "users"\`);
res.json(result.rows);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("destructuring")),
    "no fix when db.execute is not destructured");
}

console.log("\n=== Pass 21c: fixDrizzleExecuteDestructuring - skips client files ===");
{
  const files = [
    {
      path: "client/src/api.ts",
      content: `const [data] = await db.execute(sql\`SELECT 1\`);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("destructuring")),
    "no fix for client-side files");
}

console.log("\n=== Pass 21d: fixDrizzleExecuteDestructuring - db.select destructuring ===");
{
  const files = [
    {
      path: "server/src/routes/projects.ts",
      content: `import { db } from '../db';

router.get('/:id', async (req, res) => {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    res.json(project);
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const f = result.files.find(f => f.path === "server/src/routes/projects.ts")!;
  assert(f.content.includes("as any;"), "should cast db.select destructuring as any");
}

// ============ Test 22: fixSchemaBarrelExports ============

console.log("\n=== Pass 22a: fixSchemaBarrelExports - wrapped object rewrite ===");
{
  const files = [
    {
      path: "server/src/schema/index.ts",
      content: `import * as entities from './entities';
import * as transactions from './transactions';

export const schema = {
  ...entities,
  ...transactions,
};`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const barrel = result.files.find(f => f.path === "server/src/schema/index.ts")!;
  assert(barrel.content.includes("export * from './entities'"), "should re-export entities");
  assert(barrel.content.includes("export * from './transactions'"), "should re-export transactions");
  assert(!barrel.content.includes("export const schema"), "should remove wrapped schema export");
  assert(result.fixes.some(f => f.includes("schema barrel")),
    "should log fix for schema barrel");
}

console.log("\n=== Pass 22b: fixSchemaBarrelExports - no-op when already re-exporting ===");
{
  const files = [
    {
      path: "server/src/schema/index.ts",
      content: `export * from './entities';
export * from './transactions';`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("schema barrel")),
    "no fix when already using re-exports");
}

console.log("\n=== Pass 22c: fixSchemaBarrelExports - no-op for non-schema files ===");
{
  const files = [
    {
      path: "server/src/utils/index.ts",
      content: `import * as helpers from './helpers';
export const utils = { ...helpers };`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("schema barrel")),
    "no fix for non-schema barrel files");
}

console.log("\n=== Pass 22d: fixSchemaBarrelExports - handles 3+ schema modules ===");
{
  const files = [
    {
      path: "server/src/schema/index.ts",
      content: `import * as users from './users';
import * as posts from './posts';
import * as comments from './comments';

export const schema = {
  ...users,
  ...posts,
  ...comments,
};`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const barrel = result.files.find(f => f.path === "server/src/schema/index.ts")!;
  assert(barrel.content.includes("export * from './users'"), "should re-export users");
  assert(barrel.content.includes("export * from './posts'"), "should re-export posts");
  assert(barrel.content.includes("export * from './comments'"), "should re-export comments");
}

// ============ Test 23: fixValidateRequestSchema ============

console.log("\n=== Pass 23a: fixValidateRequestSchema - wraps plain object in z.object ===");
{
  const files = [
    {
      path: "server/src/routes/entities.ts",
      content: `import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest';
const router = Router();
router.get('/:id',
  validateRequest({ params: z.object({ id: z.string() }) }),
  async (req, res) => { res.json({}); }
);
router.put('/:id',
  validateRequest({
    params: z.object({ id: z.string() }),
    body: z.object({ name: z.string() }),
  }),
  async (req, res) => { res.json({}); }
);
export default router;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/entities.ts")!;
  assert(route.content.includes("validateRequest(z.object({"), "should wrap plain object in z.object()");
  assert(!route.content.match(/validateRequest\(\s*\{\s*(?:params|body)/), "should not have bare object after fix");
  assert(result.fixes.some(f => f.includes("validateRequest")),
    "should log fix for validateRequest");
}

console.log("\n=== Pass 23b: fixValidateRequestSchema - no-op when already z.object ===");
{
  const files = [
    {
      path: "server/src/routes/users.ts",
      content: `import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest';
const schema = z.object({ body: z.object({ name: z.string() }) });
router.post('/', validateRequest(schema), handler);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("validateRequest") && f.includes("z.object")),
    "no fix when already using z.object variable");
}

console.log("\n=== Pass 23c: fixValidateRequestSchema - adds z import if missing ===");
{
  const files = [
    {
      path: "server/src/routes/items.ts",
      content: `import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
const router = Router();
router.get('/:id',
  validateRequest({ params: require('zod').z.object({ id: require('zod').z.string() }) }),
  async (req, res) => { res.json({}); }
);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/items.ts")!;
  assert(route.content.includes("import { z } from 'zod'"), "should add zod import when missing");
}

// ============ Test 24: fixCatchErrorUnknown ============

console.log("\n=== Pass 24a: fixCatchErrorUnknown - types untyped catch errors ===");
{
  const files = [
    {
      path: "server/src/routes/products.ts",
      content: `router.post('/', async (req, res, next) => {
  try {
    const result = await db.insert(products).values(req.body).returning();
    res.json(result);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Duplicate' });
    }
    next(error);
  }
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/products.ts")!;
  assert(route.content.includes("catch (error: any)"), "should type error as any");
  assert(!route.content.match(/catch\s*\(\s*error\s*\)\s*\{/), "should not have untyped catch");
}

console.log("\n=== Pass 24b: fixCatchErrorUnknown - idempotent on already typed ===");
{
  const files = [
    {
      path: "server/src/routes/users.ts",
      content: `try { } catch (err: any) { console.log(err); }`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/users.ts")!;
  assert(route.content.includes("catch (err: any)"), "should keep existing : any");
  assert(!route.content.includes("catch (err: any: any)"), "should not double-type");
}

// ============ Test 25: fixDrizzleZodRefinementCallbacks ============

console.log("\n=== Pass 25a: fixDrizzleZodRefinementCallbacks - fixes v0.5 style ===");
{
  const files = [
    {
      path: "server/src/lib/validators.ts",
      content: `import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from '../schema';
export const registerSchema = createInsertSchema(users, {
    email: (schema) => schema.email.email(),
    username: (schema) => schema.username.min(3),
}).omit({ id: true });`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const v = result.files.find(f => f.path === "server/src/lib/validators.ts")!;
  assert(v.content.includes("schema.email()") && !v.content.includes("schema.email.email"), "should fix email refinement");
  assert(v.content.includes("schema.min(3)") && !v.content.includes("schema.username.min"), "should fix username refinement");
  assert(v.content.includes(": any)"), "should type callback params as any");
}

console.log("\n=== Pass 25b: fixDrizzleZodRefinementCallbacks - no-op when correct ===");
{
  const files = [
    {
      path: "server/src/types.ts",
      content: `import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from '../schema';
export const schema = createInsertSchema(users, {
    email: (s) => s.email(),
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const types = result.files.find(f => f.path === "server/src/types.ts")!;
  assert(types.content.includes("(s: any) => s.email()"), "should add any type to callback param for type safety");
}

// ============ Test: admin route dynamic table casts ============

console.log("\n=== Admin route dynamic table returning() cast ===");
{
  const files = [
    {
      path: "server/src/routes/admin.ts",
      content: `import { Router } from 'express';
const router = Router();
router.post('/:table', async (req, res) => {
  const table = tables[req.params.table];
  const [data] = await db.insert(table).values(req.body).returning();
  res.json({ data });
});
router.get('/:table/:id', async (req, res) => {
  const table = tables[req.params.table];
  const [data] = await db.select().from(table).where(eq(columns.id, id));
  res.json({ data });
});
export default router;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const admin = result.files.find(f => f.path === "server/src/routes/admin.ts")!;
  assert(admin.content.includes(".returning() as any[]"), "should cast returning() in admin routes");
  assert(admin.content.includes("eq(columns.id, id)) as any[]"), "should cast select().from() in admin routes");
}

// ============ Test 26: fixMissingPackageDeps ============

console.log("\n=== Pass 26: fixMissingPackageDeps - adds missing imported packages ===");
{
  const files = [
    {
      path: "server/package.json",
      content: JSON.stringify({
        dependencies: { express: "^5.1.0", drizzle_orm: "^0.44.0" },
        devDependencies: { typescript: "^5.8.0" },
      }, null, 2),
    },
    {
      path: "server/src/routes/posts.ts",
      content: `import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';
import { db } from '../db';
const clean = DOMPurify.sanitize(content);`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const pkg = JSON.parse(result.files.find(f => f.path === "server/package.json")!.content);
  assert(!pkg.dependencies["isomorphic-dompurify"], "should NOT add banned isomorphic-dompurify");
  assert(pkg.dependencies["marked"] === "latest", "should add marked");
  assert(!pkg.dependencies["fs"], "should not add builtin fs");
}

console.log("\n=== Pass 26b: fixMissingPackageDeps - strips dompurify from existing deps ===");
{
  const files = [
    {
      path: "server/package.json",
      content: JSON.stringify({
        dependencies: { express: "^5.1.0", dompurify: "^3.1.5" },
        devDependencies: {},
      }, null, 2),
    },
    {
      path: "client/package.json",
      content: JSON.stringify({
        dependencies: { react: "^19.0.0", dompurify: "^3.1.5" },
      }, null, 2),
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const serverPkg = JSON.parse(result.files.find(f => f.path === "server/package.json")!.content);
  const clientPkg = JSON.parse(result.files.find(f => f.path === "client/package.json")!.content);
  assert(!serverPkg.dependencies["dompurify"], "should remove dompurify from server");
  assert(!clientPkg.dependencies["dompurify"], "should remove dompurify from client");
}

// ============ Test 27: fixJwtTypeIssues ============

console.log("\n=== Pass 27a: fixJwtTypeIssues - casts jwt.verify and jwt.sign ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `import jwt from 'jsonwebtoken';
const decoded = jwt.verify(token, process.env.JWT_SECRET!);
req.user = decoded;`,
    },
    {
      path: "server/src/routes/auth.ts",
      content: `import jwt from 'jsonwebtoken';
const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: '1d' });`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const auth = result.files.find(f => f.path === "server/src/middleware/auth.ts")!;
  const routes = result.files.find(f => f.path === "server/src/routes/auth.ts")!;
  assert(auth.content.includes("jwt.verify(token, process.env.JWT_SECRET!) as any"), "should cast jwt.verify as any");
  assert(routes.content.includes("as any,") || routes.content.includes("as any)"), "should cast jwt.sign args as any");
}

console.log("\n=== Pass 27b: fixJwtTypeIssues - handles existing type assertions ===");
{
  const files = [
    {
      path: "server/src/lib/auth.ts",
      content: `import jwt from 'jsonwebtoken';
const decoded = jwt.verify(token, JWT_SECRET) as { id: number };`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const auth = result.files.find(f => f.path === "server/src/lib/auth.ts")!;
  assert(auth.content.includes("jwt.verify(token, JWT_SECRET) as any"), "should replace existing assertion with as any");
  assert(!auth.content.includes("as anyas"), "should not have concatenated assertions");
}

// ============ Test 29: fixMissingTypeExports ============

console.log("\n=== Pass 29: fixMissingTypeExports - stubs missing type imports ===");
{
  const files = [
    {
      path: "server/src/middleware/auth.ts",
      content: `import { UserPayload } from '../types';
export function authMiddleware(req: any, res: any, next: any) {}`,
    },
    {
      path: "server/src/types.ts",
      content: `export const API_VERSION = '1.0';`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const types = result.files.find(f => f.path === "server/src/types.ts")!;
  assert(
    types.content.includes("export type UserPayload") || types.content.includes("export interface UserPayload"),
    "should stub or generate UserPayload"
  );
}

console.log("\n=== Pass 29b: fixMissingTypeExports - stubs lowercase schema names ===");
{
  const files = [
    {
      path: "server/src/routes/auth.ts",
      content: `import { loginSchema, registerSchema } from '../types';`,
    },
    {
      path: "server/src/types.ts",
      content: `export const API_VERSION = '1.0';`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const types = result.files.find(f => f.path === "server/src/types.ts")!;
  assert(types.content.includes("loginSchema") && types.content.match(/export\s+const\s+loginSchema/), "should stub loginSchema with z.any()");
  assert(types.content.includes("registerSchema") && types.content.match(/export\s+const\s+registerSchema/), "should stub registerSchema with z.any()");
}

console.log("\n=== Pass 29c: fixMissingTypeExports - skips already exported names ===");
{
  const files = [
    {
      path: "server/src/routes/auth.ts",
      content: `import { db } from '../db';`,
    },
    {
      path: "server/src/db.ts",
      content: `export const db = {};`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const dbFile = result.files.find(f => f.path === "server/src/db.ts")!;
  assert(!dbFile.content.includes("export const db = {} as any"), "should not stub already exported db");
}

// ============ Test 31: fixDrizzleRelationsImport ============

console.log("\n=== Pass 31: fixDrizzleRelationsImport - moves relations from pg-core to drizzle-orm ===");
{
  const files = [
    {
      path: "server/src/schema/ratings.ts",
      content: `import { pgTable, serial, integer, relations } from 'drizzle-orm/pg-core';
import { users } from './users';

export const ratings = pgTable('ratings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
});

export const ratingsRelations = relations(ratings, ({ one }) => ({
  user: one(users, { fields: [ratings.userId], references: [users.id] }),
}));`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const schemaFile = result.files.find(f => f.path === "server/src/schema/ratings.ts")!;
  assert(!schemaFile.content.includes("relations } from 'drizzle-orm/pg-core'"),
    "should remove relations from pg-core import");
  assert(schemaFile.content.includes("relations } from 'drizzle-orm'") || schemaFile.content.includes("relations } from \"drizzle-orm\""),
    "should add relations to drizzle-orm import");
  assert(schemaFile.content.includes("pgTable, serial, integer } from 'drizzle-orm/pg-core'"),
    "should keep other pg-core imports");
}

console.log("\n=== Pass 31b: fixDrizzleRelationsImport - relations only from pg-core ===");
{
  const files = [
    {
      path: "server/src/schema/items.ts",
      content: `import { relations } from 'drizzle-orm/pg-core';

export const itemsRelations = relations(items, ({ one }) => ({}));`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const f = result.files.find(f => f.path === "server/src/schema/items.ts")!;
  assert(!f.content.includes("from 'drizzle-orm/pg-core'"),
    "should remove empty pg-core import");
  assert(f.content.includes("relations") && f.content.includes("from 'drizzle-orm'"),
    "should have relations from drizzle-orm");
}

// ============ Test 30: fixDrizzleDbSchemaGeneric ============

console.log("\n=== Pass 30: fixDrizzleDbSchemaGeneric - adds schema to drizzle() ===");
{
  const files = [
    {
      path: "server/src/db/index.ts",
      content: `import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const dbFile = result.files.find(f => f.path === "server/src/db/index.ts")!;
  assert(dbFile.content.includes("drizzle(pool, { schema })"), "should add schema to drizzle()");
  assert(dbFile.content.includes("import * as schema"), "should add schema import");
}

// ============ Test 28: fixMissingDrizzleOrmImports ============

console.log("\n=== Pass 28: fixMissingDrizzleOrmImports - adds missing operators ===");
{
  const files = [
    {
      path: "server/src/routes/summary.ts",
      content: `import { eq } from 'drizzle-orm';
import { db } from '../db';
import { expenses } from '../schema';
const result = await db.select().from(expenses).where(
  and(
    eq(expenses.userId, userId),
    lt(expenses.date, endDate),
    gte(expenses.date, startDate)
  )
);`,
    },
    {
      path: "server/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ES2022", moduleResolution: "bundler", skipLibCheck: true },
      }),
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/summary.ts")!;
  assert(route.content.includes("and"), "should have and import");
  assert(route.content.includes("lt"), "should have lt import");
  assert(route.content.includes("gte"), "should have gte import");
  assert(route.content.match(/import\s*\{.*lt.*\}\s*from\s*['"]drizzle-orm['"]/), "should include lt in drizzle-orm import");
}

console.log("\n=== Pass 24b: fixDrizzleZodRefinementCallbacks - casts refinement objects ===");
{
  const files = [
    {
      path: "server/src/lib/validators.ts",
      content: `import { createInsertSchema } from 'drizzle-zod';
import { recipes } from '../schema';
export const insertRecipeSchema = createInsertSchema(recipes, {
  title: z.string().min(3).max(255),
  ingredients: z.array(z.string()).min(1),
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const validators = result.files.find(f => f.path === "server/src/lib/validators.ts")!;
  assert(validators.content.includes("} as any"), "should cast refinement object with as any");
  assert(validators.content.includes("createInsertSchema(recipes,"), "should preserve function call");
}

console.log("\n=== Pass 32b: fixMissingTypeStubs - stubs Schema-suffixed imports as const ===");
{
  const files = [
    {
      path: "server/src/routes/auth.ts",
      content: `import { LoginSchema, RegisterSchema } from '../types';
router.post('/login', validateRequest(LoginSchema), handler);
router.post('/register', validateRequest(RegisterSchema), handler);`,
    },
    {
      path: "server/src/types/index.ts",
      content: `export interface User { id: string; email: string; }`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const types = result.files.find(f => f.path === "server/src/types/index.ts")!;
  assert(types.content.includes("export const LoginSchema"), "should stub LoginSchema as const");
  assert(types.content.includes("export const RegisterSchema"), "should stub RegisterSchema as const");
}

console.log("\n=== Pass 33: fixDuplicateIdentifiers - deduplicates import names ===");
{
  const files = [
    {
      path: "server/src/types/api.ts",
      content: `import { insertProductSchema, insertProductSchema, SelectProduct } from './schema';
export type { insertProductSchema, SelectProduct };`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const api = result.files.find(f => f.path === "server/src/types/api.ts")!;
  const importMatch = api.content.match(/import\s*\{([^}]+)\}/);
  const importNames = importMatch![1].split(",").map((s: string) => s.trim());
  const dupeCount = importNames.filter((n: string) => n.startsWith("insertProductSchema")).length;
  assert(dupeCount === 1, "should deduplicate import names");
}

console.log("\n=== Pass 33b: fixDuplicateIdentifiers - removes duplicate declarations ===");
{
  const files = [
    {
      path: "server/src/types/api.ts",
      content: `export const insertProductSchema = z.object({ name: z.string() });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export const insertProductSchema = z.object({ name: z.string(), price: z.number() });`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const api = result.files.find(f => f.path === "server/src/types/api.ts")!;
  const matches = api.content.match(/export const insertProductSchema/g);
  assert(matches!.length === 1, "should keep only first declaration");
  assert(api.content.includes("InsertProduct"), "should preserve non-duplicate type");
}

console.log("\n=== Pass 33c: fixDuplicateIdentifiers - handles multi-line block removal ===");
{
  const files = [
    {
      path: "server/src/types/index.ts",
      content: `export interface CreateEventInput {
  name: string;
  date: string;
}
export type EventResponse = { id: string };
export interface CreateEventInput {
  title: string;
  startDate: string;
  endDate: string;
}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const idx = result.files.find(f => f.path === "server/src/types/index.ts")!;
  const ifaceMatches = idx.content.match(/export interface CreateEventInput/g);
  assert(ifaceMatches!.length === 1, "should keep only first interface");
  assert(idx.content.includes("name: string"), "should keep first interface body");
  assert(idx.content.includes("EventResponse"), "should preserve other types");
}

console.log("\n=== Pass 33d: fixDuplicateIdentifiers - no false positives ===");
{
  const files = [
    {
      path: "server/src/routes/users.ts",
      content: `import { eq } from 'drizzle-orm';
import { users } from '../schema';
const getUser = async (id: string) => { return db.select().from(users).where(eq(users.id, id)); };
const updateUser = async (id: string) => { return db.update(users).set({}).where(eq(users.id, id)); };`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/users.ts")!;
  assert(!result.fixes.some(f => f.includes("duplicate") || f.includes("Duplicate")),
    "should not flag non-duplicates");
}

console.log("\n=== Pass 34a: fixDrizzleZodBooleanRefinements - converts true to callbacks ===");
{
  const files = [
    {
      path: "server/src/schema/recipes.ts",
      content: `import { pgTable, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
export const recipes = pgTable("recipes", {
  id: integer("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  prepTime: integer("prep_time"),
});`,
    },
    {
      path: "server/src/routes/recipes.ts",
      content: `import { createInsertSchema } from "drizzle-zod";
import { recipes } from "../schema/recipes";
const insertRecipeSchema = createInsertSchema(recipes, {
  title: true,
  description: true,
  prepTime: true,
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/recipes.ts")!;
  assert(!route.content.includes("title: true"), "should replace title: true");
  assert(route.content.includes("title: (s: any) => s"), "should have callback for title");
  assert(route.content.includes("prepTime: (s: any) => s"), "should have callback for prepTime");
}

console.log("\n=== Pass 34a2: fixDrizzleZodBooleanRefinements - handles types/index.ts path ===");
{
  const files = [
    {
      path: "server/src/types/index.ts",
      content: `import { createInsertSchema } from "drizzle-zod";
import { recipes } from "../schema/recipes";
export const insertRecipeSchema = createInsertSchema(recipes, { title: true, description: true, prepTime: true });`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const types = result.files.find(f => f.path === "server/src/types/index.ts")!;
  assert(!types.content.includes(": true"), "should replace all true values in types/index.ts");
  assert(types.content.includes("(s: any) => s"), "should have callbacks in types/index.ts");
}

console.log("\n=== Pass 34b: fixDrizzleZodBooleanRefinements - keeps non-boolean refinements ===");
{
  const files = [
    {
      path: "server/src/routes/recipes.ts",
      content: `import { createInsertSchema } from "drizzle-zod";
import { recipes } from "../schema/recipes";
const insertRecipeSchema = createInsertSchema(recipes, {
  title: (s) => s.min(1).max(255),
  description: (s) => s.optional(),
});`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const route = result.files.find(f => f.path === "server/src/routes/recipes.ts")!;
  assert(route.content.includes("=> s.min(1).max(255)"), "should preserve callback refinements");
  assert(!result.fixes.some(f => f.includes("boolean")), "should not flag non-boolean refinements");
}

console.log("\n=== Pass 34c: fixTypeOnlyNamespaceImports - converts type-only namespace to value ===");
{
  const files = [
    {
      path: "server/src/db/index.ts",
      content: `import type * as schema from "../schema";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const dbFile = result.files.find(f => f.path === "server/src/db/index.ts")!;
  assert(dbFile.content.includes('import * as schema from "../schema"'), "should convert to value import");
  assert(!dbFile.content.includes('import type * as schema'), "should remove type keyword");
}

console.log("\n=== Pass 34b: fixTypeOnlyNamespaceImports - no false positive on regular imports ===");
{
  const files = [
    {
      path: "server/src/db/index.ts",
      content: `import * as schema from "../schema";
import { Pool } from "pg";
export const db = drizzle(pool, { schema });`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("type-only") || f.includes("namespace")),
    "should not touch regular namespace imports");
}

console.log("\n=== Pass 35: fixUninitializedUseRefs - fixes useRef<THREE.Mesh>() ===");
{
  const files = [
    {
      path: "client/src/components/Scene.tsx",
      content: `import { useRef } from "react";
import * as THREE from "three";
const meshRef = useRef<THREE.Mesh>();
const groupRef = useRef<THREE.Group>();`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const fixed = result.files.find(f => f.path.includes("Scene.tsx"))!;
  assert(fixed.content.includes("useRef<THREE.Mesh>(null!)"), "should add null! to THREE.Mesh ref");
  assert(fixed.content.includes("useRef<THREE.Group>(null!)"), "should add null! to THREE.Group ref");
  assert(result.fixes.some(f => f.includes("useRef")), "should report useRef fix");
  passed++;
}

console.log("\n=== Pass 35b: fixUninitializedUseRefs - fixes generic useRef<HTMLDivElement>() ===");
{
  const files = [
    {
      path: "client/src/components/Panel.tsx",
      content: `import { useRef } from "react";
const divRef = useRef<HTMLDivElement>();
const inputRef = useRef<HTMLInputElement>();`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const fixed = result.files.find(f => f.path.includes("Panel.tsx"))!;
  assert(fixed.content.includes("useRef<HTMLDivElement>(null!)"), "should add null! to HTMLDivElement ref");
  assert(fixed.content.includes("useRef<HTMLInputElement>(null!)"), "should add null! to HTMLInputElement ref");
  passed++;
}

console.log("\n=== Pass 35c: fixUninitializedUseRefs - skips refs already initialized ===");
{
  const files = [
    {
      path: "client/src/components/Timer.tsx",
      content: `import { useRef } from "react";
const intervalRef = useRef<number | null>(null);
const meshRef = useRef<THREE.Mesh>(null!);
const countRef = useRef<number>(0);`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const fixed = result.files.find(f => f.path.includes("Timer.tsx"))!;
  assert(fixed.content.includes("useRef<number | null>(null)"), "should not modify ref with null init");
  assert(fixed.content.includes("useRef<THREE.Mesh>(null!)"), "should not modify ref with null! init");
  assert(fixed.content.includes("useRef<number>(0)"), "should not modify ref with value init");
  assert(!result.fixes.some(f => f.includes("Timer.tsx")), "should not report fixes for already-initialized refs");
  passed++;
}

console.log("\n=== Pass 35d: fixUninitializedUseRefs - handles ReturnType<typeof setInterval> ===");
{
  const files = [
    {
      path: "client/src/components/Ticker.tsx",
      content: `const timerRef = useRef<ReturnType<typeof setInterval>>();`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const fixed = result.files.find(f => f.path.includes("Ticker.tsx"))!;
  assert(fixed.content.includes("useRef<ReturnType<typeof setInterval>>(null!)"),
    "should add null! to ReturnType ref");
  passed++;
}

console.log("\n=== Stub collision: skips stub when symbol already imported ===");
{
  const files = [
    {
      path: "server/src/schema/index.ts",
      content: `import { pgTable, varchar, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const datasets = pgTable("datasets", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
});

export const insertDatasetSchema = createInsertSchema(datasets);`,
    },
    {
      path: "server/src/routes/datasets.ts",
      content: `import { insertDatasetSchema } from "../schema/index.js";
import { SomeUnknownType } from "../schema/index.js";

export function registerRoutes(app: any) {
  app.post("/api/datasets", (req: any, res: any) => {
    const parsed = insertDatasetSchema.parse(req.body);
    res.json(parsed);
  });
}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const schemaFile = result.files.find(f => f.path === "server/src/schema/index.ts")!;
  const hasDoubleInsert = (schemaFile.content.match(/insertDatasetSchema/g) || []).length;
  assert(hasDoubleInsert <= 3, "should not inject duplicate insertDatasetSchema stub (found " + hasDoubleInsert + " occurrences)");
  assert(!schemaFile.content.includes("export const insertDatasetSchema = {} as any"), "should not inject stub for already-declared symbol");
  passed++;
}

console.log("\n=== Pass 36: fixViteEnvTypes - injects vite/client into tsconfig when import.meta.env is used ===");
{
  const files = [
    {
      path: "client/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          noEmit: true,
        },
        include: ["src/**/*"],
      }, null, 2),
    },
    {
      path: "client/src/lib/api.ts",
      content: `const API_URL = import.meta.env.VITE_API_URL || "/api";
export function getApiUrl() { return API_URL; }`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const tsconfig = result.files.find(f => f.path === "client/tsconfig.json")!;
  const parsed = JSON.parse(tsconfig.content);
  assert(Array.isArray(parsed.compilerOptions.types), "should have types array");
  assert(parsed.compilerOptions.types.includes("vite/client"), "should include vite/client");
  assert(result.fixes.some(f => f.includes("vite/client")), "should report vite/client fix");
  passed++;
}

console.log("\n=== Pass 36b: fixViteEnvTypes - creates vite-env.d.ts when no tsconfig exists ===");
{
  const files = [
    {
      path: "client/src/lib/api.ts",
      content: `const url = import.meta.env.VITE_API_URL;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const envDts = result.files.find(f => f.path === "client/src/vite-env.d.ts");
  assert(envDts !== undefined, "should create vite-env.d.ts");
  assert(envDts!.content.includes('/// <reference types="vite/client" />'), "should have reference directive");
  passed++;
}

console.log("\n=== Pass 36c: fixViteEnvTypes - skips when vite-env.d.ts already exists ===");
{
  const files = [
    {
      path: "client/src/vite-env.d.ts",
      content: '/// <reference types="vite/client" />\n',
    },
    {
      path: "client/src/lib/api.ts",
      content: `const url = import.meta.env.VITE_API_URL;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("vite/client")), "should not fix when vite-env.d.ts exists");
  passed++;
}

console.log("\n=== Pass 36d: fixViteEnvTypes - skips when tsconfig already has vite/client ===");
{
  const files = [
    {
      path: "client/tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          types: ["vite/client"],
          jsx: "react-jsx",
        },
      }, null, 2),
    },
    {
      path: "client/src/lib/api.ts",
      content: `const url = import.meta.env.VITE_API_URL;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("vite/client")), "should not fix when tsconfig already has vite/client");
  passed++;
}

console.log("\n=== Pass 36e: fixViteEnvTypes - skips when no import.meta.env usage ===");
{
  const files = [
    {
      path: "client/tsconfig.json",
      content: JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }, null, 2),
    },
    {
      path: "client/src/App.tsx",
      content: `export function App() { return <div>Hello</div>; }`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("vite/client")), "should not fix when no import.meta.env");
  passed++;
}

console.log("\n=== Pass 37: fixSchemaValueImport - converts type-only schema import to value import ===");
{
  const files = [
    {
      path: "server/src/db/index.ts",
      content: `import type * as schema from "../schema";\nimport { Pool } from "pg";\nimport { drizzle } from "drizzle-orm/node-postgres";\nconst pool = new Pool({ connectionString: process.env.DATABASE_URL });\nexport const db = drizzle(pool, { schema });`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const dbFile = result.files.find(f => f.path === "server/src/db/index.ts")!;
  assert(dbFile.content.includes("import * as schema from"), "should convert to value import");
  assert(!dbFile.content.includes("import type * as schema"), "should not have type-only import");
  passed++;
}

console.log("\n=== Pass 37b: fixSchemaValueImport - removes type-only schema stub from barrel ===");
{
  const files = [
    {
      path: "server/src/schema/index.ts",
      content: `export * from './users';\nexport * from './sessions';\n\nexport interface schema { [key: string]: unknown; }\n`,
    },
    {
      path: "server/src/db/index.ts",
      content: `import * as schema from "../schema";\nimport { drizzle } from "drizzle-orm/node-postgres";\nexport const db = drizzle(pool, { schema });`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const barrel = result.files.find(f => f.path === "server/src/schema/index.ts")!;
  assert(!barrel.content.includes("export interface schema"), "should remove schema interface stub");
  assert(barrel.content.includes("export * from './users'"), "should preserve re-exports");
  passed++;
}

console.log("\n=== Pass 37c: fixSchemaValueImport - does not report fix when no drizzle() call ===");
{
  const files = [
    {
      path: "server/src/routes/users.ts",
      content: `import * as schema from "../schema";\nconst x = schema.users;`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.fixes.some(f => f.includes("value import for drizzle()")), "should not report schema value fix when no drizzle()");
  passed++;
}

console.log("\n=== Pass 37d: fixSchemaValueImport - removes type alias stub from barrel ===");
{
  const files = [
    {
      path: "server/src/schema/index.ts",
      content: `export * from './users';\n\nexport type schema = any;\n`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const barrel = result.files.find(f => f.path === "server/src/schema/index.ts")!;
  assert(!barrel.content.includes("export type schema"), "should remove type alias stub");
  passed++;
}

console.log("\n=== Pass 38: fixR3FTupleCasts - casts position/rotation/scale arrays ===");
{
  const files = [
    {
      path: "client/src/components/Scene.tsx",
      content: `<mesh position={[0, 1, 2]} rotation={[0, Math.PI, 0]} scale={[1, 1, 1]}>\n  <boxGeometry />\n</mesh>`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const scene = result.files.find(f => f.path === "client/src/components/Scene.tsx")!;
  assert(scene.content.includes("position={[0, 1, 2] as [number, number, number]}"), "should cast position");
  assert(scene.content.includes("rotation={[0, Math.PI, 0] as [number, number, number]}"), "should cast rotation");
  assert(scene.content.includes("scale={[1, 1, 1] as [number, number, number]}"), "should cast scale");
  passed++;
}

console.log("\n=== Pass 38b: fixR3FTupleCasts - skips already-cast arrays ===");
{
  const files = [
    {
      path: "client/src/components/Scene.tsx",
      content: `<mesh position={[0, 1, 2] as [number, number, number]}>\n  <boxGeometry />\n</mesh>`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const scene = result.files.find(f => f.path === "client/src/components/Scene.tsx")!;
  const castCount = (scene.content.match(/as \[number, number, number\]/g) || []).length;
  assert(castCount === 1, "should not double-cast");
  passed++;
}

console.log("\n=== Pass 38c: fixR3FTupleCasts - skips non-client files ===");
{
  const files = [
    {
      path: "server/src/utils/math.tsx",
      content: `const pos = position={[0, 1, 2]};`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const serverFile = result.files.find(f => f.path === "server/src/utils/math.tsx")!;
  assert(!serverFile.content.includes("as [number, number, number]"), "should not touch server files");
  passed++;
}

console.log("\n=== Pass 38d: fixR3FTupleCasts - handles expressions in arrays ===");
{
  const files = [
    {
      path: "client/src/components/Avatar.tsx",
      content: `<group position={[userData.x, userData.y, userData.z]}>\n  <sphere />\n</group>`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const avatar = result.files.find(f => f.path === "client/src/components/Avatar.tsx")!;
  assert(avatar.content.includes("as [number, number, number]"), "should cast expression arrays");
  passed++;
}

console.log("\n=== Pass 40a: fixVisualSanityGuard - injects visual-sanity.ts when PivotControls detected ===");
{
  const files = [
    {
      path: "client/src/components/Editor/SovereignGizmo.tsx",
      content: `import { PivotControls } from "@react-three/drei";\nexport function SovereignGizmo({ id, children }) {\n  return (\n    <PivotControls visible={true} onDragEnd={(m) => {\n      const pos = [m.elements[12], m.elements[13], m.elements[14]];\n      socket.emit("NODE_UPDATE", { id, position: pos });\n    }}>\n      <group>{children}</group>\n    </PivotControls>\n  );\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const sanityFile = result.files.find(f => f.path === "client/src/lib/visual-sanity.ts");
  assert(sanityFile, "should create visual-sanity.ts");
  assert(sanityFile!.content.includes("visualSanity"), "should contain visualSanity function");
  assert(sanityFile!.content.includes("y < 0"), "should include floor constraint");
  assert(sanityFile!.content.includes("dist > 100"), "should include radial boundary");
  assert(result.fixes.some(f => f.includes("visual sanity bounds guard")), "should report injection fix");
  passed++;
}

console.log("\n=== Pass 40b: fixVisualSanityGuard - injects guard call after matrix extraction ===");
{
  const files = [
    {
      path: "client/src/components/Editor/SovereignGizmo.tsx",
      content: `import { PivotControls } from "@react-three/drei";\nexport function SovereignGizmo({ id, children }) {\n  return (\n    <PivotControls onDragEnd={(m) => {\n      const pos = [m.elements[12], m.elements[13], m.elements[14]];\n      socket.emit("NODE_UPDATE", { id, position: pos });\n    }}>\n      <group>{children}</group>\n    </PivotControls>\n  );\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const gizmo = result.files.find(f => f.path.includes("SovereignGizmo"))!;
  assert(gizmo.content.includes('import { visualSanity }'), "should add visualSanity import");
  assert(gizmo.content.includes("if (!visualSanity(pos)) return;"), "should inject guard after pos extraction");
  passed++;
}

console.log("\n=== Pass 40c: fixVisualSanityGuard - skips when no PivotControls ===");
{
  const files = [
    {
      path: "client/src/components/Scene.tsx",
      content: `import { Canvas } from "@react-three/fiber";\nexport function Scene() { return <Canvas><mesh /></Canvas>; }`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.files.some(f => f.path === "client/src/lib/visual-sanity.ts"), "should not create visual-sanity.ts without PivotControls");
  assert(!result.fixes.some(f => f.includes("visual sanity")), "should not report visual sanity fix");
  passed++;
}

console.log("\n=== Pass 40d: fixVisualSanityGuard - does not double-inject when file already exists ===");
{
  const files = [
    {
      path: "client/src/lib/visual-sanity.ts",
      content: `export function visualSanity(pos: [number, number, number]): boolean {\n  return pos[1] >= 0;\n}`,
    },
    {
      path: "client/src/components/Editor/SovereignGizmo.tsx",
      content: `import { PivotControls } from "@react-three/drei";\nimport { visualSanity } from "../../lib/visual-sanity";\nexport function SovereignGizmo({ id, children }) {\n  return (\n    <PivotControls onDragEnd={(m) => {\n      const pos = [m.elements[12], m.elements[13], m.elements[14]];\n      if (!visualSanity(pos)) return;\n      socket.emit("NODE_UPDATE", { id, position: pos });\n    }}>\n      <group>{children}</group>\n    </PivotControls>\n  );\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const sanityFiles = result.files.filter(f => f.path === "client/src/lib/visual-sanity.ts");
  assert(sanityFiles.length === 1, "should not duplicate visual-sanity.ts");
  assert(sanityFiles[0].content.includes("pos[1] >= 0"), "should preserve original implementation");
  passed++;
}

console.log("\n=== Pass 40e: fixVisualSanityGuard - computes correct relative import path ===");
{
  const files = [
    {
      path: "client/src/components/deep/nested/Gizmo.tsx",
      content: `import { PivotControls } from "@react-three/drei";\nexport function Gizmo() {\n  return (\n    <PivotControls onDragEnd={(m) => {\n      const pos = [m.elements[12], m.elements[13], m.elements[14]];\n      console.log(pos);\n    }}>\n      <mesh />\n    </PivotControls>\n  );\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const gizmo = result.files.find(f => f.path.includes("Gizmo.tsx"))!;
  assert(gizmo.content.includes('../../../lib/visual-sanity'), "should compute correct relative path for deep nesting");
  passed++;
}

console.log("\n=== Pass 41a: fixAssetConduit - injects asset-conduit.ts when useGLTF detected ===");
{
  const files = [
    {
      path: "client/src/components/Models/Chair.tsx",
      content: `import { useGLTF } from "@react-three/drei";\nexport function Chair() {\n  const { scene, nodes, materials } = useGLTF("/models/chair.glb");\n  return <primitive object={scene} />;\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const conduit = result.files.find(f => f.path === "client/src/lib/asset-conduit.ts");
  assert(conduit, "should create asset-conduit.ts");
  assert(conduit!.content.includes("ASSET_LIMITS"), "should contain ASSET_LIMITS");
  assert(conduit!.content.includes("MAX_VERTICES: 50_000"), "should enforce 50k vertex limit");
  assert(conduit!.content.includes("MAX_TEXTURE_RES: 1024"), "should enforce 1024 texture limit");
  assert(conduit!.content.includes("validateAssetUrl"), "should include validation function");
  assert(result.fixes.some(f => f.includes("asset conduit")), "should report conduit injection");
  passed++;
}

console.log("\n=== Pass 41b: fixAssetConduit - injects disposal cleanup for useGLTF ===");
{
  const files = [
    {
      path: "client/src/components/Models/Table.tsx",
      content: `import { useGLTF } from "@react-three/drei";\nexport function Table() {\n  const { scene, nodes, materials } = useGLTF("/models/table.glb");\n  return <primitive object={scene} />;\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const table = result.files.find(f => f.path.includes("Table.tsx"))!;
  assert(table.content.includes("geometry?.dispose"), "should inject geometry disposal");
  assert(table.content.includes(".dispose()"), "should inject material disposal");
  assert(table.content.includes("useEffect"), "should use useEffect for cleanup");
  assert(result.fixes.some(f => f.includes("GPU disposal cleanup")), "should report disposal fix");
  passed++;
}

console.log("\n=== Pass 41c: fixAssetConduit - replaces meshBasicMaterial in lit scenes ===");
{
  const files = [
    {
      path: "client/src/components/Scene.tsx",
      content: `import { Canvas } from "@react-three/fiber";\nimport { useTexture } from "@react-three/drei";\nexport function Scene() {\n  return (\n    <Canvas>\n      <ambientLight />\n      <mesh>\n        <boxGeometry />\n        <meshBasicMaterial color="red" />\n      </mesh>\n    </Canvas>\n  );\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const scene = result.files.find(f => f.path.includes("Scene.tsx"))!;
  assert(!scene.content.includes("meshBasicMaterial"), "should remove meshBasicMaterial");
  assert(scene.content.includes("meshStandardMaterial"), "should replace with meshStandardMaterial");
  assert(result.fixes.some(f => f.includes("meshStandardMaterial")), "should report material replacement");
  passed++;
}

console.log("\n=== Pass 41d: fixAssetConduit - skips when no asset hooks detected ===");
{
  const files = [
    {
      path: "client/src/components/App.tsx",
      content: `import { useState } from "react";\nexport function App() {\n  return <div>Hello</div>;\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  assert(!result.files.some(f => f.path === "client/src/lib/asset-conduit.ts"), "should not create asset-conduit.ts without asset hooks");
  assert(!result.fixes.some(f => f.includes("asset conduit")), "should not report conduit fix");
  passed++;
}

console.log("\n=== Pass 41e: fixAssetConduit - does not double-inject disposal ===");
{
  const files = [
    {
      path: "client/src/components/Models/Lamp.tsx",
      content: `import { useGLTF } from "@react-three/drei";\nimport { useEffect } from "react";\nexport function Lamp() {\n  const { scene, nodes, materials } = useGLTF("/models/lamp.glb");\n  useEffect(() => {\n    return () => {\n      Object.values(nodes).forEach((n) => { if ("geometry" in n) (n as any).geometry?.dispose(); });\n      Object.values(materials).forEach((m) => (m as any).dispose());\n    };\n  }, [nodes, materials]);\n  return <primitive object={scene} />;\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const lamp = result.files.find(f => f.path.includes("Lamp.tsx"))!;
  const disposeCount = (lamp.content.match(/geometry\?\.dispose/g) || []).length;
  assert(disposeCount === 1, "should not duplicate disposal cleanup (found " + disposeCount + ")");
  passed++;
}

console.log("\n=== Pass 41f: fixAssetConduit - does not replace meshBasicMaterial without lights ===");
{
  const files = [
    {
      path: "client/src/components/Flat.tsx",
      content: `import { useTexture } from "@react-three/drei";\nexport function Flat() {\n  return (\n    <mesh>\n      <planeGeometry />\n      <meshBasicMaterial color="blue" />\n    </mesh>\n  );\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const flat = result.files.find(f => f.path.includes("Flat.tsx"))!;
  assert(flat.content.includes("meshBasicMaterial"), "should preserve meshBasicMaterial in unlit scene");
  passed++;
}

console.log("\n=== Pass 41g: fixAssetConduit - does not duplicate asset-conduit.ts ===");
{
  const files = [
    {
      path: "client/src/lib/asset-conduit.ts",
      content: `export const ASSET_LIMITS = { MAX_VERTICES: 50_000 } as const;`,
    },
    {
      path: "client/src/components/Models/Car.tsx",
      content: `import { useGLTF } from "@react-three/drei";\nexport function Car() {\n  const { scene } = useGLTF("/car.glb");\n  return <primitive object={scene} />;\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const conduitFiles = result.files.filter(f => f.path === "client/src/lib/asset-conduit.ts");
  assert(conduitFiles.length === 1, "should not duplicate asset-conduit.ts");
  assert(conduitFiles[0].content.includes("MAX_VERTICES: 50_000"), "should preserve original");
  passed++;
}

console.log("\n=== Pass 41h: fixAssetConduit - adds useEffect import when missing ===");
{
  const files = [
    {
      path: "client/src/components/Models/Desk.tsx",
      content: `import { useGLTF } from "@react-three/drei";\nexport function Desk() {\n  const { scene, nodes, materials } = useGLTF("/models/desk.glb");\n  return <primitive object={scene} />;\n}`,
    },
  ];

  const result = hardenGeneratedTypes(files);
  const desk = result.files.find(f => f.path.includes("Desk.tsx"))!;
  assert(desk.content.includes("useEffect"), "should have useEffect in file");
  assert(desk.content.includes('from "react"') || desk.content.includes("from 'react'"), "should import from react");
  passed++;
}

console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
