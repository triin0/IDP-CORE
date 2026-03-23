import { strict as assert } from "assert";
import {
  validateUIR,
  hashUIR,
  canonicalize,
  signDocument,
  verifyDocument,
  orchestrate,
  UIRDocumentSchema,
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

  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
