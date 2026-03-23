import { createHash } from "crypto";
import type { UIRDocument } from "./schema.js";

export function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean" || typeof obj === "number") return JSON.stringify(obj);
  if (typeof obj === "string") return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalize(item));
    return `[${items.join(",")}]`;
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys
      .filter((k) => (obj as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalize((obj as Record<string, unknown>)[k])}`);
    return `{${pairs.join(",")}}`;
  }

  return String(obj);
}

export function hashUIR(doc: UIRDocument): string {
  const canonical = canonicalize(doc);
  return createHash("sha256").update(canonical, "utf-8").digest("hex");
}

export interface SignedUIRDocument {
  document: UIRDocument;
  hash: string;
  timestamp: number;
}

export function signDocument(doc: UIRDocument): SignedUIRDocument {
  return {
    document: doc,
    hash: hashUIR(doc),
    timestamp: Date.now(),
  };
}

export function verifyDocument(signed: SignedUIRDocument): boolean {
  return hashUIR(signed.document) === signed.hash;
}
