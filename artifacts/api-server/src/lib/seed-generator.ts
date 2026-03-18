import { callWithRetry } from "./ai-retry";

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  fkTable: string | null;
  fkColumn: string | null;
  unique: boolean;
  defaultValue: string | null;
}

interface SchemaTable {
  name: string;
  columns: ColumnDef[];
  rawColumns: string[];
}

interface SeedRecord {
  [key: string]: string | number | boolean | null;
}

interface SeedData {
  tableName: string;
  columns: string[];
  rows: SeedRecord[];
}

const FK_PATTERNS = [
  /REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/i,
  /FK\s+(\w+)\.(\w+)/i,
  /FK\s+(\w+)/i,
  /REFERENCES\s+(\w+)/i,
];

function parseColumnDef(raw: string): ColumnDef {
  const parts = raw.trim().split(/\s+/);
  const name = parts[0] || "unknown";
  const rest = parts.slice(1).join(" ").toUpperCase();
  const restOriginal = parts.slice(1).join(" ");

  let type = parts[1]?.toUpperCase() || "TEXT";
  if (type === "PK" || type === "PRIMARY") type = "INTEGER";

  const nullable = !rest.includes("NOT NULL") && !rest.includes("PK") && !rest.includes("PRIMARY KEY");
  const primaryKey = rest.includes("PK") || rest.includes("PRIMARY KEY") || rest.includes("PRIMARY");
  const unique = rest.includes("UNIQUE");

  let fkTable: string | null = null;
  let fkColumn: string | null = null;

  for (const pattern of FK_PATTERNS) {
    const match = restOriginal.match(pattern);
    if (match) {
      fkTable = match[1] || null;
      fkColumn = match[2] || "id";
      break;
    }
  }

  if (!fkTable && name.endsWith("_id") && !primaryKey) {
    const inferredTable = name.slice(0, -3) + "s";
    fkTable = inferredTable;
    fkColumn = "id";
  }

  let defaultValue: string | null = null;
  const defaultMatch = rest.match(/DEFAULT\s+(\S+)/);
  if (defaultMatch) {
    defaultValue = defaultMatch[1] || null;
  }

  return { name, type, nullable, primaryKey, unique, fkTable, fkColumn, defaultValue };
}

function parseSpecTables(
  specTables: Array<{ name: string; columns: string[] }>,
): SchemaTable[] {
  return specTables.map((t) => ({
    name: t.name,
    rawColumns: t.columns,
    columns: t.columns.map(parseColumnDef),
  }));
}

function topologicalSort(tables: SchemaTable[]): SchemaTable[] {
  const tableNames = new Set(tables.map((t) => t.name));
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const t of tables) {
    graph.set(t.name, new Set());
    inDegree.set(t.name, 0);
  }

  for (const t of tables) {
    for (const col of t.columns) {
      if (col.fkTable && tableNames.has(col.fkTable) && col.fkTable !== t.name) {
        const deps = graph.get(col.fkTable)!;
        if (!deps.has(t.name)) {
          deps.add(t.name);
          inDegree.set(t.name, (inDegree.get(t.name) || 0) + 1);
        }
      }
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const dependent of graph.get(current) || []) {
      const newDegree = (inDegree.get(dependent) || 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) queue.push(dependent);
    }
  }

  if (sorted.length < tables.length) {
    const cycleTrapped = tables
      .filter((t) => !sorted.includes(t.name))
      .map((t) => t.name);
    throw new Error(
      `Circular dependency detected in database schema. ` +
      `Seed data cannot be topologically sorted. ` +
      `Tables trapped in cycle: ${cycleTrapped.join(", ")}`,
    );
  }

  const tableMap = new Map(tables.map((t) => [t.name, t]));
  return sorted.map((name) => tableMap.get(name)!);
}

function formatSchemaForPrompt(tables: SchemaTable[]): string {
  return tables
    .map((t) => {
      const colDefs = t.columns
        .map((c) => {
          const parts = [`  ${c.name}: ${c.type}`];
          if (c.primaryKey) parts.push("PRIMARY KEY");
          if (!c.nullable && !c.primaryKey) parts.push("NOT NULL");
          if (c.unique) parts.push("UNIQUE");
          if (c.fkTable) parts.push(`FK → ${c.fkTable}.${c.fkColumn || "id"}`);
          if (c.defaultValue) parts.push(`DEFAULT ${c.defaultValue}`);
          return parts.join(" ");
        })
        .join("\n");
      return `TABLE ${t.name} {\n${colDefs}\n}`;
    })
    .join("\n\n");
}

