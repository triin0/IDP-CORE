export {
  UIRDocumentSchema,
  UIREntitySchema,
  UIRFieldSchema,
  UIRFieldTypeSchema,
  UIRFieldConstraintSchema,
  UIRRelationSchema,
  UIREndpointSchema,
  UIRBusinessRuleSchema,
  UIRSpatialConstraintSchema,
  UIRBoundingVolumeSchema,
  UIRTransformSchema,
  UIRMaterialSchema,
  UIRGenomeSchema,
  UIRGenomeMappingSchema,
  UIREmitTargetSchema,
} from "./schema.js";

export type {
  UIRDocument,
  UIREntity,
  UIRField,
  UIRFieldType,
  UIRFieldConstraint,
  UIRRelation,
  UIREndpoint,
  UIRBusinessRule,
  UIRSpatialConstraint,
  UIRBoundingVolume,
  UIRTransform,
  UIRMaterial,
  UIRGenome,
  UIRGenomeMapping,
  UIREmitTarget,
} from "./schema.js";

export { validateUIR } from "./validator.js";
export type { ValidationResult, ValidationError } from "./validator.js";

export { canonicalize, hashUIR, signDocument, verifyDocument } from "./integrity.js";
export type { SignedUIRDocument } from "./integrity.js";

export { orchestrate } from "./emitter.js";
export type { Emitter, EmitResult, EmittedFile, EmitDiagnostic, OrchestratorResult } from "./emitter.js";

export { WebEmitter } from "./emitters/web-emitter.js";
export { NativeEmitter } from "./emitters/native-emitter.js";
