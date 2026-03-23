import { strict as assert } from "assert";
import {
  validateUIR,
  hashUIR,
  canonicalize,
  signDocument,
  verifyDocument,
  orchestrate,
  UIRDocumentSchema,
  WebEmitter,
  NativeEmitter,
  type UIRDocument,
  type Emitter,
  type EmitResult,
} from "../src/index.js";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then(() => { passed++; })
        .catch((e: Error) => { failed++; failures.push(`FAIL: ${name} — ${e.message}`); });
    }
    passed++;
  } catch (e: unknown) {
    failed++;
    failures.push(`FAIL: ${name} — ${(e as Error).message}`);
  }
}

function minimalWebApp(): UIRDocument {
  return {
    version: "1.0.0",
    name: "TaskManager",
    description: "A simple task management app",
    targets: ["web"],
    entities: [
      {
        name: "Task",
        kind: "data",
        fields: [
          { name: "id", type: "uuid", isOptional: false, isArray: false, isMap: false, constraints: [], },
          { name: "title", type: "string", isOptional: false, isArray: false, isMap: false, constraints: [{ type: "minLength", value: 1 }, { type: "maxLength", value: 255 }], },
          { name: "completed", type: "bool", isOptional: false, isArray: false, isMap: false, default: false, constraints: [], },
          { name: "createdAt", type: "datetime", isOptional: false, isArray: false, isMap: false, constraints: [], },
        ],
        spatialConstraints: [],
        tags: ["crud"],
      },
      {
        name: "User",
        kind: "data",
        fields: [
          { name: "id", type: "uuid", isOptional: false, isArray: false, isMap: false, constraints: [], },
          { name: "email", type: "string", isOptional: false, isArray: false, isMap: false, constraints: [{ type: "pattern", value: "^.+@.+\\..+$" }], },
          { name: "name", type: "string", isOptional: false, isArray: false, isMap: false, constraints: [], },
        ],
        spatialConstraints: [],
        tags: [],
      },
    ],
    relations: [
      { type: "one-to-many", from: "User", to: "Task", foreignKey: "userId", cascadeDelete: false },
    ],
    endpoints: [
      { method: "GET", path: "/tasks", responseEntity: "Task", auth: true },
      { method: "POST", path: "/tasks", requestEntity: "Task", responseEntity: "Task", auth: true },
      { method: "DELETE", path: "/tasks/:id", auth: true },
    ],
    businessRules: [
      { name: "TaskTitleRequired", when: "Task.title is empty", then: "reject with 400", priority: 0 },
    ],
    metadata: {},
  };
}

function genomeCreature(): UIRDocument {
  return {
    version: "1.0.0",
    name: "CreatureBattler",
    targets: ["web", "native", "asset"],
    entities: [
      {
        name: "Creature",
        kind: "actor",
        fields: [
          { name: "id", type: "uuid", isOptional: false, isArray: false, isMap: false, constraints: [], },
          { name: "name", type: "string", isOptional: false, isArray: false, isMap: false, constraints: [], },
          { name: "health", type: "int", isOptional: false, isArray: false, isMap: false, constraints: [{ type: "min", value: 0 }, { type: "max", value: 1000 }], },
          { name: "attack", type: "int", isOptional: false, isArray: false, isMap: false, constraints: [{ type: "min", value: 0 }], },
          { name: "speed", type: "float", isOptional: false, isArray: false, isMap: false, constraints: [{ type: "min", value: 0 }, { type: "max", value: 100 }], },
        ],
        genome: {
          byteLength: 32,
          mappings: [
            { byteOffset: 0, byteLength: 3, target: "material.baseColor", transform: "linear" },
            { byteOffset: 3, byteLength: 3, target: "material.secondaryColor", transform: "linear" },
            { byteOffset: 6, byteLength: 1, target: "material.roughness", transform: "linear", range: [0, 1] },
            { byteOffset: 7, byteLength: 1, target: "material.metalness", transform: "linear", range: [0, 1] },
            { byteOffset: 8, byteLength: 1, target: "material.emissive", transform: "linear", range: [0, 5] },
            { byteOffset: 9, byteLength: 4, target: "morphology.bodyScale", transform: "linear", range: [0.5, 3.0] },
            { byteOffset: 13, byteLength: 1, target: "morphology.limbCount", transform: "step", range: [2, 8] },
            { byteOffset: 14, byteLength: 1, target: "morphology.symmetry", transform: "linear", range: [0, 1] },
            { byteOffset: 15, byteLength: 1, target: "morphology.appendageType", transform: "lookup", lookupTable: ["claws", "tentacles", "wings", "fins", "pincers", "hooves"] },
            { byteOffset: 16, byteLength: 2, target: "behavior.aggression", transform: "linear", range: [0, 100] },
            { byteOffset: 18, byteLength: 2, target: "behavior.curiosity", transform: "linear", range: [0, 100] },
            { byteOffset: 20, byteLength: 2, target: "behavior.resilience", transform: "linear", range: [0, 100] },
            { byteOffset: 22, byteLength: 2, target: "behavior.speed", transform: "linear", range: [0, 100] },
            { byteOffset: 24, byteLength: 4, target: "environment.affinity", transform: "lookup", lookupTable: ["volcanic", "aquatic", "forest", "tundra", "desert", "void"] },
            { byteOffset: 28, byteLength: 2, target: "rarity.tier", transform: "exponential", range: [1, 100] },
            { byteOffset: 30, byteLength: 2, target: "lineage.generation", transform: "linear", range: [0, 65535] },
          ],
        },
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        boundingVolume: {
          type: "capsule",
          dimensions: { x: 1, y: 2, z: 1 },
          offset: { x: 0, y: 1, z: 0 },
        },
        material: {
          metalness: 0.3,
          roughness: 0.7,
        },
        spatialConstraints: [
          { type: "gravity", params: { force: 9.81, direction: "down" } },
          { type: "collision", params: { layer: "creature", response: "block" } },
        ],
        tags: ["creature", "battler", "genome-driven"],
      },
      {
        name: "Arena",
        kind: "spatial",
        fields: [
          { name: "id", type: "uuid", isOptional: false, isArray: false, isMap: false, constraints: [], },
          { name: "name", type: "string", isOptional: false, isArray: false, isMap: false, constraints: [], },
          { name: "biome", type: "string", isOptional: false, isArray: false, isMap: false, constraints: [{ type: "enum", value: "volcanic,aquatic,forest,tundra,desert,void" }], },
        ],
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 50, y: 10, z: 50 },
        },
        boundingVolume: {
          type: "box",
          dimensions: { x: 100, y: 20, z: 100 },
        },
        spatialConstraints: [
          { type: "containment", params: { maxEntities: 10 } },
        ],
        tags: ["arena", "environment"],
      },
    ],
    relations: [
      { type: "many-to-many", from: "Creature", to: "Arena", cascadeDelete: false },
    ],
    endpoints: [
      { method: "GET", path: "/creatures", responseEntity: "Creature", auth: false },
      { method: "POST", path: "/creatures/breed", requestEntity: "Creature", responseEntity: "Creature", auth: true },
      { method: "POST", path: "/arena/battle", auth: true },
    ],
    businessRules: [
      { name: "BreedRequiresTwo", when: "breed request has fewer than 2 parents", then: "reject with 400", priority: 0 },
      { name: "BattleMaxCreatures", when: "battle request exceeds arena maxEntities", then: "reject with 400", priority: 0 },
    ],
    metadata: { genre: "creature-battler", engine: "sovereign" },
  };
}