export async function generateSeedData(
  specTables: Array<{ name: string; columns: string[] }>,
  appOverview: string,
  rowsPerTable: number = 5,
  projectId?: string,
): Promise<SeedData[]> {
  if (!specTables || specTables.length === 0) {
    throw new Error("No database tables found in this project");
  }

  const parsed = parseSpecTables(specTables);
  const sorted = topologicalSort(parsed);
  const schemaBlock = formatSchemaForPrompt(sorted);

  const deterministicSeed = projectId
    ? `\n\n### DETERMINISTIC SEED\nProject fingerprint: ${projectId}\nUse this fingerprint to anchor your data generation. The same fingerprint must always produce the exact same output values.`
    : "";

  const fkInstructions = sorted
    .flatMap((t) =>
      t.columns
        .filter((c) => c.fkTable)
        .map((c) => `- ${t.name}.${c.name} must reference an existing ${c.fkTable}.${c.fkColumn || "id"} value`),
    )
    .join("\n");

  const prompt = `You are a deterministic seed data generator for a web application.

### APPLICATION CONTEXT
${appOverview}

### FULL DATABASE SCHEMA (in dependency order — parent tables first)
${schemaBlock}

### FOREIGN KEY CONSTRAINTS
${fkInstructions || "No foreign key constraints detected."}

### INSTRUCTIONS
Generate exactly ${rowsPerTable} seed data rows for EACH table, in the EXACT order listed above.

Rules:
1. Respect column types exactly (INTEGER → numbers, TEXT → strings, BOOLEAN → true/false, TIMESTAMP → ISO 8601 dates, UUID → valid UUIDs)
2. Primary key "id" columns: use sequential integers starting from 1 unless the type is UUID
3. Foreign key columns MUST reference IDs that exist in the parent table's generated rows
4. Data must be realistic, domain-appropriate, and diverse — not "Test 1", "Test 2"
5. Nullable columns: set ~20% of values to null for realism
6. Email columns: use realistic emails like "sarah.chen@example.com"
7. Timestamp columns: use dates within the last 90 days
8. Output tables in the EXACT order listed in the schema above${deterministicSeed}

### OUTPUT FORMAT
Return a JSON object with a "tables" array. Each entry has:
- "tableName": string (exact table name from schema)
- "columns": string[] (column names only)
- "rows": array of objects mapping column name → value

Only output the JSON object. No markdown, no explanation.`;

  const content = await callWithRetry(
    {
      model: "gemini-2.5-pro",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.0,
    },
    "seed-data-generation",
  );

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI returned no valid JSON for seed data");
  }

  const raw = JSON.parse(jsonMatch[0]) as { tables: SeedData[] };
  if (!raw.tables || !Array.isArray(raw.tables)) {
    throw new Error("AI returned invalid seed data format");
  }

  const tableNameSet = new Set(sorted.map((t) => t.name));
  const validTables = raw.tables.filter((t) => tableNameSet.has(t.tableName));

  const sortOrder = sorted.map((t) => t.name);
  validTables.sort(
    (a, b) => sortOrder.indexOf(a.tableName) - sortOrder.indexOf(b.tableName),
  );

  return validTables;
}

export function seedDataToSQL(seedData: SeedData[]): string {
  const lines: string[] = [
    "-- Auto-generated seed data (topologically ordered)",
    "-- Tables are inserted in dependency order to satisfy FK constraints",
  ];

  for (const table of seedData) {
    lines.push(`\n-- Seed data for ${table.tableName}`);
    for (const row of table.rows) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null) return "NULL";
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      lines.push(
        `INSERT INTO ${table.tableName} (${cols.join(", ")}) VALUES (${vals.join(", ")});`,
      );
    }
  }

  return lines.join("\n");
}

