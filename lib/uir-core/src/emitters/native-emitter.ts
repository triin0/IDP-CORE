import type { UIRDocument, UIREntity, UIRField } from "../schema.js";
import type { Emitter, EmitResult, EmittedFile, EmitDiagnostic } from "../emitter.js";
import { hashUIR } from "../integrity.js";

const UIR_TO_CPP: Record<string, { cppType: string; ueType: string }> = {
  string: { cppType: "FString", ueType: "FString" },
  int: { cppType: "int32", ueType: "int32" },
  float: { cppType: "double", ueType: "double" },
  bool: { cppType: "bool", ueType: "bool" },
  datetime: { cppType: "FDateTime", ueType: "FDateTime" },
  bytes: { cppType: "TArray<uint8>", ueType: "TArray<uint8>" },
  json: { cppType: "FString", ueType: "FString" },
  uuid: { cppType: "FString", ueType: "FString" },
};

function toPascalCase(s: string): string {
  return s.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
}

function mapFieldType(field: UIRField): string {
  const base = UIR_TO_CPP[field.type]?.cppType ?? `F${toPascalCase(field.type)}`;
  let result = base;
  if (field.isArray) result = `TArray<${result}>`;
  if (field.isMap) {
    const keyType = UIR_TO_CPP[field.mapKeyType ?? "string"]?.cppType ?? "FString";
    result = `TMap<${keyType}, ${base}>`;
  }
  if (field.isOptional) result = `TOptional<${result}>`;
  return result;
}

function generateConstraintChecks(field: UIRField, cppFieldName: string): string[] {
  const checks: string[] = [];
  const accessor = field.isOptional ? `Value.${cppFieldName}.GetValue()` : `Value.${cppFieldName}`;
  const guard = field.isOptional ? `Value.${cppFieldName}.IsSet() && ` : "";

  for (const c of field.constraints) {
    switch (c.type) {
      case "min":
        checks.push(`if (${guard}${accessor} < ${c.value}) { OutError = TEXT("${field.name} must be >= ${c.value}"); return false; }`);
        break;
      case "max":
        checks.push(`if (${guard}${accessor} > ${c.value}) { OutError = TEXT("${field.name} must be <= ${c.value}"); return false; }`);
        break;
      case "minLength":
        checks.push(`if (${guard}${accessor}.Len() < ${c.value}) { OutError = TEXT("${field.name} below min length ${c.value}"); return false; }`);
        break;
      case "maxLength":
        checks.push(`if (${guard}${accessor}.Len() > ${c.value}) { OutError = TEXT("${field.name} exceeds max length ${c.value}"); return false; }`);
        break;
    }
  }

  return checks;
}

