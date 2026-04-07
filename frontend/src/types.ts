// --- Element (a data element within a logical model) ---

export interface Element {
  id: string;
  name: string;
  cardinality: { min: "0" | "1"; max: "0" | "1" | "*" };
  dataType: string;
  /** When dataType is "Reference", this holds the URL of the target model */
  referenceTarget: string;
  vsStrength: "" | "required" | "extensible" | "preferred" | "example";
  valueSet: string;
  descriptions: { en: string; fr: string; nl: string };
  children: Element[];
}

// --- ValueSet ---

export interface ValueSetConcept {
  code: string;
  display: string;
  definition: string;
  designations: { en: string; fr: string; nl: string };
}

export interface ValueSetDef {
  id: string;
  url: string;
  name: string;
  title: string;
  status: "draft" | "active" | "retired";
  concepts: ValueSetConcept[];
}

// --- Logical Model ---

export interface LogicalModel {
  id: string;
  url: string;
  name: string;
  title: string;
  status: "draft" | "active" | "retired";
  description: string;
  elements: Element[];
}

// --- Space (top-level container = project / repo) ---

export interface Space {
  id: string;
  name: string;
  description: string;
  /** Optional GitHub source for re-loading */
  github?: { owner: string; repo: string; path: string; branch: string };
  models: LogicalModel[];
  valueSets: ValueSetDef[];
  /** User-editable PlantUML source — empty means "not yet generated" */
  diagramSource: string;
}

// --- Relationship (derived, not persisted) ---

export interface ModelRelationship {
  fromModelId: string;
  fromModelName: string;
  fromElementName: string;
  toModelId: string;
  toModelName: string;
  cardinality: string;
}

// --- Constants ---

export const FHIR_TYPES = [
  "Base",
  "BackboneElement",
  "string",
  "boolean",
  "integer",
  "decimal",
  "code",
  "Coding",
  "CodeableConcept",
  "Quantity",
  "dateTime",
  "date",
  "time",
  "uri",
  "canonical",
  "Reference",
  "markdown",
  "id",
  "positiveInt",
  "Identifier",
  "HumanName",
  "Address",
  "Period",
  "Annotation",
] as const;

export const BINDING_TYPES = ["code", "Coding", "CodeableConcept"] as const;

export type ValidationResult = {
  level: "error" | "warning";
  elementId: string;
  message: string;
};