export function seedDataToTypeScript(seedData: SeedData[]): string {
  const lines: string[] = ["// Auto-generated seed data"];

  for (const table of seedData) {
    const varName = table.tableName.replace(/[^a-zA-Z0-9]/g, "_");
    lines.push(
      `\nexport const ${varName}Seeds = ${JSON.stringify(table.rows, null, 2)};`,
    );
  }

  return lines.join("\n");
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function singularize(str: string): string {
  if (str.endsWith("ies")) return str.slice(0, -3) + "y";
  if (str.endsWith("ses") || str.endsWith("xes") || str.endsWith("zes"))
    return str.slice(0, -2);
  if (str.endsWith("s") && !str.endsWith("ss")) return str.slice(0, -1);
  return str;
}

export function generateClientSeedFile(seedData: SeedData[]): string {
  const lines: string[] = [
    "// ============================================================",
    "// AUTO-GENERATED SEED DATA — Magic Seed Engine",
    "// This file provides realistic mock data for the Sandpack preview.",
    "// To clear: use the 'Wipe Seed Data' action in the workspace.",
    "// ============================================================",
    "",
  ];

  for (const table of seedData) {
    const typeName = toPascalCase(singularize(table.tableName));
    const varName = `mock${toPascalCase(table.tableName)}`;

    if (table.rows.length > 0) {
      const firstRow = table.rows[0];
      const typeFields = Object.entries(firstRow)
        .map(([key, val]) => {
          let tsType: string;
          if (val === null) tsType = "string | null";
          else if (typeof val === "number") tsType = "number";
          else if (typeof val === "boolean") tsType = "boolean";
          else tsType = "string";
          return `  ${key}: ${tsType};`;
        })
        .join("\n");

      lines.push(`export interface ${typeName} {`);
      lines.push(typeFields);
      lines.push("}");
      lines.push("");
    }

    lines.push(
      `export const ${varName}: ${typeName}[] = ${JSON.stringify(table.rows, null, 2)};`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

export function generateServerSeedFile(
  seedData: SeedData[],
  _specTables: Array<{ name: string; columns: string[] }>,
): string {
  const seedSqlLines: string[] = [];
  for (const table of seedData) {
    for (const row of table.rows) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null) return "NULL";
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        return "'" + String(v).replace(/'/g, "''") + "'";
      });
      seedSqlLines.push(
        "INSERT INTO " + table.tableName + " (" + cols.join(", ") + ") VALUES (" + vals.join(", ") + ");",
      );
    }
    seedSqlLines.push("");
  }

  const wipeSqlLines = seedData
    .map((t) => "TRUNCATE TABLE " + t.tableName + " CASCADE;")
    .reverse();

  const firstTable = seedData[0]?.tableName || "users";

  const lines: string[] = [];
  lines.push("// ============================================================");
  lines.push("// AUTO-GENERATED SEED SCRIPT — Magic Seed Engine");
  lines.push("// Populates the database with realistic mock data on first boot.");
  lines.push("// Tables are inserted in topological (FK-safe) order.");
  lines.push("// To clear: use the 'Wipe Seed Data' action in the workspace.");
  lines.push("// ============================================================");
  lines.push("");
  lines.push('import { Pool } from "pg";');
  lines.push("");
  lines.push("const SEED_SQL = `");
  lines.push(seedSqlLines.join("\n"));
  lines.push("`;");
  lines.push("");
  lines.push("const WIPE_SQL = `");
  lines.push(wipeSqlLines.join("\n"));
  lines.push("`;");
  lines.push("");
  lines.push("export async function runSeed(): Promise<void> {");
  lines.push("  const pool = new Pool({ connectionString: process.env.DATABASE_URL });");
  lines.push("  try {");
  lines.push('    const check = await pool.query(');
  lines.push('      "SELECT COUNT(*) as count FROM ' + firstTable + '"');
  lines.push("    );");
  lines.push("    if (parseInt(check.rows[0].count, 10) > 0) {");
  lines.push('      console.log("[seed] Database already has data, skipping seed.");');
  lines.push("      return;");
  lines.push("    }");
  lines.push("    await pool.query(SEED_SQL);");
  lines.push('    console.log("[seed] Database seeded successfully.");');
  lines.push("  } catch (err) {");
  lines.push('    console.error("[seed] Seed failed:", err);');
  lines.push("  } finally {");
  lines.push("    await pool.end();");
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push("export async function wipeSeed(): Promise<void> {");
  lines.push("  const pool = new Pool({ connectionString: process.env.DATABASE_URL });");
  lines.push("  try {");
  lines.push("    await pool.query(WIPE_SQL);");
  lines.push('    console.log("[seed] Database wiped successfully.");');
  lines.push("  } catch (err) {");
  lines.push('    console.error("[seed] Wipe failed:", err);');
  lines.push("  } finally {");
  lines.push("    await pool.end();");
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push("runSeed();");

  return lines.join("\n");
}

export function generateEmptyClientSeedFile(seedData: SeedData[]): string {
  const lines: string[] = [
    "// ============================================================",
    "// SEED DATA CLEARED — Magic Seed Engine",
    "// All mock data has been wiped. Arrays are empty.",
    "// Re-generate via the Seeds tab in the workspace.",
    "// ============================================================",
    "",
  ];

  for (const table of seedData) {
    const typeName = toPascalCase(singularize(table.tableName));
    const varName = `mock${toPascalCase(table.tableName)}`;

    if (table.rows.length > 0) {
      const firstRow = table.rows[0];
      const typeFields = Object.entries(firstRow)
        .map(([key, val]) => {
          let tsType: string;
          if (val === null) tsType = "string | null";
          else if (typeof val === "number") tsType = "number";
          else if (typeof val === "boolean") tsType = "boolean";
          else tsType = "string";
          return `  ${key}: ${tsType};`;
        })
        .join("\n");

      lines.push(`export interface ${typeName} {`);
      lines.push(typeFields);
      lines.push("}");
      lines.push("");
    }

    lines.push(`export const ${varName}: ${typeName}[] = [];`);
    lines.push("");
  }

  return lines.join("\n");
}

export function generateEmptyServerSeedFile(): string {
  return `// ============================================================
// SEED SCRIPT CLEARED — Magic Seed Engine
// Seed data has been wiped. This file is a no-op.
// Re-generate via the Seeds tab in the workspace.
// ============================================================

export async function runSeed(): Promise<void> {
  console.log("[seed] No seed data configured.");
}

export async function wipeSeed(): Promise<void> {
  console.log("[seed] No seed data to wipe.");
}
`;
}

export type { SchemaTable, ColumnDef, SeedData, SeedRecord };