function generateHeader(entity: UIREntity): string {
  const structName = `F${entity.name}`;
  const lines: string[] = [];

  lines.push(`#pragma once`);
  lines.push(``);
  lines.push(`#include "CoreMinimal.h"`);
  lines.push(`#include <string>`);
  lines.push(`#include <map>`);
  lines.push(`#include <vector>`);
  lines.push(``);

  if (entity.genome) {
    lines.push(`#include "SovereignSerializer.h"`);
    lines.push(``);
  }

  lines.push(`USTRUCT(BlueprintType)`);
  lines.push(`struct ${structName}`);
  lines.push(`{`);
  lines.push(`\tGENERATED_BODY()`);
  lines.push(``);

  for (const field of entity.fields) {
    const cppFieldName = toPascalCase(field.name);
    const cppType = mapFieldType(field);
    lines.push(`\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sovereign")`);
    lines.push(`\t${cppType} ${cppFieldName};`);
    lines.push(``);
  }

  if (entity.genome) {
    lines.push(`\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sovereign|Genome")`);
    lines.push(`\tTArray<uint8> GenomeSeed;`);
    lines.push(``);

    for (const mapping of entity.genome.mappings) {
      const propName = toPascalCase(mapping.target.replace(/\./g, "_"));
      lines.push(`\tUPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Sovereign|Derived")`);
      if (mapping.transform === "lookup") {
        lines.push(`\tFString ${propName};`);
      } else {
        lines.push(`\tdouble ${propName};`);
      }
      lines.push(``);
    }
  }

  if (entity.transform) {
    lines.push(`\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sovereign|Transform")`);
    lines.push(`\tFVector Position = FVector(${entity.transform.position.x}, ${entity.transform.position.y}, ${entity.transform.position.z});`);
    lines.push(``);
    lines.push(`\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sovereign|Transform")`);
    lines.push(`\tFRotator Rotation = FRotator(${entity.transform.rotation.x}, ${entity.transform.rotation.y}, ${entity.transform.rotation.z});`);
    lines.push(``);
    lines.push(`\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sovereign|Transform")`);
    lines.push(`\tFVector Scale = FVector(${entity.transform.scale.x}, ${entity.transform.scale.y}, ${entity.transform.scale.z});`);
    lines.push(``);
  }

  lines.push(`};`);
  lines.push(``);

  const validationChecks: string[] = [];
  for (const field of entity.fields) {
    const cppFieldName = toPascalCase(field.name);
    validationChecks.push(...generateConstraintChecks(field, cppFieldName));
  }

  if (validationChecks.length > 0) {
    lines.push(`static bool Validate${entity.name}(const ${structName}& Value, FString& OutError)`);
    lines.push(`{`);
    for (const check of validationChecks) {
      lines.push(`\t${check}`);
    }
    lines.push(`\treturn true;`);
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

function generateSerializer(entity: UIREntity): string {
  const structName = `F${entity.name}`;
  const lines: string[] = [];

  lines.push(`#include "${entity.name}.h"`);
  lines.push(``);
  lines.push(`namespace Sovereign {`);
  lines.push(``);
  lines.push(`static JsonValue ToSovereignJson(const ${structName}& Value)`);
  lines.push(`{`);
  lines.push(`\tstd::map<std::string, JsonValue> obj;`);

  for (const field of entity.fields) {
    const cppFieldName = toPascalCase(field.name);
    const snakeName = field.name;
    const cppType = UIR_TO_CPP[field.type]?.cppType ?? "FString";

    if (field.isOptional) {
      lines.push(`\tif (Value.${cppFieldName}.IsSet())`);
      lines.push(`\t{`);
      lines.push(`\t\t${serializeLine(snakeName, cppFieldName, cppType, false)}`);
      lines.push(`\t}`);
      lines.push(`\telse`);
      lines.push(`\t{`);
      lines.push(`\t\tobj["${snakeName}"] = JsonValue::null();`);
      lines.push(`\t}`);
    } else {
      lines.push(`\t${serializeLine(snakeName, cppFieldName, cppType, false)}`);
    }
  }

  lines.push(`\treturn JsonValue::object(obj);`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`} // namespace Sovereign`);

  return lines.join("\n");
}

function serializeLine(jsonKey: string, cppField: string, cppType: string, isOptionalGet: boolean): string {
  const accessor = isOptionalGet ? `Value.${cppField}.GetValue()` : `Value.${cppField}`;
  switch (cppType) {
    case "FString":
      return `obj["${jsonKey}"] = JsonValue(std::string(TCHAR_TO_UTF8(*${accessor})));`;
    case "int32":
      return `obj["${jsonKey}"] = JsonValue(static_cast<int>(${accessor}));`;
    case "double":
      return `obj["${jsonKey}"] = JsonValue(${accessor});`;
    case "bool":
      return `obj["${jsonKey}"] = JsonValue(${accessor});`;
    default:
      return `// TODO: Nested struct serialization for ${cppField}`;
  }
}

function generateGenomeDeriver(entity: UIREntity): string | null {
  if (!entity.genome || entity.genome.mappings.length === 0) return null;

  const structName = `F${entity.name}`;
  const lines: string[] = [];

  lines.push(`#include "${entity.name}.h"`);
  lines.push(``);
  lines.push(`static void DeriveFromGenome(${structName}& Entity)`);
  lines.push(`{`);
  lines.push(`\tif (Entity.GenomeSeed.Num() < ${entity.genome.byteLength}) return;`);
  lines.push(`\tconst uint8* Seed = Entity.GenomeSeed.GetData();`);
  lines.push(``);

  for (const mapping of entity.genome.mappings) {
    const propName = toPascalCase(mapping.target.replace(/\./g, "_"));

    if (mapping.transform === "lookup" && mapping.lookupTable) {
      lines.push(`\t// ${mapping.target} [bytes ${mapping.byteOffset}-${mapping.byteOffset + mapping.byteLength - 1}] (lookup)`);
      lines.push(`\t{`);
      lines.push(`\t\tuint32 Idx = 0;`);
      for (let i = 0; i < mapping.byteLength; i++) {
        lines.push(`\t\tIdx = (Idx << 8) | Seed[${mapping.byteOffset + i}];`);
      }
      lines.push(`\t\tstatic const FString LookupTable[] = {`);
      for (const entry of mapping.lookupTable) {
        lines.push(`\t\t\tTEXT("${entry}"),`);
      }
      lines.push(`\t\t};`);
      lines.push(`\t\tEntity.${propName} = LookupTable[Idx % ${mapping.lookupTable.length}];`);
      lines.push(`\t}`);
    } else {
      const [rangeMin, rangeMax] = mapping.range ?? [0, 255];
      lines.push(`\t// ${mapping.target} [bytes ${mapping.byteOffset}-${mapping.byteOffset + mapping.byteLength - 1}] (${mapping.transform})`);
      lines.push(`\t{`);
      lines.push(`\t\tuint64 Raw = 0;`);
      for (let i = 0; i < mapping.byteLength; i++) {
        lines.push(`\t\tRaw = (Raw << 8) | Seed[${mapping.byteOffset + i}];`);
      }
      const maxVal = Math.pow(256, mapping.byteLength) - 1;

      if (mapping.transform === "exponential") {
        lines.push(`\t\tdouble Normalized = static_cast<double>(Raw) / ${maxVal}.0;`);
        lines.push(`\t\tEntity.${propName} = ${rangeMin} + (${rangeMax} - ${rangeMin}) * (Normalized * Normalized);`);
      } else if (mapping.transform === "step") {
        const steps = Math.round(rangeMax - rangeMin) + 1;
        lines.push(`\t\tEntity.${propName} = ${rangeMin} + static_cast<int>(Raw % ${steps});`);
      } else if (mapping.transform === "modulo") {
        lines.push(`\t\tEntity.${propName} = static_cast<double>(Raw % ${Math.round(rangeMax + 1)});`);
      } else {
        lines.push(`\t\tdouble Normalized = static_cast<double>(Raw) / ${maxVal}.0;`);
        lines.push(`\t\tEntity.${propName} = ${rangeMin} + (${rangeMax} - ${rangeMin}) * Normalized;`);
      }
      lines.push(`\t}`);
    }
    lines.push(``);
  }

  lines.push(`}`);
  return lines.join("\n");
}

export class NativeEmitter implements Emitter {
  readonly target = "native" as const;

  supports(doc: UIRDocument): boolean {
    return doc.targets.includes("native");
  }

  async emit(doc: UIRDocument): Promise<EmitResult> {
    const files: EmittedFile[] = [];
    const diagnostics: EmitDiagnostic[] = [];

    for (const entity of doc.entities) {
      files.push({
        path: `Source/Sovereign/Public/${entity.name}.h`,
        content: generateHeader(entity),
      });

      files.push({
        path: `Source/Sovereign/Private/${entity.name}Serializer.cpp`,
        content: generateSerializer(entity),
      });

      if (entity.genome) {
        const deriver = generateGenomeDeriver(entity);
        if (deriver) {
          files.push({
            path: `Source/Sovereign/Private/${entity.name}GenomeDeriver.cpp`,
            content: deriver,
          });
        }
      }

      if (entity.fields.length === 0 && !entity.genome && !entity.transform) {
        diagnostics.push({
          severity: "warning",
          message: `Entity "${entity.name}" has no fields, genome, or transform — empty USTRUCT generated`,
          entity: entity.name,
        });
      }
    }

    return {
      target: "native",
      files,
      diagnostics,
      hash: hashUIR(doc),
    };
  }
}
