import type {
  Element,
  LogicalModel,
  ModelRelationship,
  Space,
  ValidationResult,
  ValueSetDef,
} from "./types";
import { BINDING_TYPES } from "./types";

let _counter = 0;

/** Types that indicate "this element has children" — treated equivalently. */
export const CONTAINER_TYPES = ["Base", "BackboneElement"] as const;

export function isContainerType(t: string): boolean {
  return (CONTAINER_TYPES as readonly string[]).includes(t);
}

// ---------------------------------------------------------------
// Factories
// ---------------------------------------------------------------

export function newElement(name = "newElement"): Element {
  return {
    id: `el-${Date.now()}-${++_counter}`,
    name,
    cardinality: { min: "0", max: "1" },
    dataType: "string",
    referenceTarget: "",
    vsStrength: "",
    valueSet: "",
    descriptions: { en: "", fr: "", nl: "" },
    children: [],
  };
}

export function newModel(name = "NewModel"): LogicalModel {
  return {
    id: `model-${Date.now()}-${++_counter}`,
    url: `http://example.org/fhir/StructureDefinition/${name}`,
    name,
    title: name,
    status: "draft",
    description: "",
    elements: [],
  };
}

export function newValueSet(name = "NewValueSet"): ValueSetDef {
  return {
    id: `vs-${Date.now()}-${++_counter}`,
    url: `http://example.org/fhir/ValueSet/${name}`,
    name,
    title: name,
    status: "draft",
    concepts: [],
  };
}

export function newSpace(name = "New Space"): Space {
  return {
    id: `space-${Date.now()}-${++_counter}`,
    name,
    description: "",
    models: [],
    valueSets: [],
    diagramSource: "",
  };
}

// ---------------------------------------------------------------
// Relationship extraction
// ---------------------------------------------------------------

export function extractRelationships(space: Space): ModelRelationship[] {
  const relationships: ModelRelationship[] = [];
  const nameToModel = new Map<string, LogicalModel>();
  for (const m of space.models) {
    nameToModel.set(m.url, m);
    nameToModel.set(m.name, m);
  }

  function walk(el: Element, model: LogicalModel) {
    if (el.dataType === "Reference" && el.referenceTarget) {
      const target = nameToModel.get(el.referenceTarget);
      if (target && target.id !== model.id) {
        relationships.push({
          fromModelId: model.id,
          fromModelName: model.name,
          fromElementName: el.name,
          toModelId: target.id,
          toModelName: target.name,
          cardinality: `${el.cardinality.min}..${el.cardinality.max}`,
        });
      }
    }
    // Also track model-as-type references (non-Reference, non-FHIR-primitive types)
    if (!el.referenceTarget && !isContainerType(el.dataType)) {
      const target = nameToModel.get(el.dataType);
      if (target && target.id !== model.id) {
        relationships.push({
          fromModelId: model.id,
          fromModelName: model.name,
          fromElementName: el.name,
          toModelId: target.id,
          toModelName: target.name,
          cardinality: `${el.cardinality.min}..${el.cardinality.max}`,
        });
      }
    }
    el.children.forEach((c) => walk(c, model));
  }

  for (const model of space.models) {
    for (const el of model.elements) {
      walk(el, model);
    }
  }

  return relationships;
}

// ---------------------------------------------------------------
// PlantUML generation
// ---------------------------------------------------------------

/**
 * Overview diagram: high-level boxes (ArchiMate application blue),
 * no element details, just model names and relationships.
 */
export function generateOverviewPlantUML(space: Space): string {
  const rels = extractRelationships(space);
  const lines: string[] = [];

  lines.push("@startuml");
  lines.push(`title ${space.name}`);
  lines.push("");
  lines.push("skinparam ClassBackgroundColor #b5e8f7");
  lines.push("skinparam linetype polyline");
  lines.push("hide circle");
  lines.push("hide stereotype");
  lines.push("hide empty methods");
  lines.push("hide empty attributes");
  lines.push("");

  for (const model of space.models) {
    lines.push(`class "${model.title || model.name}" as ${sanitizeId(model.id)}`);
  }
  lines.push("");

  for (const rel of rels) {
    lines.push(
      `${sanitizeId(rel.fromModelId)} --> ${sanitizeId(rel.toModelId)} : ${rel.fromElementName} [${rel.cardinality}]`
    );
  }

  lines.push("");
  lines.push("@enduml");
  return lines.join("\n");
}

