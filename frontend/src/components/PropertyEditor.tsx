import { useState } from "react";
import type { Element, LogicalModel, ValueSetDef } from "../types";
import { FHIR_TYPES, BINDING_TYPES } from "../types";
import { isContainerType } from "../utils";

interface Props {
  element: Element;
  onChange: (updated: Element) => void;
  /** All models in the space (for Reference target picker and model-as-type) */
  spaceModels: LogicalModel[];
  /** All value sets in the space (for binding picker) */
  spaceValueSets: ValueSetDef[];
}

type Lang = "en" | "fr" | "nl";

export function PropertyEditor({ element, onChange, spaceModels, spaceValueSets }: Props) {
  const [descTab, setDescTab] = useState<Lang>("en");
  const showBinding = (BINDING_TYPES as readonly string[]).includes(element.dataType);
  const showRefTarget = element.dataType === "Reference";
  const hasChildren = element.children.length > 0;
  const typeWarning =
    hasChildren && !isContainerType(element.dataType)
      ? `This element has children — type should be Base or BackboneElement (currently "${element.dataType}")`
      : null;

  // Build the full type list: FHIR types + models in the space
  const modelTypeNames = spaceModels.map((m) => m.name);

  function update(patch: Partial<Element>) {
    onChange({ ...element, ...patch });
  }

  function handleTypeChange(newType: string) {
    const patch: Partial<Element> = { dataType: newType };
    // Clear referenceTarget if no longer Reference
    if (newType !== "Reference") patch.referenceTarget = "";
    // Clear binding fields if no longer a binding type
    if (!(BINDING_TYPES as readonly string[]).includes(newType)) {
      patch.valueSet = "";
      patch.vsStrength = "";
    }
    update(patch);
  }

  return (
    <div>
      {/* Identity */}
      <div className="prop-section">
        <h3>Identity</h3>
        <div className="prop-row">
          <label>Name</label>
          <input
            value={element.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="elementName"
          />
        </div>
        <div className="prop-row">
          <label>Data Type</label>
          <select value={element.dataType} onChange={(e) => handleTypeChange(e.target.value)}>
            <optgroup label="FHIR Types">
              {FHIR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                  {isContainerType(t) ? " (container)" : ""}
                </option>
              ))}
            </optgroup>
            {modelTypeNames.length > 0 && (
              <optgroup label="Models in Space">
                {modelTypeNames.map((name) => (
                  <option key={`model-${name}`} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {typeWarning && (
          <div className="type-warning">{typeWarning}</div>
        )}

        {hasChildren && !isContainerType(element.dataType) && (
          <div className="prop-row">
            <label></label>
            <button
              className="fix-type-btn"
              onClick={() => update({ dataType: "Base" })}
            >
              Fix: set type to Base
            </button>
          </div>
        )}

        <div className="prop-row">
          <label>Min</label>
          <select
            value={element.cardinality.min}
            onChange={(e) =>
              update({
                cardinality: {
                  ...element.cardinality,
                  min: e.target.value as "0" | "1",
                },
              })
            }
          >
            <option value="0">0</option>
            <option value="1">1</option>
          </select>
        </div>
        <div className="prop-row">
          <label>Max</label>
          <select
            value={element.cardinality.max}
            onChange={(e) =>
              update({
                cardinality: {
                  ...element.cardinality,
                  max: e.target.value as "0" | "1" | "*",
                },
              })
            }
          >
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="*">*</option>
          </select>
        </div>
      </div>

      {/* Reference target */}
      {showRefTarget && (
        <div className="prop-section">
          <h3>Reference Target</h3>
          <div className="prop-row">
            <label>Target Model</label>
            <select
              value={element.referenceTarget}
              onChange={(e) => update({ referenceTarget: e.target.value })}
            >
              <option value="">-- select target --</option>
              {spaceModels.map((m) => (
                <option key={m.id} value={m.url || m.name}>
                  {m.title || m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="prop-section">
        <h3>Description</h3>
        <div className="desc-tabs">
          {(["en", "fr", "nl"] as const).map((lang) => (
            <button
              key={lang}
              className={`desc-tab${descTab === lang ? " active" : ""}`}
              onClick={() => setDescTab(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="prop-row">
          <textarea
            value={element.descriptions[descTab]}
            onChange={(e) =>
              update({
                descriptions: { ...element.descriptions, [descTab]: e.target.value },
              })
            }
            placeholder={`Description (${descTab.toUpperCase()})`}
          />
        </div>
      </div>

      {/* ValueSet binding */}
      {showBinding && (
        <div className="prop-section">
          <h3>ValueSet Binding</h3>
          <div className="prop-row">
            <label>ValueSet</label>
            <select
              value={element.valueSet}
              onChange={(e) => update({ valueSet: e.target.value })}
            >
              <option value="">-- select or type URL --</option>
              {spaceValueSets.map((vs) => (
                <option key={vs.id} value={vs.url}>
                  {vs.title || vs.name}
                </option>
              ))}
            </select>
          </div>
          <div className="prop-row">
            <label>or URL</label>
            <input
              value={element.valueSet}
              onChange={(e) => update({ valueSet: e.target.value })}
              placeholder="http://hl7.org/fhir/ValueSet/..."
            />
          </div>
          <div className="prop-row">
            <label>Strength</label>
            <select
              value={element.vsStrength}
              onChange={(e) =>
                update({
                  vsStrength: e.target.value as Element["vsStrength"],
                })
              }
            >
              <option value="">-- select --</option>
              <option value="required">required</option>
              <option value="extensible">extensible</option>
              <option value="preferred">preferred</option>
              <option value="example">example</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
