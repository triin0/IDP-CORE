import { callWithRetry } from "./ai-retry";

interface DatabaseTable {
  name: string;
  columns: string[];
}

interface SeedRecord {
  [key: string]: string | number | boolean | null;
}

interface SeedData {
  tableName: string;
  columns: string[];
  rows: SeedRecord[];
}

export async function generateSeedData(
  tables: DatabaseTable[],
  appOverview: string,
  rowsPerTable: number = 5,
): Promise<SeedData[]> {
  if (!tables || tables.length === 0) {
    throw new Error("No database tables found in this project");
  }

  const tableDescriptions = tables
    .map((t) => `Table "${t.name}": columns = [${t.columns.join(", ")}]`)
    .join("\n");

  const prompt = `You are a seed data generator for a web application.

### APPLICATION CONTEXT
${appOverview}

### DATABASE TABLES
${tableDescriptions}

### INSTRUCTIONS
Generate ${rowsPerTable} realistic, diverse seed data rows for each table. The data should:
1. Be realistic and contextually appropriate for the application
2. Use varied, creative values (not just "Test 1", "Test 2")
3. Respect column types inferred from column names (e.g., "email" → valid emails, "created_at" → ISO dates)
4. Maintain referential integrity between tables (e.g., foreign keys should reference valid IDs)
5. Include edge cases where appropriate (e.g., long names, special characters)
6. Use sequential integer IDs starting from 1 for "id" columns

### OUTPUT FORMAT
Return a JSON object with a "tables" array. Each entry has:
- "tableName": string
- "columns": string[] (just column names, no types)
- "rows": array of objects, each mapping column name → value

Example:
{
  "tables": [
    {
      "tableName": "users",
      "columns": ["id", "name", "email"],
      "rows": [
        {"id": 1, "name": "Alice Chen", "email": "alice@example.com"},
        {"id": 2, "name": "Bob Smith", "email": "bob@example.com"}
      ]
    }
  ]
}

Only output the JSON object. No text before or after.`;

  const content = await callWithRetry({
    model: "gemini-2.5-pro",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  }, "seed-data-generation");

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI returned no valid JSON for seed data");
  }

  const parsed = JSON.parse(jsonMatch[0]) as { tables: SeedData[] };
  if (!parsed.tables || !Array.isArray(parsed.tables)) {
    throw new Error("AI returned invalid seed data format");
  }

  return parsed.tables;
}

export function seedDataToSQL(seedData: SeedData[]): string {
  const lines: string[] = ["-- Auto-generated seed data"];

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
    lines.push(`\nexport const ${varName}Seeds = ${JSON.stringify(table.rows, null, 2)};`);
  }

  return lines.join("\n");
}
