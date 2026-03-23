import { z } from "zod";

export const UIRFieldTypeSchema = z.enum([
  "string",
  "int",
  "float",
  "bool",
  "datetime",
  "bytes",
  "json",
  "uuid",
]);

export const UIRFieldConstraintSchema = z.object({
  type: z.enum(["min", "max", "minLength", "maxLength", "pattern", "enum", "custom"]),
  value: z.union([z.string(), z.number()]),
  message: z.string().optional(),
});

export const UIRFieldSchema = z.object({
  name: z.string().min(1),
  type: UIRFieldTypeSchema,
  isOptional: z.boolean().default(false),
  isArray: z.boolean().default(false),
  isMap: z.boolean().default(false),
  mapKeyType: UIRFieldTypeSchema.optional(),
  refEntity: z.string().optional(),
  default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  constraints: z.array(UIRFieldConstraintSchema).default([]),
  description: z.string().optional(),
});

export const UIRRelationSchema = z.object({
  type: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
  from: z.string(),
  to: z.string(),
  foreignKey: z.string().optional(),
  cascadeDelete: z.boolean().default(false),
});

export const UIRSpatialConstraintSchema = z.object({
  type: z.enum([
    "gravity",
    "collision",
    "clearance",
    "support",
    "containment",
    "alignment",
    "attachment",
    "reachability",
  ]),
  target: z.string().optional(),
  params: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export const UIRBoundingVolumeSchema = z.object({
  type: z.enum(["box", "sphere", "capsule", "mesh"]),
  dimensions: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  offset: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    z: z.number().default(0),
  }).default({ x: 0, y: 0, z: 0 }),
});

export const UIRTransformSchema = z.object({
  position: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    z: z.number().default(0),
  }).default({ x: 0, y: 0, z: 0 }),
  rotation: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    z: z.number().default(0),
  }).default({ x: 0, y: 0, z: 0 }),
  scale: z.object({
    x: z.number().default(1),
    y: z.number().default(1),
    z: z.number().default(1),
  }).default({ x: 1, y: 1, z: 1 }),
});

export const UIRMaterialSchema = z.object({
  baseColor: z.tuple([z.number(), z.number(), z.number()]).optional(),
  metalness: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(1).optional(),
  emissive: z.number().min(0).optional(),
  opacity: z.number().min(0).max(1).optional(),
  textureHint: z.string().optional(),
});

export const UIRGenomeMappingSchema = z.object({
  byteOffset: z.number().int().min(0).max(31),
  byteLength: z.number().int().min(1).max(32),
  target: z.string(),
  transform: z.enum(["linear", "exponential", "step", "modulo", "lookup"]).default("linear"),
  range: z.tuple([z.number(), z.number()]).optional(),
  lookupTable: z.array(z.string()).optional(),
});

export const UIRGenomeSchema = z.object({
  seed: z.string().length(64).optional(),
  byteLength: z.number().int().default(32),
  mappings: z.array(UIRGenomeMappingSchema).default([]),
});

export const UIREntitySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["data", "spatial", "actor", "component", "system"]),
  fields: z.array(UIRFieldSchema).default([]),
  genome: UIRGenomeSchema.optional(),
  transform: UIRTransformSchema.optional(),
  boundingVolume: UIRBoundingVolumeSchema.optional(),
  material: UIRMaterialSchema.optional(),
  spatialConstraints: z.array(UIRSpatialConstraintSchema).default([]),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
});

export const UIREndpointSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string(),
  description: z.string().optional(),
  requestEntity: z.string().optional(),
  responseEntity: z.string().optional(),
  auth: z.boolean().default(false),
});

export const UIRBusinessRuleSchema = z.object({
  name: z.string(),
  when: z.string(),
  then: z.string(),
  priority: z.number().int().default(0),
});

export const UIREmitTargetSchema = z.enum([
  "web",
  "native",
  "asset",
  "mobile",
  "api",
]);

export const UIRDocumentSchema = z.object({
  version: z.literal("1.0.0"),
  name: z.string().min(1),
  description: z.string().optional(),
  targets: z.array(UIREmitTargetSchema).min(1),
  entities: z.array(UIREntitySchema).min(1),
  relations: z.array(UIRRelationSchema).default([]),
  endpoints: z.array(UIREndpointSchema).default([]),
  businessRules: z.array(UIRBusinessRuleSchema).default([]),
  genome: UIRGenomeSchema.optional(),
  metadata: z.record(z.string()).default({}),
});

export type UIRFieldType = z.infer<typeof UIRFieldTypeSchema>;
export type UIRFieldConstraint = z.infer<typeof UIRFieldConstraintSchema>;
export type UIRField = z.infer<typeof UIRFieldSchema>;
export type UIRRelation = z.infer<typeof UIRRelationSchema>;
export type UIRSpatialConstraint = z.infer<typeof UIRSpatialConstraintSchema>;
export type UIRBoundingVolume = z.infer<typeof UIRBoundingVolumeSchema>;
export type UIRTransform = z.infer<typeof UIRTransformSchema>;
export type UIRMaterial = z.infer<typeof UIRMaterialSchema>;
export type UIRGenomeMapping = z.infer<typeof UIRGenomeMappingSchema>;
export type UIRGenome = z.infer<typeof UIRGenomeSchema>;
export type UIREntity = z.infer<typeof UIREntitySchema>;
export type UIREndpoint = z.infer<typeof UIREndpointSchema>;
export type UIRBusinessRule = z.infer<typeof UIRBusinessRuleSchema>;
export type UIREmitTarget = z.infer<typeof UIREmitTargetSchema>;
export type UIRDocument = z.infer<typeof UIRDocumentSchema>;