/**
 * Detail diagram for a single model: full class with all elements,
 * plus referenced models as simple boxes and ValueSets as enums.
 */
/**
 * Detail diagram for a single model using PlantUML tree notation (|_).
 * Bold element names, indented children, referenced models as separate boxes.
 */
export function generateModelPlantUML(model: LogicalModel, space: Space): string {
  const lines: string[] = [];

  lines.push("@startuml");
  lines.push("");
  lines.push("skinparam ClassBackgroundColor #b5e8f7");
  lines.push("skinparam linetype polyline");
  lines.push("hide circle");
  lines.push("hide stereotype");
  lines.push("hide empty methods");
  lines.push("");

  // Main model as a class with |_ tree notation
  lines.push(`class "**${model.title || model.name}**" as ${sanitizeId(model.id)} {`);
  for (const el of model.elements) {
    writeElementTree(el, lines, "  ");
  }
  lines.push("}");
  lines.push("");

  // Collect referenced models and valuesets
  const refModelIds = new Set<string>();
  const refVsIds = new Set<string>();
  collectRefs(model.elements, space, refModelIds, refVsIds);

  const nameToModel = new Map<string, LogicalModel>();
  for (const m of space.models) {
    nameToModel.set(m.url, m);
    nameToModel.set(m.name, m);
  }

  // Referenced models as empty boxes
  for (const refId of refModelIds) {
    const m = space.models.find((m) => m.id === refId);
    if (m && m.id !== model.id) {
      lines.push(`class "**${m.title || m.name}**" as ${sanitizeId(m.id)}`);
    }
  }
  lines.push("");

  // Relationships from this model
  writeModelRelationships(model, nameToModel, lines);

  // VS bindings
  walkElementsForBindings(model.elements, model, space, lines);

  lines.push("@enduml");
  return lines.join("\n");
}

function writeElementTree(el: Element, lines: string[], indent: string) {
  const card = `${el.cardinality.min}..${el.cardinality.max}`;
  lines.push(`${indent}|_ **${el.name}** ${card}`);
  for (const child of el.children) {
    writeElementTree(child, lines, indent + "  ");
  }
}

function collectRefs(
  elements: Element[],
  space: Space,
  refModelIds: Set<string>,
  refVsIds: Set<string>
) {
  const nameToModel = new Map<string, LogicalModel>();
  for (const m of space.models) {
    nameToModel.set(m.url, m);
    nameToModel.set(m.name, m);
  }

  for (const el of elements) {
    // Reference targets
    if (el.dataType === "Reference" && el.referenceTarget) {
      const target = nameToModel.get(el.referenceTarget);
      if (target) refModelIds.add(target.id);
    }
    // Model-as-type
    if (!isContainerType(el.dataType)) {
      const target = nameToModel.get(el.dataType);
      if (target) refModelIds.add(target.id);
    }
    // ValueSet bindings
    if (el.valueSet) {
      const vs = space.valueSets.find((v) => v.url === el.valueSet || v.name === el.valueSet);
      if (vs) refVsIds.add(vs.id);
    }
    collectRefs(el.children, space, refModelIds, refVsIds);
  }
}

function writeModelRelationships(
  model: LogicalModel,
  nameToModel: Map<string, LogicalModel>,
  lines: string[]
) {
  function walk(el: Element) {
    if (el.dataType === "Reference" && el.referenceTarget) {
      const target = nameToModel.get(el.referenceTarget);
      if (target && target.id !== model.id) {
        const card = `${el.cardinality.min}..${el.cardinality.max}`;
        lines.push(
          `${sanitizeId(model.id)} --> "${card}" ${sanitizeId(target.id)} : ${el.name}`
        );
      }
    }
    if (!el.referenceTarget && !isContainerType(el.dataType)) {
      const target = nameToModel.get(el.dataType);
      if (target && target.id !== model.id) {
        const card = `${el.cardinality.min}..${el.cardinality.max}`;
        lines.push(
          `${sanitizeId(model.id)} --> "${card}" ${sanitizeId(target.id)} : ${el.name}`
        );
      }
    }
    el.children.forEach(walk);
  }
  model.elements.forEach(walk);
}