function spatialScene(): UIRDocument {
  return {
    version: "1.0.0",
    name: "LivingRoom",
    targets: ["asset", "native"],
    entities: [
      {
        name: "Room",
        kind: "spatial",
        fields: [
          { name: "width", type: "float", isOptional: false, isArray: false, isMap: false, constraints: [{ type: "min", value: 2 }], },
          { name: "depth", type: "float", isOptional: false, isArray: false, isMap: false, constraints: [{ type: "min", value: 2 }], },
          { name: "height", type: "float", isOptional: false, isArray: false, isMap: false, constraints: [{ type: "min", value: 2.4 }], },
        ],
        boundingVolume: { type: "box", dimensions: { x: 6, y: 3, z: 8 } },
        spatialConstraints: [],
        tags: ["room"],
      },
      {
        name: "Couch",
        kind: "spatial",
        fields: [],
        boundingVolume: { type: "box", dimensions: { x: 2.2, y: 0.9, z: 0.9 } },
        material: { baseColor: [80, 60, 40], roughness: 0.8 },
        spatialConstraints: [
          { type: "gravity", params: {} },
          { type: "collision", params: {} },
          { type: "clearance", target: "Door", params: { minDistance: 0.6 } },
          { type: "support", params: { surface: "floor" } },
          { type: "containment", target: "Room", params: {} },
        ],
        tags: ["furniture"],
      },
      {
        name: "CoffeeTable",
        kind: "spatial",
        fields: [],
        boundingVolume: { type: "box", dimensions: { x: 1.2, y: 0.45, z: 0.6 } },
        material: { baseColor: [140, 100, 60], roughness: 0.4, metalness: 0 },
        spatialConstraints: [
          { type: "gravity", params: {} },
          { type: "collision", params: {} },
          { type: "clearance", target: "Couch", params: { minDistance: 0.3, maxDistance: 0.6 } },
          { type: "support", params: { surface: "floor" } },
          { type: "containment", target: "Room", params: {} },
        ],
        tags: ["furniture"],
      },
      {
        name: "Door",
        kind: "spatial",
        fields: [],
        boundingVolume: { type: "box", dimensions: { x: 0.9, y: 2.1, z: 0.1 } },
        spatialConstraints: [
          { type: "attachment", target: "Room", params: { surface: "wall" } },
          { type: "clearance", params: { swingRadius: 0.9, minClearance: 0.9 } },
          { type: "reachability", params: { from: "entrance", walkableWidth: 0.6 } },
        ],
        tags: ["portal"],
      },
    ],
    relations: [],
    endpoints: [],
    businessRules: [],
    metadata: { style: "modern", mood: "cozy" },
  };
}

