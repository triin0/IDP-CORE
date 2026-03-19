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
  assert(pkg.devDependencies["@types/jsonwebtoken"] === "^9.0.0",
    `@types/jsonwebtoken injected with pinned version`);
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

console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
