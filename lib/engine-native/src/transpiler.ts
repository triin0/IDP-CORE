interface PydanticField {
  name: string;
  pythonType: string;
  isOptional: boolean;
  default?: string;
  constraints: FieldConstraint[];
}

interface FieldConstraint {
  type: "ge" | "le" | "gt" | "lt" | "max_length" | "min_length" | "regex" | "custom";
  value: string | number;
  message?: string;
}

interface PydanticModel {
  name: string;
  fields: PydanticField[];
  validators: ValidatorDef[];
  isResponse: boolean;
}

interface ValidatorDef {
  fieldName: string;
  validatorBody: string;
}

interface TranspilerResult {
  headers: Array<{ path: string; content: string }>;
  sources: Array<{ path: string; content: string }>;
  fixes: string[];
  diagnostics: TranspilerDiagnostic[];
}

interface TranspilerDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  model?: string;
  field?: string;
}

const TYPE_MAP: Record<string, { cppType: string; ueType: string; includeHeader?: string }> = {
  "str": { cppType: "FString", ueType: "FString" },
  "int": { cppType: "int32", ueType: "int32" },
  "float": { cppType: "double", ueType: "double" },
  "bool": { cppType: "bool", ueType: "bool" },
  "datetime": { cppType: "FDateTime", ueType: "FDateTime" },
  "date": { cppType: "FDateTime", ueType: "FDateTime" },
  "bytes": { cppType: "TArray<uint8>", ueType: "TArray<uint8>" },
};