async function runTests() {
  console.log("UIR Core Test Suite\n" + "=".repeat(60));

  test("Schema: validates minimal web app UIR", () => {
    const result = UIRDocumentSchema.safeParse(minimalWebApp());
    assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
  });

  test("Schema: validates genome creature UIR", () => {
    const result = UIRDocumentSchema.safeParse(genomeCreature());
    assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
  });

  test("Schema: validates spatial scene UIR", () => {
    const result = UIRDocumentSchema.safeParse(spatialScene());
    assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
  });

  test("Schema: rejects missing version", () => {
    const doc = { ...minimalWebApp(), version: undefined };
    const result = UIRDocumentSchema.safeParse(doc);
    assert.ok(!result.success);
  });

  test("Schema: rejects wrong version", () => {
    const doc = { ...minimalWebApp(), version: "2.0.0" };
    const result = UIRDocumentSchema.safeParse(doc);
    assert.ok(!result.success);
  });

  test("Schema: rejects empty entities", () => {
    const doc = { ...minimalWebApp(), entities: [] };
    const result = UIRDocumentSchema.safeParse(doc);
    assert.ok(!result.success);
  });

  test("Schema: rejects empty targets", () => {
    const doc = { ...minimalWebApp(), targets: [] };
    const result = UIRDocumentSchema.safeParse(doc);
    assert.ok(!result.success);
  });

  test("Schema: rejects invalid target", () => {
    const doc = { ...minimalWebApp(), targets: ["invalid" as any] };
    const result = UIRDocumentSchema.safeParse(doc);
    assert.ok(!result.success);
  });

  test("Schema: rejects invalid entity kind", () => {
    const doc = minimalWebApp();
    doc.entities[0].kind = "invalid" as any;
    const result = UIRDocumentSchema.safeParse(doc);
    assert.ok(!result.success);
  });

  test("Schema: rejects invalid field type", () => {
    const doc = minimalWebApp();
    doc.entities[0].fields[0].type = "invalid" as any;
    const result = UIRDocumentSchema.safeParse(doc);
    assert.ok(!result.success);
  });

  test("Validator: accepts valid web app", () => {
    const result = validateUIR(minimalWebApp());
    assert.ok(result.valid, `Validation errors: ${JSON.stringify(result.errors)}`);
    assert.ok(result.document !== null);
    assert.equal(result.errors.length, 0);
  });

  test("Validator: accepts valid genome creature", () => {
    const result = validateUIR(genomeCreature());
    assert.ok(result.valid, `Validation errors: ${JSON.stringify(result.errors)}`);
  });

  test("Validator: accepts valid spatial scene", () => {
    const result = validateUIR(spatialScene());
    assert.ok(result.valid, `Validation errors: ${JSON.stringify(result.errors)}`);
  });

  test("Validator: detects duplicate entity names", () => {
    const doc = minimalWebApp();
    doc.entities.push({ ...doc.entities[0] });
    const result = validateUIR(doc);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.message.includes("Duplicate entity name")));
  });

  test("Validator: detects duplicate field names", () => {
    const doc = minimalWebApp();
    doc.entities[0].fields.push({ ...doc.entities[0].fields[0] });
    const result = validateUIR(doc);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.message.includes("Duplicate field name")));
  });

  test("Validator: detects nonexistent relation entity", () => {
    const doc = minimalWebApp();
    doc.relations = [{ type: "one-to-many", from: "User", to: "Nonexistent", cascadeDelete: false }];
    const result = validateUIR(doc);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.message.includes("nonexistent entity")));
  });

  test("Validator: detects nonexistent refEntity in field", () => {
    const doc = minimalWebApp();
    doc.entities[0].fields.push({
      name: "owner",
      type: "uuid",
      isOptional: false,
      isArray: false,
      isMap: false,
      refEntity: "GhostEntity",
      constraints: [],
    });
    const result = validateUIR(doc);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.message.includes("GhostEntity")));
  });

  test("Validator: detects duplicate endpoints", () => {
    const doc = minimalWebApp();
    doc.endpoints.push(doc.endpoints[0]);
    const result = validateUIR(doc);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.message.includes("Duplicate endpoint")));
  });

  test("Validator: detects nonexistent endpoint entity reference", () => {
    const doc = minimalWebApp();
    doc.endpoints.push({ method: "GET", path: "/ghost", responseEntity: "GhostEntity", auth: false });
    const result = validateUIR(doc);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.message.includes("GhostEntity")));
  });

  test("Validator: detects genome mapping exceeding byte length", () => {
    const doc = genomeCreature();
    doc.entities[0].genome!.mappings.push({
      byteOffset: 30,
      byteLength: 5,
      target: "overflow",
      transform: "linear",
    });
    const result = validateUIR(doc);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.message.includes("exceeds byte length")));
  });

  test("Validator: detects lookup without lookupTable", () => {
    const doc = genomeCreature();
    doc.entities[0].genome!.mappings.push({
      byteOffset: 0,
      byteLength: 1,
      target: "broken",
      transform: "lookup",
    });
    const result = validateUIR(doc);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.message.includes("lookupTable")));
  });

  test("Validator: warns on overlapping genome bytes", () => {
    const doc = genomeCreature();
    doc.entities[0].genome!.mappings.push({
      byteOffset: 0,
      byteLength: 1,
      target: "overlap",
      transform: "linear",
    });
    const result = validateUIR(doc);
    assert.ok(result.warnings.some((w) => w.message.includes("overlapping")));
  });

  test("Validator: detects nonexistent spatial constraint target", () => {
    const doc = spatialScene();
    doc.entities[1].spatialConstraints.push({
      type: "clearance",
      target: "GhostEntity",
      params: {},
    });
    const result = validateUIR(doc);
    assert.ok(!result.valid);
    assert.ok(result.errors.some((e) => e.message.includes("GhostEntity")));
  });

  test("Validator: warns on spatial constraints on data entity", () => {
    const doc = minimalWebApp();
    doc.entities[0].spatialConstraints = [{ type: "gravity", params: {} }];
    const result = validateUIR(doc);
    assert.ok(result.warnings.some((w) => w.message.includes("non-spatial entity")));
  });

  test("Validator: warns on spatial entity without bounding volume", () => {
    const doc = spatialScene();
    delete (doc.entities[0] as any).boundingVolume;
    const result = validateUIR(doc);
    assert.ok(result.warnings.some((w) => w.message.includes("no bounding volume")));
  });

  test("Validator: warns on native target without genome or spatial entities", () => {
    const doc = minimalWebApp();
    doc.targets = ["native"];
    doc.endpoints = [];
    const result = validateUIR(doc);
    assert.ok(result.warnings.some((w) => w.message.includes("native")));
  });

  test("Validator: warns on web target without endpoints", () => {
    const doc = minimalWebApp();
    doc.endpoints = [];
    const result = validateUIR(doc);
    assert.ok(result.warnings.some((w) => w.message.includes("no endpoints")));
  });

  test("Validator: returns null document on error", () => {
    const result = validateUIR({ garbage: true });
    assert.ok(!result.valid);
    assert.equal(result.document, null);
  });

  test("Integrity: deterministic hash", () => {
    const doc = minimalWebApp();
    const hash1 = hashUIR(doc);
    const hash2 = hashUIR(doc);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });

  test("Integrity: different docs produce different hashes", () => {
    const hash1 = hashUIR(minimalWebApp());
    const hash2 = hashUIR(genomeCreature());
    assert.notEqual(hash1, hash2);
  });

  test("Integrity: hash changes on modification", () => {
    const doc = minimalWebApp();
    const hash1 = hashUIR(doc);
    doc.name = "ModifiedApp";
    const hash2 = hashUIR(doc);
    assert.notEqual(hash1, hash2);
  });

  test("Integrity: canonicalize produces sorted keys", () => {
    const a = canonicalize({ z: 1, a: 2, m: 3 });
    const b = canonicalize({ a: 2, m: 3, z: 1 });
    assert.equal(a, b);
  });

  test("Integrity: canonicalize handles nested objects", () => {
    const a = canonicalize({ outer: { z: 1, a: 2 } });
    const b = canonicalize({ outer: { a: 2, z: 1 } });
    assert.equal(a, b);
  });

  test("Integrity: canonicalize handles arrays", () => {
    const a = canonicalize([1, "two", { three: 3 }]);
    const b = canonicalize([1, "two", { three: 3 }]);
    assert.equal(a, b);
  });

  test("Integrity: canonicalize handles null", () => {
    assert.equal(canonicalize(null), "null");
  });

  test("Integrity: canonicalize handles booleans", () => {
    assert.equal(canonicalize(true), "true");
    assert.equal(canonicalize(false), "false");
  });

  test("Integrity: sign and verify", () => {
    const doc = minimalWebApp();
    const signed = signDocument(doc);
    assert.ok(verifyDocument(signed));
    assert.equal(signed.hash.length, 64);
    assert.ok(signed.timestamp > 0);
  });

  test("Integrity: tampered document fails verification", () => {
    const doc = minimalWebApp();
    const signed = signDocument(doc);
    signed.document.name = "TamperedApp";
    assert.ok(!verifyDocument(signed));
  });

  await test("Orchestrator: dispatches to matching emitters", async () => {
    const doc = minimalWebApp();
    const validated = validateUIR(doc);
    assert.ok(validated.valid && validated.document);

    const mockWebEmitter: Emitter = {
      target: "web",
      supports: () => true,
      emit: async (d) => ({
        target: "web",
        files: [{ path: "index.html", content: `<h1>${d.name}</h1>` }],
        diagnostics: [],
        hash: hashUIR(d),
      }),
    };

    const mockNativeEmitter: Emitter = {
      target: "native",
      supports: () => true,
      emit: async (d) => ({
        target: "native",
        files: [{ path: "main.h", content: `// ${d.name}` }],
        diagnostics: [],
        hash: hashUIR(d),
      }),
    };

    const result = await orchestrate(validated.document, [mockWebEmitter, mockNativeEmitter]);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].target, "web");
    assert.ok(result.success);
    assert.equal(result.sourceHash.length, 64);
  });

  await test("Orchestrator: dispatches to multiple targets", async () => {
    const doc = genomeCreature();
    const validated = validateUIR(doc);
    assert.ok(validated.valid && validated.document);

    const emitters: Emitter[] = ["web", "native", "asset"].map((t) => ({
      target: t as any,
      supports: () => true,
      emit: async (d: UIRDocument) => ({
        target: t as any,
        files: [{ path: `output.${t}`, content: d.name }],
        diagnostics: [],
        hash: hashUIR(d),
      }),
    }));

    const result = await orchestrate(validated.document, emitters);
    assert.equal(result.results.length, 3);
    assert.ok(result.success);
  });

  await test("Orchestrator: skips unsupported emitters", async () => {
    const doc = minimalWebApp();
    const validated = validateUIR(doc);
    assert.ok(validated.valid && validated.document);

    const unsupported: Emitter = {
      target: "web",
      supports: () => false,
      emit: async () => { throw new Error("Should not be called"); },
    };

    const result = await orchestrate(validated.document, [unsupported]);
    assert.equal(result.results.length, 0);
  });

  await test("Orchestrator: reports failure on error diagnostics", async () => {
    const doc = minimalWebApp();
    const validated = validateUIR(doc);
    assert.ok(validated.valid && validated.document);

    const failing: Emitter = {
      target: "web",
      supports: () => true,
      emit: async (d) => ({
        target: "web",
        files: [],
        diagnostics: [{ severity: "error", message: "Generation failed" }],
        hash: hashUIR(d),
      }),
    };

    const result = await orchestrate(validated.document, [failing]);
    assert.ok(!result.success);
  });

  test("Schema: all entity kinds are valid", () => {
    const kinds = ["data", "spatial", "actor", "component", "system"] as const;
    for (const kind of kinds) {
      const doc = minimalWebApp();
      doc.entities[0].kind = kind;
      const result = UIRDocumentSchema.safeParse(doc);
      assert.ok(result.success, `Kind "${kind}" should be valid`);
    }
  });

  test("Schema: all field types are valid", () => {
    const types = ["string", "int", "float", "bool", "datetime", "bytes", "json", "uuid"] as const;
    for (const type of types) {
      const doc = minimalWebApp();
      doc.entities[0].fields[0].type = type;
      const result = UIRDocumentSchema.safeParse(doc);
      assert.ok(result.success, `Type "${type}" should be valid`);
    }
  });

  test("Schema: all emit targets are valid", () => {
    const targets = ["web", "native", "asset", "mobile", "api"] as const;
    for (const target of targets) {
      const doc = minimalWebApp();
      doc.targets = [target];
      doc.endpoints = [];
      const result = UIRDocumentSchema.safeParse(doc);
      assert.ok(result.success, `Target "${target}" should be valid`);
    }
  });

  test("Schema: all spatial constraint types are valid", () => {
    const types = ["gravity", "collision", "clearance", "support", "containment", "alignment", "attachment", "reachability"] as const;
    for (const type of types) {
      const doc = spatialScene();
      doc.entities[0].spatialConstraints = [{ type, params: {} }];
      const result = UIRDocumentSchema.safeParse(doc);
      assert.ok(result.success, `Constraint type "${type}" should be valid`);
    }
  });

  test("Schema: all bounding volume types are valid", () => {
    const types = ["box", "sphere", "capsule", "mesh"] as const;
    for (const type of types) {
      const doc = spatialScene();
      doc.entities[0].boundingVolume = { type, dimensions: { x: 1, y: 1, z: 1 }, offset: { x: 0, y: 0, z: 0 } };
      const result = UIRDocumentSchema.safeParse(doc);
      assert.ok(result.success, `Bounding volume type "${type}" should be valid`);
    }
  });

  test("Schema: all genome transform types are valid", () => {
    const types = ["linear", "exponential", "step", "modulo", "lookup"] as const;
    for (const type of types) {
      const doc = genomeCreature();
      const mapping = { byteOffset: 0, byteLength: 1, target: "test", transform: type };
      if (type === "lookup") (mapping as any).lookupTable = ["a", "b"];
      doc.entities[0].genome!.mappings = [mapping];
      const result = UIRDocumentSchema.safeParse(doc);
      assert.ok(result.success, `Transform type "${type}" should be valid`);
    }
  });

  test("Schema: material constraints", () => {
    const doc = spatialScene();
    doc.entities[1].material = { metalness: 1.5 };
    const result = UIRDocumentSchema.safeParse(doc);
    assert.ok(!result.success);
  });

  test("Schema: array and map fields", () => {
    const doc = minimalWebApp();
    doc.entities[0].fields.push(
      { name: "tags", type: "string", isOptional: false, isArray: true, isMap: false, constraints: [] },
      { name: "metadata", type: "string", isOptional: false, isArray: false, isMap: true, mapKeyType: "string", constraints: [] },
    );
    const result = UIRDocumentSchema.safeParse(doc);
    assert.ok(result.success);
  });

  test("End-to-end: web app → validate → sign → verify", () => {
    const raw = minimalWebApp();
    const validated = validateUIR(raw);
    assert.ok(validated.valid && validated.document);
    const signed = signDocument(validated.document);
    assert.ok(verifyDocument(signed));
    assert.equal(signed.hash, hashUIR(validated.document));
  });

  test("End-to-end: genome creature → validate → hash parity", () => {
    const raw = genomeCreature();
    const validated = validateUIR(raw);
    assert.ok(validated.valid && validated.document);
    const hash1 = hashUIR(validated.document);
    const hash2 = hashUIR(validated.document);
    assert.equal(hash1, hash2);
  });

  test("End-to-end: spatial scene → validate → all constraints resolved", () => {
    const raw = spatialScene();
    const validated = validateUIR(raw);
    assert.ok(validated.valid, `Errors: ${JSON.stringify(validated.errors)}`);
    assert.equal(validated.errors.length, 0);
    const spatialEntities = validated.document!.entities.filter((e) => e.kind === "spatial");
    assert.equal(spatialEntities.length, 4);
    const totalConstraints = spatialEntities.reduce((sum, e) => sum + e.spatialConstraints.length, 0);
    assert.ok(totalConstraints > 5);
  });

  // ============================================================
  // Web Emitter Tests
  // ============================================================

  const webEmitter = new WebEmitter();

  test("WebEmitter: supports docs with 'web' target", () => {
    const doc = minimalWebApp();
    assert.ok(webEmitter.supports(doc));
  });

  test("WebEmitter: does not support docs without 'web' target", () => {
    const doc = genomeCreature();
    doc.targets = ["native"] as any;
    assert.ok(!webEmitter.supports(doc));
  });

  await test("WebEmitter: generates TypeScript interfaces for all data entities", async () => {
    const doc = minimalWebApp();
    const result = await webEmitter.emit(doc);
    const typeFiles = result.files.filter((f) => f.path.startsWith("src/types/"));
    assert.equal(typeFiles.length, 2);
    const taskType = typeFiles.find((f) => f.path.includes("Task"));
    assert.ok(taskType);
    assert.ok(taskType.content.includes("export interface Task"));
    assert.ok(taskType.content.includes("id: string;"));
    assert.ok(taskType.content.includes("title: string;"));
    assert.ok(taskType.content.includes("completed: boolean;"));
    assert.ok(taskType.content.includes("createdAt: Date;"));
  });

  await test("WebEmitter: generates Drizzle schemas with correct column types", async () => {
    const doc = minimalWebApp();
    const result = await webEmitter.emit(doc);
    const schemaFiles = result.files.filter((f) => f.path.startsWith("src/db/schema/"));
    assert.equal(schemaFiles.length, 2);
    const taskSchema = schemaFiles.find((f) => f.path.includes("Task"));
    assert.ok(taskSchema);
    assert.ok(taskSchema.content.includes("pgTable"));
    assert.ok(taskSchema.content.includes('uuid("id")'));
    assert.ok(taskSchema.content.includes(".primaryKey()"));
    assert.ok(taskSchema.content.includes('boolean("completed")'));
  });

  await test("WebEmitter: generates Express routes for entities with endpoints", async () => {
    const doc = minimalWebApp();
    const result = await webEmitter.emit(doc);
    const routeFiles = result.files.filter((f) => f.path.startsWith("src/routes/"));
    assert.ok(routeFiles.length > 0);
    const taskRoutes = routeFiles.find((f) => f.path.includes("task"));
    assert.ok(taskRoutes);
    assert.ok(taskRoutes.content.includes("Router()"));
    assert.ok(taskRoutes.content.includes(".get("));
    assert.ok(taskRoutes.content.includes(".post("));
    assert.ok(taskRoutes.content.includes(".delete("));
  });

  await test("WebEmitter: generates Zod schemas with constraints", async () => {
    const doc = minimalWebApp();
    const result = await webEmitter.emit(doc);
    const zodFiles = result.files.filter((f) => f.path.startsWith("src/schemas/"));
    assert.equal(zodFiles.length, 2);
    const taskZod = zodFiles.find((f) => f.path.includes("Task"));
    assert.ok(taskZod);
    assert.ok(taskZod.content.includes("z.object("));
    assert.ok(taskZod.content.includes("z.string().uuid()"));
    assert.ok(taskZod.content.includes("z.boolean()"));
    assert.ok(taskZod.content.includes(".min(1)"));
    assert.ok(taskZod.content.includes(".max(255)"));
  });

  await test("WebEmitter: generates server.ts with route imports and middleware", async () => {
    const doc = minimalWebApp();
    const result = await webEmitter.emit(doc);
    const serverFile = result.files.find((f) => f.path === "src/server.ts");
    assert.ok(serverFile);
    assert.ok(serverFile.content.includes("import express"));
    assert.ok(serverFile.content.includes("import helmet"));
    assert.ok(serverFile.content.includes("import cors"));
    assert.ok(serverFile.content.includes('app.use(helmet())'));
    assert.ok(serverFile.content.includes('app.use(cors())'));
    assert.ok(serverFile.content.includes("/health"));
  });

  await test("WebEmitter: includes hash from source UIR", async () => {
    const doc = minimalWebApp();
    const result = await webEmitter.emit(doc);
    assert.equal(result.hash, hashUIR(doc));
    assert.equal(result.target, "web");
  });

  await test("WebEmitter: handles optional fields", async () => {
    const doc: UIRDocument = {
      version: "1.0.0",
      name: "OptionalTest",
      targets: ["web"],
      entities: [{
        name: "Profile",
        kind: "data",
        fields: [
          { name: "id", type: "uuid", isOptional: false, isArray: false, isMap: false, constraints: [] },
          { name: "bio", type: "string", isOptional: true, isArray: false, isMap: false, constraints: [] },
          { name: "age", type: "int", isOptional: true, isArray: false, isMap: false, constraints: [] },
        ],
        spatialConstraints: [],
        tags: [],
      }],
      relations: [],
      endpoints: [],
      businessRules: [],
      metadata: {},
    };
    const result = await webEmitter.emit(doc);
    const typeFile = result.files.find((f) => f.path.includes("Profile.ts") && f.path.startsWith("src/types/"));
    assert.ok(typeFile);
    assert.ok(typeFile.content.includes("bio?: string;"));
    assert.ok(typeFile.content.includes("age?: number;"));
  });

  await test("WebEmitter: handles array and map fields", async () => {
    const doc: UIRDocument = {
      version: "1.0.0",
      name: "CollectionTest",
      targets: ["web"],
      entities: [{
        name: "Inventory",
        kind: "data",
        fields: [
          { name: "id", type: "uuid", isOptional: false, isArray: false, isMap: false, constraints: [] },
          { name: "tags", type: "string", isOptional: false, isArray: true, isMap: false, constraints: [] },
          { name: "metadata", type: "json", isOptional: false, isArray: false, isMap: true, constraints: [] },
        ],
        spatialConstraints: [],
        tags: [],
      }],
      relations: [],
      endpoints: [],
      businessRules: [],
      metadata: {},
    };
    const result = await webEmitter.emit(doc);
    const typeFile = result.files.find((f) => f.path.includes("Inventory.ts") && f.path.startsWith("src/types/"));
    assert.ok(typeFile);
    assert.ok(typeFile.content.includes("tags: string[];"));
    assert.ok(typeFile.content.includes("Record<string, Record<string, unknown>>"));
  });

  await test("WebEmitter: generates auth middleware in routes", async () => {
    const doc = minimalWebApp();
    const result = await webEmitter.emit(doc);
    const routeFile = result.files.find((f) => f.path.startsWith("src/routes/"));
    assert.ok(routeFile);
    assert.ok(routeFile.content.includes("req.user"));
    assert.ok(routeFile.content.includes("401"));
  });

  await test("WebEmitter: warns on entities with no fields", async () => {
    const doc: UIRDocument = {
      version: "1.0.0",
      name: "EmptyTest",
      targets: ["web"],
      entities: [{
        name: "Ghost",
        kind: "system",
        fields: [],
        spatialConstraints: [],
        tags: [],
      }],
      relations: [],
      endpoints: [],
      businessRules: [],
      metadata: {},
    };
    const result = await webEmitter.emit(doc);
    assert.ok(result.diagnostics.some((d) => d.severity === "warning"));
  });

  await test("WebEmitter: handles foreign key relations in Drizzle schema", async () => {
    const doc = minimalWebApp();
    const result = await webEmitter.emit(doc);
    const taskSchema = result.files.find((f) => f.path === "src/db/schema/Task.ts");
    assert.ok(taskSchema);
    assert.ok(taskSchema.content.includes("userId"));
  });

  // ============================================================
  // Native Emitter Tests
  // ============================================================

  const nativeEmitter = new NativeEmitter();

  test("NativeEmitter: supports docs with 'native' target", () => {
    const doc = genomeCreature();
    assert.ok(nativeEmitter.supports(doc));
  });

  test("NativeEmitter: does not support docs without 'native' target", () => {
    const doc = minimalWebApp();
    assert.ok(!nativeEmitter.supports(doc));
  });

  await test("NativeEmitter: generates USTRUCT header with UPROPERTY macros", async () => {
    const doc = genomeCreature();
    const result = await nativeEmitter.emit(doc);
    const headers = result.files.filter((f) => f.path.endsWith(".h"));
    assert.ok(headers.length > 0);
    const creatureHeader = headers.find((f) => f.path.includes("Creature.h"));
    assert.ok(creatureHeader);
    assert.ok(creatureHeader.content.includes("#pragma once"));
    assert.ok(creatureHeader.content.includes("USTRUCT(BlueprintType)"));
    assert.ok(creatureHeader.content.includes("struct FCreature"));
    assert.ok(creatureHeader.content.includes("GENERATED_BODY()"));
    assert.ok(creatureHeader.content.includes("UPROPERTY(EditAnywhere, BlueprintReadWrite"));
  });

  await test("NativeEmitter: maps UIR field types to correct C++ types", async () => {
    const doc = genomeCreature();
    const result = await nativeEmitter.emit(doc);
    const header = result.files.find((f) => f.path.includes("Creature.h"));
    assert.ok(header);
    assert.ok(header.content.includes("FString Id;"));
    assert.ok(header.content.includes("FString Name;"));
    assert.ok(header.content.includes("int32 Health;"));
    assert.ok(header.content.includes("int32 Attack;"));
    assert.ok(header.content.includes("double Speed;"));
  });

  await test("NativeEmitter: generates genome seed and derived properties", async () => {
    const doc = genomeCreature();
    const result = await nativeEmitter.emit(doc);
    const header = result.files.find((f) => f.path.includes("Creature.h"));
    assert.ok(header);
    assert.ok(header.content.includes("TArray<uint8> GenomeSeed;"));
    assert.ok(header.content.includes("Sovereign|Genome"));
    assert.ok(header.content.includes("Sovereign|Derived"));
  });

  await test("NativeEmitter: generates transform properties for spatial entities", async () => {
    const doc = genomeCreature();
    const result = await nativeEmitter.emit(doc);
    const header = result.files.find((f) => f.path.includes("Creature.h"));
    assert.ok(header);
    assert.ok(header.content.includes("FVector Position"));
    assert.ok(header.content.includes("FRotator Rotation"));
    assert.ok(header.content.includes("FVector Scale"));
  });

  await test("NativeEmitter: generates serializer with ToSovereignJson", async () => {
    const doc = genomeCreature();
    const result = await nativeEmitter.emit(doc);
    const serializers = result.files.filter((f) => f.path.includes("Serializer.cpp"));
    assert.ok(serializers.length > 0);
    const creatureSerializer = serializers.find((f) => f.path.includes("Creature"));
    assert.ok(creatureSerializer);
    assert.ok(creatureSerializer.content.includes("ToSovereignJson"));
    assert.ok(creatureSerializer.content.includes("namespace Sovereign"));
    assert.ok(creatureSerializer.content.includes('obj["id"]'));
    assert.ok(creatureSerializer.content.includes('obj["name"]'));
    assert.ok(creatureSerializer.content.includes('obj["health"]'));
  });

  await test("NativeEmitter: generates genome deriver with byte extraction", async () => {
    const doc = genomeCreature();
    const result = await nativeEmitter.emit(doc);
    const derivers = result.files.filter((f) => f.path.includes("GenomeDeriver.cpp"));
    assert.ok(derivers.length > 0);
    const deriver = derivers[0];
    assert.ok(deriver.content.includes("DeriveFromGenome"));
    assert.ok(deriver.content.includes("GenomeSeed.Num()"));
    assert.ok(deriver.content.includes("GetData()"));
    assert.ok(deriver.content.includes("Seed[0]"));
    assert.ok(deriver.content.includes("LookupTable"));
    assert.ok(deriver.content.includes('"claws"'));
    assert.ok(deriver.content.includes('"tentacles"'));
  });

  await test("NativeEmitter: generates constraint validation checks", async () => {
    const doc = genomeCreature();
    const result = await nativeEmitter.emit(doc);
    const header = result.files.find((f) => f.path.includes("Creature.h"));
    assert.ok(header);
    assert.ok(header.content.includes("ValidateCreature"));
    assert.ok(header.content.includes("health must be >= 0"));
    assert.ok(header.content.includes("health must be <= 1000"));
    assert.ok(header.content.includes("speed must be >= 0"));
    assert.ok(header.content.includes("speed must be <= 100"));
  });

  await test("NativeEmitter: includes hash from source UIR", async () => {
    const doc = genomeCreature();
    const result = await nativeEmitter.emit(doc);
    assert.equal(result.hash, hashUIR(doc));
    assert.equal(result.target, "native");
  });

  await test("NativeEmitter: handles optional fields with TOptional wrapper", async () => {
    const doc: UIRDocument = {
      version: "1.0.0",
      name: "OptionalNativeTest",
      targets: ["native"],
      entities: [{
        name: "Config",
        kind: "data",
        fields: [
          { name: "id", type: "uuid", isOptional: false, isArray: false, isMap: false, constraints: [] },
          { name: "label", type: "string", isOptional: true, isArray: false, isMap: false, constraints: [] },
          { name: "count", type: "int", isOptional: true, isArray: false, isMap: false, constraints: [] },
        ],
        spatialConstraints: [],
        tags: [],
      }],
      relations: [],
      endpoints: [],
      businessRules: [],
      metadata: {},
    };
    const result = await nativeEmitter.emit(doc);
    const header = result.files.find((f) => f.path.includes("Config.h"));
    assert.ok(header);
    assert.ok(header.content.includes("TOptional<FString> Label;"));
    assert.ok(header.content.includes("TOptional<int32> Count;"));
  });

  await test("NativeEmitter: handles array fields with TArray wrapper", async () => {
    const doc: UIRDocument = {
      version: "1.0.0",
      name: "ArrayNativeTest",
      targets: ["native"],
      entities: [{
        name: "Container",
        kind: "data",
        fields: [
          { name: "id", type: "uuid", isOptional: false, isArray: false, isMap: false, constraints: [] },
          { name: "items", type: "string", isOptional: false, isArray: true, isMap: false, constraints: [] },
          { name: "scores", type: "float", isOptional: false, isArray: true, isMap: false, constraints: [] },
        ],
        spatialConstraints: [],
        tags: [],
      }],
      relations: [],
      endpoints: [],
      businessRules: [],
      metadata: {},
    };
    const result = await nativeEmitter.emit(doc);
    const header = result.files.find((f) => f.path.includes("Container.h"));
    assert.ok(header);
    assert.ok(header.content.includes("TArray<FString> Items;"));
    assert.ok(header.content.includes("TArray<double> Scores;"));
  });

  await test("NativeEmitter: warns on entity with no fields/genome/transform", async () => {
    const doc: UIRDocument = {
      version: "1.0.0",
      name: "EmptyNativeTest",
      targets: ["native"],
      entities: [{
        name: "EmptyActor",
        kind: "actor",
        fields: [],
        spatialConstraints: [],
        tags: [],
      }],
      relations: [],
      endpoints: [],
      businessRules: [],
      metadata: {},
    };
    const result = await nativeEmitter.emit(doc);
    assert.ok(result.diagnostics.some((d) => d.severity === "warning" && d.message.includes("EmptyActor")));
  });

  // ============================================================
  // Cross-Emitter / Bridge Proof Tests
  // ============================================================

  await test("Bridge proof: same UIR → web + native with matching source hash", async () => {
    const doc = genomeCreature();
    const webResult = await webEmitter.emit(doc);
    const nativeResult = await nativeEmitter.emit(doc);
    assert.equal(webResult.hash, nativeResult.hash);
    assert.equal(webResult.hash, hashUIR(doc));
  });

  await test("Bridge proof: orchestrator dispatches to both emitters in parallel", async () => {
    const doc = genomeCreature();
    const result = await orchestrate(doc, [webEmitter, nativeEmitter]);
    assert.ok(result.success);
    assert.equal(result.results.length, 2);
    const targets = result.results.map((r) => r.target).sort();
    assert.deepEqual(targets, ["native", "web"]);
    assert.ok(result.results.every((r) => r.hash === result.sourceHash));
  });

  await test("Bridge proof: web emitter generates TypeScript, native emitter generates C++ for same entity", async () => {
    const doc = genomeCreature();
    const webResult = await webEmitter.emit(doc);
    const nativeResult = await nativeEmitter.emit(doc);

    const tsInterface = webResult.files.find((f) => f.path.includes("Creature.ts") && f.path.startsWith("src/types/"));
    const cppHeader = nativeResult.files.find((f) => f.path.includes("Creature.h"));

    assert.ok(tsInterface);
    assert.ok(cppHeader);

    assert.ok(tsInterface.content.includes("health: number;"));
    assert.ok(cppHeader.content.includes("int32 Health;"));

    assert.ok(tsInterface.content.includes("name: string;"));
    assert.ok(cppHeader.content.includes("FString Name;"));

    assert.ok(tsInterface.content.includes("speed: number;"));
    assert.ok(cppHeader.content.includes("double Speed;"));
  });

  await test("Bridge proof: modified UIR changes hash, both emitters reflect it", async () => {
    const doc1 = genomeCreature();
    const doc2 = genomeCreature();
    doc2.entities[0].fields.push({
      name: "defense",
      type: "int",
      isOptional: false,
      isArray: false,
      isMap: false,
      constraints: [{ type: "min", value: 0 }],
    });

    const webResult1 = await webEmitter.emit(doc1);
    const webResult2 = await webEmitter.emit(doc2);
    const nativeResult2 = await nativeEmitter.emit(doc2);

    assert.notEqual(webResult1.hash, webResult2.hash);
    assert.equal(webResult2.hash, nativeResult2.hash);

    const tsFile = webResult2.files.find((f) => f.path.includes("Creature.ts") && f.path.startsWith("src/types/"));
    assert.ok(tsFile!.content.includes("defense: number;"));

    const cppFile = nativeResult2.files.find((f) => f.path.includes("Creature.h"));
    assert.ok(cppFile!.content.includes("int32 Defense;"));
  });

  await test("Bridge proof: genome deriver handles all transform types", async () => {
    const doc = genomeCreature();
    const result = await nativeEmitter.emit(doc);
    const deriver = result.files.find((f) => f.path.includes("GenomeDeriver.cpp"));
    assert.ok(deriver);
    assert.ok(deriver.content.includes("(linear)"));
    assert.ok(deriver.content.includes("(lookup)"));
    assert.ok(deriver.content.includes("(step)"));
    assert.ok(deriver.content.includes("(exponential)"));
  });

  await test("Bridge proof: total file count from full orchestration", async () => {
    const doc = genomeCreature();
    const result = await orchestrate(doc, [webEmitter, nativeEmitter]);
    const totalFiles = result.results.reduce((sum, r) => sum + r.files.length, 0);
    assert.ok(totalFiles >= 6, `Expected at least 6 files, got ${totalFiles}`);
  });

  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
