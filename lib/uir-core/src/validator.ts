import { UIRDocumentSchema, type UIRDocument } from "./schema.js";

export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  document: UIRDocument | null;
}

export function validateUIR(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const parsed = UIRDocumentSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        path: issue.path.join("."),
        message: issue.message,
        severity: "error",
      });
    }
    return { valid: false, errors, warnings, document: null };
  }

  const doc = parsed.data;

  validateEntityNames(doc, errors);
  validateRelations(doc, errors);
  validateEndpoints(doc, errors, warnings);
  validateGenomeMappings(doc, errors, warnings);
  validateSpatialConstraints(doc, errors, warnings);
  validateTargetConsistency(doc, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    document: errors.length === 0 ? doc : null,
  };
}

function validateEntityNames(doc: UIRDocument, errors: ValidationError[]) {
  const names = new Set<string>();
  for (const entity of doc.entities) {
    if (names.has(entity.name)) {
      errors.push({
        path: `entities.${entity.name}`,
        message: `Duplicate entity name: "${entity.name}"`,
        severity: "error",
      });
    }
    names.add(entity.name);

    const fieldNames = new Set<string>();
    for (const field of entity.fields) {
      if (fieldNames.has(field.name)) {
        errors.push({
          path: `entities.${entity.name}.fields.${field.name}`,
          message: `Duplicate field name: "${field.name}" in entity "${entity.name}"`,
          severity: "error",
        });
      }
      fieldNames.add(field.name);

      if (field.refEntity && !doc.entities.some((e) => e.name === field.refEntity)) {
        errors.push({
          path: `entities.${entity.name}.fields.${field.name}.refEntity`,
          message: `Referenced entity "${field.refEntity}" does not exist`,
          severity: "error",
        });
      }
    }
  }
}

function validateRelations(doc: UIRDocument, errors: ValidationError[]) {
  const entityNames = new Set(doc.entities.map((e) => e.name));
  for (let i = 0; i < doc.relations.length; i++) {
    const rel = doc.relations[i];
    if (!entityNames.has(rel.from)) {
      errors.push({
        path: `relations[${i}].from`,
        message: `Relation references nonexistent entity: "${rel.from}"`,
        severity: "error",
      });
    }
    if (!entityNames.has(rel.to)) {
      errors.push({
        path: `relations[${i}].to`,
        message: `Relation references nonexistent entity: "${rel.to}"`,
        severity: "error",
      });
    }
  }
}

function validateEndpoints(doc: UIRDocument, errors: ValidationError[], warnings: ValidationError[]) {
  const entityNames = new Set(doc.entities.map((e) => e.name));
  const endpointKeys = new Set<string>();

  for (let i = 0; i < doc.endpoints.length; i++) {
    const ep = doc.endpoints[i];
    const key = `${ep.method} ${ep.path}`;
    if (endpointKeys.has(key)) {
      errors.push({
        path: `endpoints[${i}]`,
        message: `Duplicate endpoint: ${key}`,
        severity: "error",
      });
    }
    endpointKeys.add(key);

    if (ep.requestEntity && !entityNames.has(ep.requestEntity)) {
      errors.push({
        path: `endpoints[${i}].requestEntity`,
        message: `Endpoint references nonexistent request entity: "${ep.requestEntity}"`,
        severity: "error",
      });
    }
    if (ep.responseEntity && !entityNames.has(ep.responseEntity)) {
      errors.push({
        path: `endpoints[${i}].responseEntity`,
        message: `Endpoint references nonexistent response entity: "${ep.responseEntity}"`,
        severity: "error",
      });
    }

    if (!doc.targets.includes("web") && !doc.targets.includes("api")) {
      warnings.push({
        path: `endpoints[${i}]`,
        message: `Endpoint defined but no "web" or "api" target specified`,
        severity: "warning",
      });
    }
  }
}

