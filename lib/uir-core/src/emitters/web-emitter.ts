import type { UIRDocument, UIREntity, UIRField, UIREndpoint } from "../schema.js";
import type { Emitter, EmitResult, EmittedFile, EmitDiagnostic } from "../emitter.js";
import { hashUIR } from "../integrity.js";

const UIR_TO_TS_TYPE: Record<string, string> = {
  string: "string",
  int: "number",
  float: "number",
  bool: "boolean",
  datetime: "Date",
  bytes: "Buffer",
  json: "Record<string, unknown>",
  uuid: "string",
};

const UIR_TO_DRIZZLE_COL: Record<string, string> = {
  string: "text",
  int: "integer",
  float: "real",
  bool: "boolean",
  datetime: "timestamp",
  bytes: "text",
  json: "jsonb",
  uuid: "uuid",
};

function entityToInterface(entity: UIREntity): string {
  const lines: string[] = [];
  lines.push(`export interface ${entity.name} {`);
  for (const field of entity.fields) {
    const tsType = UIR_TO_TS_TYPE[field.type] ?? "unknown";
    const arrayWrap = field.isArray ? `${tsType}[]` : tsType;
    const mapWrap = field.isMap ? `Record<string, ${tsType}>` : arrayWrap;
    const optional = field.isOptional ? "?" : "";
    lines.push(`  ${field.name}${optional}: ${mapWrap};`);
  }
  lines.push(`}`);
  return lines.join("\n");
}

function entityToDrizzleSchema(entity: UIREntity, relations: UIRDocument["relations"]): string {
  const lines: string[] = [];
  const imports = new Set<string>();
  imports.add("pgTable");

  for (const field of entity.fields) {
    const col = UIR_TO_DRIZZLE_COL[field.type];
    if (col) imports.add(col);
  }

  const relationsToThis = relations.filter((r) => r.to === entity.name && r.foreignKey);
  if (relationsToThis.length > 0) imports.add("integer");

  lines.push(`import { ${[...imports].join(", ")} } from "drizzle-orm/pg-core";`);
  lines.push(``);

  const tableName = camelToSnake(entity.name) + "s";
  lines.push(`export const ${entity.name.toLowerCase()}sTable = pgTable("${tableName}", {`);

  for (const field of entity.fields) {
    const colFn = UIR_TO_DRIZZLE_COL[field.type] ?? "text";
    const colName = camelToSnake(field.name);
    let colDef = `  ${field.name}: ${colFn}("${colName}")`;

    if (field.name === "id") {
      colDef += `.primaryKey()`;
      if (field.type === "uuid") {
        colDef += `.defaultRandom()`;
      }
    }

    if (!field.isOptional && field.name !== "id") {
      colDef += `.notNull()`;
    }

    if (field.default !== undefined && field.default !== null) {
      if (typeof field.default === "boolean") {
        colDef += `.default(${field.default})`;
      } else if (typeof field.default === "number") {
        colDef += `.default(${field.default})`;
      } else if (typeof field.default === "string") {
        colDef += `.default("${field.default}")`;
      }
    }

    colDef += `,`;
    lines.push(colDef);
  }

  for (const rel of relationsToThis) {
    const fkName = camelToSnake(rel.foreignKey!);
    lines.push(`  ${rel.foreignKey}: integer("${fkName}"),`);
  }

  lines.push(`});`);
  return lines.join("\n");
}

function generateRoutes(entity: UIREntity, endpoints: UIREndpoint[]): string {
  const entityLower = entity.name.toLowerCase();
  const entityEndpoints = endpoints.filter(
    (ep) => ep.requestEntity === entity.name || ep.responseEntity === entity.name || ep.path.toLowerCase().includes(`/${entityLower}`)
  );
  if (entityEndpoints.length === 0) return "";

  const lines: string[] = [];
  const routerName = `${entity.name.toLowerCase()}Router`;
  lines.push(`import { Router } from "express";`);
  lines.push(`import type { ${entity.name} } from "../types/${entity.name}.js";`);
  lines.push(``);
  lines.push(`export const ${routerName} = Router();`);
  lines.push(``);

  for (const ep of entityEndpoints) {
    const method = ep.method.toLowerCase();
    lines.push(`${routerName}.${method}("${ep.path}", async (req, res) => {`);

    if (ep.auth) {
      lines.push(`  if (!req.user) return res.status(401).json({ error: "Unauthorized" });`);
    }

    if (method === "get") {
      lines.push(`  // TODO: Implement ${ep.description ?? `GET ${ep.path}`}`);
      lines.push(`  res.json({ data: [] as ${entity.name}[] });`);
    } else if (method === "post") {
      lines.push(`  const body = req.body as Partial<${entity.name}>;`);
      lines.push(`  // TODO: Validate and create`);
      lines.push(`  res.status(201).json({ data: body });`);
    } else if (method === "put" || method === "patch") {
      lines.push(`  const { id } = req.params;`);
      lines.push(`  const body = req.body as Partial<${entity.name}>;`);
      lines.push(`  // TODO: Validate and update`);
      lines.push(`  res.json({ data: { id, ...body } });`);
    } else if (method === "delete") {
      lines.push(`  const { id } = req.params;`);
      lines.push(`  // TODO: Delete by id`);
      lines.push(`  res.status(204).send();`);
    }

    lines.push(`});`);
    lines.push(``);
  }

  return lines.join("\n");
}