function walkElementsForBindings(
  elements: Element[],
  model: LogicalModel,
  space: Space,
  lines: string[]
) {
  for (const el of elements) {
    if (el.valueSet) {
      const vs = space.valueSets.find((v) => v.url === el.valueSet || v.name === el.valueSet);
      if (vs) {
        lines.push(
          `${sanitizeId(model.id)} ..> ${sanitizeId(vs.id)} : ${el.name} (${el.vsStrength || "?"})`
        );
      }
    }
    walkElementsForBindings(el.children, model, space, lines);
  }
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

export function plantumlServerUrl(uml: string): string {
  const hex = Array.from(new TextEncoder().encode(uml))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `https://www.plantuml.com/plantuml/svg/~h${hex}`;
}

// ---------------------------------------------------------------
// Validation
// ---------------------------------------------------------------

export function validate(elements: Element[]): ValidationResult[] {
  const results: ValidationResult[] = [];

  function walk(el: Element) {
    if (!el.name) {
      results.push({ level: "error", elementId: el.id, message: "Element has no name" });
    } else if (!/^[a-z][a-zA-Z0-9]*$/.test(el.name)) {
      results.push({
        level: "error",
        elementId: el.id,
        message: `"${el.name}" must start lowercase, alphanumeric only`,
      });
    }

    if (!el.descriptions.en) {
      results.push({
        level: "warning",
        elementId: el.id,
        message: `"${el.name}" is missing English description`,
      });
    }

    const isBindable = (BINDING_TYPES as readonly string[]).includes(el.dataType);
    if (isBindable && !el.valueSet) {
      results.push({
        level: "warning",
        elementId: el.id,
        message: `"${el.name}" (${el.dataType}) has no ValueSet binding`,
      });
    }
    if (!isBindable && el.valueSet) {
      results.push({
        level: "error",
        elementId: el.id,
        message: `"${el.name}" (${el.dataType}) has a ValueSet binding but only code, Coding, and CodeableConcept can be bound`,
      });
    }

    if (el.dataType === "Reference" && !el.referenceTarget) {
      results.push({
        level: "warning",
        elementId: el.id,
        message: `"${el.name}" is a Reference with no target model`,
      });
    }

    if (el.children.length > 0 && !isContainerType(el.dataType)) {
      results.push({
        level: "error",
        elementId: el.id,
        message: `"${el.name}" has children but type is "${el.dataType}" — should be Base or BackboneElement`,
      });
    }

    const min = parseInt(el.cardinality.min);
    const max = el.cardinality.max === "*" ? Infinity : parseInt(el.cardinality.max);
    if (min > max) {
      results.push({
        level: "error",
        elementId: el.id,
        message: `"${el.name}" has min (${el.cardinality.min}) > max (${el.cardinality.max})`,
      });
    }

    el.children.forEach(walk);
  }

  elements.forEach(walk);
  return results;
}

// ---------------------------------------------------------------
// FSH export (full space)
// ---------------------------------------------------------------

export function exportModelFSH(model: LogicalModel): string {
  const lines: string[] = [];
  lines.push(`Logical: ${model.name}`);
  lines.push(`Id: ${model.name}`);
  lines.push(`Title: "${model.title}"`);
  if (model.description) {
    lines.push(`Description: "${model.description}"`);
  }
  lines.push("");

  function writeEl(el: Element, depth: number) {
    const indent = "  ".repeat(depth);
    const card = `${el.cardinality.min}..${el.cardinality.max}`;
    let typePart = el.dataType;
    if (el.dataType === "Reference" && el.referenceTarget) {
      typePart = `Reference(${el.referenceTarget})`;
    }
    lines.push(`${indent}* ${el.name} ${card} ${typePart} "${el.descriptions.en || el.name}"`);
    if (el.valueSet && el.vsStrength) {
      lines.push(`${indent}* ${el.name} from ${el.valueSet} (${el.vsStrength})`);
    }
    for (const child of el.children) {
      writeEl(child, depth + 1);
    }
  }

  for (const el of model.elements) {
    writeEl(el, 0);
  }
  return lines.join("\n") + "\n";
}

export function exportSpaceFSH(space: Space): string {
  const lines: string[] = [];

  for (const model of space.models) {
    lines.push(`Logical: ${model.name}`);
    lines.push(`Id: ${model.name}`);
    lines.push(`Title: "${model.title}"`);
    if (model.description) {
      lines.push(`Description: "${model.description}"`);
    }
    lines.push("");

    function writeElement(el: Element, depth: number) {
      const indent = "  ".repeat(depth);
      const card = `${el.cardinality.min}..${el.cardinality.max}`;
      let typePart = el.dataType;
      if (el.dataType === "Reference" && el.referenceTarget) {
        typePart = `Reference(${el.referenceTarget})`;
      }
      lines.push(`${indent}* ${el.name} ${card} ${typePart} "${el.descriptions.en || el.name}"`);
      if (el.valueSet && el.vsStrength) {
        lines.push(`${indent}* ${el.name} from ${el.valueSet} (${el.vsStrength})`);
      }
      for (const child of el.children) {
        writeElement(child, depth + 1);
      }
    }

    for (const el of model.elements) {
      writeElement(el, 0);
    }
    lines.push("");
  }

  for (const vs of space.valueSets) {
    lines.push(`ValueSet: ${vs.name}`);
    lines.push(`Id: ${vs.name}`);
    lines.push(`Title: "${vs.title}"`);
    lines.push(`* ^status = #${vs.status}`);
    for (const c of vs.concepts) {
      lines.push(`* ${vs.url}#${c.code} "${c.display}"`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------
// FSH parser (reads Logical model definitions from .fsh text)
// ---------------------------------------------------------------

export function parseFSH(fshText: string): LogicalModel[] {
  const models: LogicalModel[] = [];
  // Split into blocks at each `Logical:` declaration
  const blocks = fshText.split(/^(?=Logical:)/m);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed.startsWith("Logical:")) continue;

    const model = parseFSHLogicalBlock(trimmed);
    if (model) models.push(model);
  }

  return models;
}

function parseFSHLogicalBlock(block: string): LogicalModel | null {
  const lines = block.split("\n");
  const model: LogicalModel = {
    id: "",
    url: "",
    name: "",
    title: "",
    status: "draft",
    description: "",
    elements: [],
  };

  // Element stack for tracking nesting depth
  // stack[i] holds the children array at depth i
  const stack: Element[][] = [model.elements];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Skip blank lines and comments
    if (!line.trim() || line.trim().startsWith("//")) continue;

    // Header fields
    const logicalMatch = line.match(/^Logical:\s*(.+)/);
    if (logicalMatch) {
      model.name = logicalMatch[1].trim();
      model.id = `model-${model.name}-${Date.now()}-${++_counter}`;
      model.url = model.name; // will be overwritten if URL is explicit
      continue;
    }

    const idMatch = line.match(/^Id:\s*(.+)/);
    if (idMatch) {
      const id = idMatch[1].trim();
      model.url = model.url || id;
      continue;
    }

    const titleMatch = line.match(/^Title:\s*"(.*)"/);
    if (titleMatch) {
      model.title = titleMatch[1];
      continue;
    }

    const descMatch = line.match(/^Description:\s*"(.*)"/);
    if (descMatch) {
      model.description = descMatch[1];
      continue;
    }

    // Skip header fields we don't model: Parent, Characteristics, etc.
    if (/^(Parent|Characteristics|Mixins):/i.test(line.trim())) continue;

    // Element definition lines: `* name card type "short" "definition"`
    // or `  * name card type "short"`  (indented = child)
    const elemMatch = line.match(/^(\s*)\*\s+(\S+)\s+(\d+\.\.\S+)\s+(\S+)\s*(".*")?/);
    if (elemMatch) {
      const indent = elemMatch[1].length;
      const depth = Math.floor(indent / 2); // 0 = top-level, 1 = child, etc.
      const name = elemMatch[2];
      const card = elemMatch[3];
      let dataType = elemMatch[4];
      const shortDesc = elemMatch[5]
        ? elemMatch[5].replace(/^"(.*)"$/, "$1")
        : name;

      // Parse cardinality
      const [minStr, maxStr] = card.split("..");
      const min = (minStr === "0" || minStr === "1" ? minStr : "0") as "0" | "1";
      const max = (maxStr === "0" || maxStr === "1" || maxStr === "*" ? maxStr : "*") as
        | "0"
        | "1"
        | "*";

      // Parse Reference(Target)
      let referenceTarget = "";
      const refMatch = dataType.match(/^Reference\((.+)\)$/);
      if (refMatch) {
        referenceTarget = refMatch[1];
        dataType = "Reference";
      }

      const el: Element = {
        id: `el-${model.name}-${name}-${Date.now()}-${++_counter}`,
        name,
        cardinality: { min, max },
        dataType,
        referenceTarget,
        vsStrength: "",
        valueSet: "",
        descriptions: { en: shortDesc, fr: "", nl: "" },
        children: [],
      };

      // Place element at correct depth
      while (stack.length > depth + 1) stack.pop();
      if (stack.length === 0) stack.push(model.elements);

      const parent = stack[stack.length - 1];
      parent.push(el);

      // Push this element's children array for potential nested elements
      stack.push(el.children);
      continue;
    }

    // Binding lines: `* name from ValueSetName (strength)` or `  * name from ...`
    const bindMatch = line.match(/^(\s*)\*\s+(\S+)\s+from\s+(\S+)(?:\s+\((\w+)\))?/);
    if (bindMatch) {
      const name = bindMatch[2];
      const vsName = bindMatch[3];
      const strength = bindMatch[4] || "";

      // Find the element to attach the binding to
      const el = findElementByName(model.elements, name);
      if (el) {
        el.valueSet = vsName;
        el.vsStrength = (strength || "") as Element["vsStrength"];
      }
      continue;
    }

    // Caret rules (^binding.strength, ^comment, etc.) — extract binding strength
    const caretBindStrength = line.match(
      /^\s*\*\s+\^binding\.strength\s*=\s*#(\w+)/
    );
    if (caretBindStrength) {
      // Apply to the most recently added element
      const last = findLastElement(model.elements);
      if (last) {
        last.vsStrength = caretBindStrength[1] as Element["vsStrength"];
      }
      continue;
    }

    // Other caret rules — skip
    if (/^\s*\*\s+\^/.test(line)) continue;
  }

  if (!model.name) return null;
  if (!model.title) model.title = model.name;

  return model;
}

function findElementByName(elements: Element[], name: string): Element | null {
  for (const el of elements) {
    if (el.name === name) return el;
    const found = findElementByName(el.children, name);
    if (found) return found;
  }
  return null;
}

function findLastElement(elements: Element[]): Element | null {
  if (elements.length === 0) return null;
  const last = elements[elements.length - 1];
  if (last.children.length > 0) return findLastElement(last.children);
  return last;
}

// ---------------------------------------------------------------
// Element tree helpers
// ---------------------------------------------------------------

export function findElement(elements: Element[], id: string): Element | null {
  for (const el of elements) {
    if (el.id === id) return el;
    const found = findElement(el.children, id);
    if (found) return found;
  }
  return null;
}

export function findParent(elements: Element[], id: string): Element[] | null {
  for (const el of elements) {
    if (el.id === id) return elements;
    if (el.children.some((c) => c.id === id)) return el.children;
    const found = findParent(el.children, id);
    if (found) return found;
  }
  return null;
}

// ---------------------------------------------------------------
// GitHub helpers
// ---------------------------------------------------------------

export async function listGitHubFiles(
  owner: string,
  repo: string,
  path: string,
  branch = "master"
): Promise<{ name: string; download_url: string }[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `Not found (404). Check owner/repo/path and branch name. Tried: ${owner}/${repo}/${path} on branch "${branch}"`
      );
    }
    throw new Error(`GitHub API error: ${res.status}`);
  }
  const items: { name: string; download_url: string; type: string }[] = await res.json();
  return items
    .filter((f) => f.type === "file" && (f.name.endsWith(".json") || f.name.endsWith(".fsh")))
    .map((f) => ({ name: f.name, download_url: f.download_url }));
}

export async function fetchGitHubFile(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
