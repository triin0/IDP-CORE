import type { UIRDocument, UIREmitTarget } from "./schema.js";

export interface EmittedFile {
  path: string;
  content: string;
}

export interface EmitResult {
  target: UIREmitTarget;
  files: EmittedFile[];
  diagnostics: EmitDiagnostic[];
  hash: string;
}

export interface EmitDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  entity?: string;
  file?: string;
}

export interface Emitter {
  readonly target: UIREmitTarget;
  emit(doc: UIRDocument): Promise<EmitResult>;
  supports(doc: UIRDocument): boolean;
}

export interface OrchestratorResult {
  source: UIRDocument;
  sourceHash: string;
  results: EmitResult[];
  timestamp: number;
  success: boolean;
}

export async function orchestrate(
  doc: UIRDocument,
  emitters: Emitter[],
): Promise<OrchestratorResult> {
  const { hashUIR } = await import("./integrity.js");
  const sourceHash = hashUIR(doc);

  const applicable = emitters.filter((e) =>
    doc.targets.includes(e.target) && e.supports(doc)
  );

  const results = await Promise.all(
    applicable.map((e) => e.emit(doc)),
  );

  return {
    source: doc,
    sourceHash,
    results,
    timestamp: Date.now(),
    success: results.every((r) => r.diagnostics.every((d) => d.severity !== "error")),
  };
}