function generateZodSchema(entity: UIREntity): string {
  const lines: string[] = [];
  lines.push(`import { z } from "zod";`);
  lines.push(``);
  lines.push(`export const ${entity.name}Schema = z.object({`);

  for (const field of entity.fields) {
    let zodType = uirTypeToZod(field);
    if (field.isArray) zodType = `z.array(${zodType})`;
    if (field.isMap) zodType = `z.record(${zodType})`;
    if (field.isOptional) zodType = `${zodType}.optional()`;

    for (const c of field.constraints) {
      if (c.type === "min") zodType += `.min(${c.value})`;
      if (c.type === "max") zodType += `.max(${c.value})`;
      if (c.type === "minLength") zodType += `.min(${c.value})`;
      if (c.type === "maxLength") zodType += `.max(${c.value})`;
      if (c.type === "pattern") zodType += `.regex(/${c.value}/)`;
    }

    lines.push(`  ${field.name}: ${zodType},`);
  }

  lines.push(`});`);
  lines.push(``);
  lines.push(`export type ${entity.name}Input = z.infer<typeof ${entity.name}Schema>;`);
  return lines.join("\n");
}

function uirTypeToZod(field: UIRField): string {
  switch (field.type) {
    case "string": return "z.string()";
    case "int": return "z.number().int()";
    case "float": return "z.number()";
    case "bool": return "z.boolean()";
    case "datetime": return "z.coerce.date()";
    case "uuid": return "z.string().uuid()";
    case "bytes": return "z.string()";
    case "json": return "z.record(z.unknown())";
    default: return "z.unknown()";
  }
}

function camelToSnake(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
}

export class WebEmitter implements Emitter {
  readonly target = "web" as const;

  supports(doc: UIRDocument): boolean {
    return doc.targets.includes("web") || doc.targets.includes("api");
  }

  async emit(doc: UIRDocument): Promise<EmitResult> {
    const files: EmittedFile[] = [];
    const diagnostics: EmitDiagnostic[] = [];
    const dataEntities = doc.entities.filter((e) => e.kind === "data" || e.fields.length > 0);

    for (const entity of dataEntities) {
      files.push({
        path: `src/types/${entity.name}.ts`,
        content: entityToInterface(entity),
      });

      files.push({
        path: `src/schemas/${entity.name}Schema.ts`,
        content: generateZodSchema(entity),
      });

      files.push({
        path: `src/db/schema/${entity.name}.ts`,
        content: entityToDrizzleSchema(entity, doc.relations),
      });

      const routes = generateRoutes(entity, doc.endpoints);
      if (routes) {
        files.push({
          path: `src/routes/${entity.name.toLowerCase()}.ts`,
          content: routes,
        });
      }
    }

    const routeImports = dataEntities
      .filter((e) => doc.endpoints.some((ep) => ep.requestEntity === e.name || ep.responseEntity === e.name))
      .map((e) => ({
        name: e.name.toLowerCase(),
        import: `import { ${e.name.toLowerCase()}Router } from "./routes/${e.name.toLowerCase()}.js";`,
        use: `app.use("${doc.endpoints.find((ep) => ep.responseEntity === e.name || ep.requestEntity === e.name)?.path.split("/").slice(0, -1).join("/") || `/api/${e.name.toLowerCase()}`}", ${e.name.toLowerCase()}Router);`,
      }));

    const serverLines: string[] = [];
    serverLines.push(`import express from "express";`);
    serverLines.push(`import helmet from "helmet";`);
    serverLines.push(`import cors from "cors";`);
    for (const r of routeImports) serverLines.push(r.import);
    serverLines.push(``);
    serverLines.push(`const app = express();`);
    serverLines.push(`app.use(helmet());`);
    serverLines.push(`app.use(cors());`);
    serverLines.push(`app.use(express.json());`);
    serverLines.push(``);
    for (const r of routeImports) serverLines.push(r.use);
    serverLines.push(``);
    serverLines.push(`app.get("/health", (_, res) => res.json({ status: "ok", name: "${doc.name}" }));`);
    serverLines.push(``);
    serverLines.push(`const PORT = process.env.PORT ?? 3000;`);
    serverLines.push(`app.listen(PORT, () => console.log(\`${doc.name} running on port \${PORT}\`));`);

    files.push({ path: "src/server.ts", content: serverLines.join("\n") });

    if (dataEntities.length === 0) {
      diagnostics.push({
        severity: "warning",
        message: "No data entities found — generated server has no routes",
      });
    }

    return {
      target: "web",
      files,
      diagnostics,
      hash: hashUIR(doc),
    };
  }
}