function parsePydanticSource(source: string): PydanticModel[] {
  const models: PydanticModel[] = [];
  const classPattern = /class\s+(\w+)\s*\(\s*BaseModel\s*\)\s*:/g;
  let classMatch: RegExpExecArray | null;

  while ((classMatch = classPattern.exec(source)) !== null) {
    const modelName = classMatch[1];
    const classStart = classMatch.index + classMatch[0].length;
    let classEnd = source.length;

    const nextClassIdx = source.indexOf("\nclass ", classStart);
    if (nextClassIdx !== -1) classEnd = nextClassIdx;

    const classBody = source.slice(classStart, classEnd);
    const fields: PydanticField[] = [];
    const validators: ValidatorDef[] = [];

    const fieldPattern = /^\s+(\w+)\s*:\s*(.+?)(?:\s*=\s*(.+))?$/gm;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldPattern.exec(classBody)) !== null) {
      const fieldName = fieldMatch[1];
      if (fieldName.startsWith("model_config") || fieldName.startsWith("_")) continue;

      let rawType = fieldMatch[2].trim();
      const defaultVal = fieldMatch[3]?.trim();
      const isOptional = rawType.includes("| None") || rawType.includes("Optional[");

      rawType = rawType.replace(/\s*\|\s*None/g, "").replace(/Optional\[(.+)\]/, "$1").trim();

      const constraints: FieldConstraint[] = [];
      if (defaultVal) {
        const geMatch = defaultVal.match(/Field\(.*?ge\s*=\s*(\d+)/);
        if (geMatch) constraints.push({ type: "ge", value: Number(geMatch[1]) });
        const leMatch = defaultVal.match(/Field\(.*?le\s*=\s*(\d+)/);
        if (leMatch) constraints.push({ type: "le", value: Number(leMatch[1]) });
        const maxLenMatch = defaultVal.match(/Field\(.*?max_length\s*=\s*(\d+)/);
        if (maxLenMatch) constraints.push({ type: "max_length", value: Number(maxLenMatch[1]) });
        const minLenMatch = defaultVal.match(/Field\(.*?min_length\s*=\s*(\d+)/);
        if (minLenMatch) constraints.push({ type: "min_length", value: Number(minLenMatch[1]) });
      }

      fields.push({ name: fieldName, pythonType: rawType, isOptional, default: defaultVal, constraints });
    }

    const validatorPattern = /@(?:field_)?validator\s*\(\s*['"](\w+)['"]\s*\)([\s\S]*?)(?=\n\s*@|\n\s*class\s|\n\s*def\s+(?!_)|\Z)/g;
    let valMatch: RegExpExecArray | null;
    while ((valMatch = validatorPattern.exec(classBody)) !== null) {
      validators.push({ fieldName: valMatch[1], validatorBody: valMatch[2].trim() });
    }

    models.push({
      name: modelName,
      fields,
      validators,
      isResponse: modelName.endsWith("Response") || modelName.endsWith("Out"),
    });
  }

  return models;
}

function mapPythonTypeToCpp(pythonType: string, isOptional: boolean): { cppType: string; needsInclude?: string } {
  const listMatch = pythonType.match(/list\[(\w+)\]/i);
  if (listMatch) {
    const inner = mapPythonTypeToCpp(listMatch[1], false);
    return { cppType: isOptional ? `TOptional<TArray<${inner.cppType}>>` : `TArray<${inner.cppType}>` };
  }

  const dictMatch = pythonType.match(/dict\[(\w+)\s*,\s*(\w+)\]/i);
  if (dictMatch) {
    const keyType = mapPythonTypeToCpp(dictMatch[1], false);
    const valType = mapPythonTypeToCpp(dictMatch[2], false);
    return { cppType: isOptional ? `TOptional<TMap<${keyType.cppType}, ${valType.cppType}>>` : `TMap<${keyType.cppType}, ${valType.cppType}>` };
  }

  const mapped = TYPE_MAP[pythonType.toLowerCase()];
  if (mapped) {
    return { cppType: isOptional ? `TOptional<${mapped.cppType}>` : mapped.cppType };
  }

  const structName = `F${pythonType}`;
  return { cppType: isOptional ? `TOptional<${structName}>` : structName };
}

function toPascalCase(s: string): string {
  return s.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
}

function generateConstraintCheck(field: PydanticField, cppFieldName: string): string[] {
  const checks: string[] = [];
  const accessor = field.isOptional ? `Value.${cppFieldName}.GetValue()` : `Value.${cppFieldName}`;
  const guard = field.isOptional ? `Value.${cppFieldName}.IsSet() && ` : "";

  for (const c of field.constraints) {
    switch (c.type) {
      case "ge":
        checks.push(`if (${guard}${accessor} < ${c.value}) { OutError = TEXT("${field.name} must be >= ${c.value}"); return false; }`);
        break;
      case "le":
        checks.push(`if (${guard}${accessor} > ${c.value}) { OutError = TEXT("${field.name} must be <= ${c.value}"); return false; }`);
        break;
      case "gt":
        checks.push(`if (${guard}${accessor} <= ${c.value}) { OutError = TEXT("${field.name} must be > ${c.value}"); return false; }`);
        break;
      case "lt":
        checks.push(`if (${guard}${accessor} < ${c.value}) { OutError = TEXT("${field.name} must be < ${c.value}"); return false; }`);
        break;
      case "max_length":
        checks.push(`if (${guard}${accessor}.Len() > ${c.value}) { OutError = TEXT("${field.name} exceeds max length ${c.value}"); return false; }`);
        break;
      case "min_length":
        checks.push(`if (${guard}${accessor}.Len() < ${c.value}) { OutError = TEXT("${field.name} below min length ${c.value}"); return false; }`);
        break;
    }
  }

  if (!field.isOptional) {
    const mapped = TYPE_MAP[field.pythonType.toLowerCase()];
    if (mapped && mapped.cppType === "FString") {
      checks.push(`if (Value.${cppFieldName}.IsEmpty()) { OutError = TEXT("${field.name} is required"); return false; }`);
    }
  }

  return checks;
}

function generateUStruct(model: PydanticModel): { header: string; fixes: string[]; diagnostics: TranspilerDiagnostic[] } {
  const fixes: string[] = [];
  const diagnostics: TranspilerDiagnostic[] = [];
  const structName = `F${model.name}`;
  const lines: string[] = [];

  lines.push(`#pragma once`);
  lines.push(``);
  lines.push(`#include "CoreMinimal.h"`);
  lines.push(`#include "${model.name}.generated.h"`);
  lines.push(``);
  lines.push(`USTRUCT(BlueprintType)`);
  lines.push(`struct ${structName}`);
  lines.push(`{`);
  lines.push(`\tGENERATED_BODY()`);
  lines.push(``);

  for (const field of model.fields) {
    const cppFieldName = toPascalCase(field.name);
    const { cppType } = mapPythonTypeToCpp(field.pythonType, field.isOptional);

    if (field.isOptional) {
      lines.push(`\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sovereign")`);
    } else {
      lines.push(`\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sovereign")`);
    }
    lines.push(`\t${cppType} ${cppFieldName};`);
    lines.push(``);

    fixes.push(`[${structName}::${cppFieldName}] ${field.pythonType}${field.isOptional ? " | None" : ""} → ${cppType}`);
  }

  lines.push(`};`);
  lines.push(``);

  const validationChecks: string[] = [];
  for (const field of model.fields) {
    const cppFieldName = toPascalCase(field.name);
    const checks = generateConstraintCheck(field, cppFieldName);
    validationChecks.push(...checks);
  }

  if (validationChecks.length > 0 || model.fields.some(f => !f.isOptional)) {
    lines.push(`static bool Validate${model.name}(const ${structName}& Value, FString& OutError)`);
    lines.push(`{`);
    for (const check of validationChecks) {
      lines.push(`\t${check}`);
    }
    lines.push(`\treturn true;`);
    lines.push(`}`);
    lines.push(``);
    fixes.push(`[${structName}] Generated Validate${model.name}() with ${validationChecks.length} constraint checks`);
  }

  for (const field of model.fields) {
    if (!TYPE_MAP[field.pythonType.toLowerCase()] && !field.pythonType.match(/list\[|dict\[/i)) {
      diagnostics.push({
        severity: "warning",
        message: `Custom type '${field.pythonType}' mapped to F${field.pythonType} — ensure corresponding USTRUCT exists`,
        model: model.name,
        field: field.name,
      });
    }
  }

  return { header: lines.join("\n"), fixes, diagnostics };
}

function generateSerializerForModel(model: PydanticModel): string {
  const structName = `F${model.name}`;
  const lines: string[] = [];

  lines.push(`static Sovereign::JsonValue ToSovereignJson(const ${structName}& Value)`);
  lines.push(`{`);
  lines.push(`\tstd::map<std::string, Sovereign::JsonValue> obj;`);

  for (const field of model.fields) {
    const cppFieldName = toPascalCase(field.name);
    const snakeName = field.name;
    const { cppType } = mapPythonTypeToCpp(field.pythonType, false);

    if (field.isOptional) {
      lines.push(`\tif (Value.${cppFieldName}.IsSet())`);
      lines.push(`\t{`);
      if (cppType === "FString") {
        lines.push(`\t\tobj["${snakeName}"] = Sovereign::JsonValue(std::string(TCHAR_TO_UTF8(*Value.${cppFieldName}.GetValue())));`);
      } else if (cppType === "int32") {
        lines.push(`\t\tobj["${snakeName}"] = Sovereign::JsonValue(static_cast<int>(Value.${cppFieldName}.GetValue()));`);
      } else if (cppType === "double") {
        lines.push(`\t\tobj["${snakeName}"] = Sovereign::JsonValue(Value.${cppFieldName}.GetValue());`);
      } else if (cppType === "bool") {
        lines.push(`\t\tobj["${snakeName}"] = Sovereign::JsonValue(Value.${cppFieldName}.GetValue());`);
      }
      lines.push(`\t}`);
      lines.push(`\telse`);
      lines.push(`\t{`);
      lines.push(`\t\tobj["${snakeName}"] = Sovereign::JsonValue::null();`);
      lines.push(`\t}`);
    } else {
      if (cppType === "FString") {
        lines.push(`\tobj["${snakeName}"] = Sovereign::JsonValue(std::string(TCHAR_TO_UTF8(*Value.${cppFieldName})));`);
      } else if (cppType === "int32") {
        lines.push(`\tobj["${snakeName}"] = Sovereign::JsonValue(static_cast<int>(Value.${cppFieldName}));`);
      } else if (cppType === "double") {
        lines.push(`\tobj["${snakeName}"] = Sovereign::JsonValue(Value.${cppFieldName});`);
      } else if (cppType === "bool") {
        lines.push(`\tobj["${snakeName}"] = Sovereign::JsonValue(Value.${cppFieldName});`);
      } else {
        lines.push(`\t// TODO: Nested struct serialization for ${cppFieldName}`);
      }
    }
  }

  lines.push(`\treturn Sovereign::JsonValue::object(obj);`);
  lines.push(`}`);

  return lines.join("\n");
}

export function transpilePydanticToUE5(pythonSource: string): TranspilerResult {
  const models = parsePydanticSource(pythonSource);
  const headers: Array<{ path: string; content: string }> = [];
  const sources: Array<{ path: string; content: string }> = [];
  const allFixes: string[] = [];
  const allDiagnostics: TranspilerDiagnostic[] = [];

  for (const model of models) {
    const { header, fixes, diagnostics } = generateUStruct(model);
    headers.push({ path: `Source/Sovereign/Public/${model.name}.h`, content: header });
    allFixes.push(...fixes);
    allDiagnostics.push(...diagnostics);

    const serializer = generateSerializerForModel(model);
    sources.push({ path: `Source/Sovereign/Private/${model.name}Serializer.cpp`, content: serializer });
    allFixes.push(`[${model.name}Serializer.cpp] Generated ToSovereignJson() for F${model.name}`);
  }

  if (models.length === 0) {
    allDiagnostics.push({
      severity: "warning",
      message: "No Pydantic BaseModel classes found in source",
    });
  }

  return { headers, sources, fixes: allFixes, diagnostics: allDiagnostics };
}

export { parsePydanticSource, generateUStruct, mapPythonTypeToCpp, generateSerializerForModel, TYPE_MAP };
export type { PydanticModel, PydanticField, FieldConstraint, TranspilerResult, TranspilerDiagnostic };