function validateGenomeMappings(doc: UIRDocument, errors: ValidationError[], warnings: ValidationError[]) {
  for (const entity of doc.entities) {
    if (!entity.genome) continue;

    const coveredBytes = new Set<number>();
    for (let i = 0; i < entity.genome.mappings.length; i++) {
      const mapping = entity.genome.mappings[i];

      if (mapping.byteOffset + mapping.byteLength > entity.genome.byteLength) {
        errors.push({
          path: `entities.${entity.name}.genome.mappings[${i}]`,
          message: `Genome mapping exceeds byte length: offset ${mapping.byteOffset} + length ${mapping.byteLength} > ${entity.genome.byteLength}`,
          severity: "error",
        });
      }

      for (let b = mapping.byteOffset; b < mapping.byteOffset + mapping.byteLength; b++) {
        if (coveredBytes.has(b)) {
          warnings.push({
            path: `entities.${entity.name}.genome.mappings[${i}]`,
            message: `Genome byte ${b} is mapped by multiple mappings (overlapping)`,
            severity: "warning",
          });
        }
        coveredBytes.add(b);
      }

      if (mapping.transform === "lookup" && (!mapping.lookupTable || mapping.lookupTable.length === 0)) {
        errors.push({
          path: `entities.${entity.name}.genome.mappings[${i}]`,
          message: `Lookup transform requires a non-empty lookupTable`,
          severity: "error",
        });
      }
    }

    if (coveredBytes.size < entity.genome.byteLength) {
      const unmapped = entity.genome.byteLength - coveredBytes.size;
      warnings.push({
        path: `entities.${entity.name}.genome`,
        message: `${unmapped} genome bytes are unmapped`,
        severity: "warning",
      });
    }
  }
}

function validateSpatialConstraints(doc: UIRDocument, errors: ValidationError[], warnings: ValidationError[]) {
  const entityNames = new Set(doc.entities.map((e) => e.name));

  for (const entity of doc.entities) {
    if (entity.spatialConstraints.length > 0 && entity.kind !== "spatial" && entity.kind !== "actor") {
      warnings.push({
        path: `entities.${entity.name}.spatialConstraints`,
        message: `Spatial constraints on non-spatial entity kind "${entity.kind}" — consider using kind "spatial" or "actor"`,
        severity: "warning",
      });
    }

    if (entity.kind === "spatial" && !entity.boundingVolume) {
      warnings.push({
        path: `entities.${entity.name}`,
        message: `Spatial entity "${entity.name}" has no bounding volume defined`,
        severity: "warning",
      });
    }

    for (let i = 0; i < entity.spatialConstraints.length; i++) {
      const constraint = entity.spatialConstraints[i];
      if (constraint.target && !entityNames.has(constraint.target)) {
        errors.push({
          path: `entities.${entity.name}.spatialConstraints[${i}].target`,
          message: `Spatial constraint references nonexistent entity: "${constraint.target}"`,
          severity: "error",
        });
      }
    }
  }
}

function validateTargetConsistency(doc: UIRDocument, errors: ValidationError[], warnings: ValidationError[]) {
  const hasSpatialEntities = doc.entities.some((e) => e.kind === "spatial" || e.kind === "actor");
  const hasGenomeEntities = doc.entities.some((e) => !!e.genome);

  if (doc.targets.includes("native") && !hasGenomeEntities && !hasSpatialEntities) {
    warnings.push({
      path: "targets",
      message: `"native" target specified but no entities have genome data or spatial properties`,
      severity: "warning",
    });
  }

  if (doc.targets.includes("asset") && !hasSpatialEntities) {
    warnings.push({
      path: "targets",
      message: `"asset" target specified but no spatial entities defined`,
      severity: "warning",
    });
  }

  if (doc.targets.includes("web") && doc.endpoints.length === 0) {
    warnings.push({
      path: "targets",
      message: `"web" target specified but no endpoints defined`,
      severity: "warning",
    });
  }
}
