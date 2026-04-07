import { useState } from "react";
import type { Element, LogicalModel, ValueSetDef } from "../types";
import { FHIR_TYPES, BINDING_TYPES } from "../types";
import { isContainerType } from "../utils";

interface Props {
  element: Element;
  onChange: (updated: Element) => void;
  spaceModels: LogicalModel[];
  spaceValueSets: ValueSetDef[];
}

type Lang = "en" | "fr" | "nl";

export function InlineEditor({ element, onChange, spaceModels, spaceValueSets }: Props) {
  const [descTab, setDescTab] = useState<Lang>("en");
  const showBinding = (BINDING_TYPES as readonly string[]).includes(element.dataType);
  const showRefTarget = element.dataType === "Reference";
  const hasChildren = element.children.length > 0;
  const modelTypeNames = spaceModels.map((m) => m.name);

  function update(patch: Partial<Element>) {
    onChange({ ...element, ...patch });
  }

  function handleTypeChange(newType: string) {
    const patch: Partial<Element> = { dataType: newType };
    if (newType !== "Reference") patch.referenceTarget = "";
    if (!(BINDING_TYPES as readonly string[]).includes(newType)) {
      patch.valueSet = "";
      patch.vsStrength = "";
    }
    update(patch);
  }

  return (
    <div className="inline-ed" onClick={(e) => e.stopPropagation()}>
      {/* Row 1: Name + Type + Cardinality */}
      <div className="inline-ed-row">
        <label>Name</label>
        <input
          value={element.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="elementName"
          className="inline-ed-name"
        />
        <label>Type</label>
        <select value={element.dataType} onChange={(e) => handleTypeChange(e.target.value)}>
          <optgroup label="FHIR">
            {FHIR_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </optgroup>
          {modelTypeNames.length > 0 && (
            <optgroup label="Models">
              {modelTypeNames.map((n) => (
                <option key={`m-${n}`} value={n}>{n}</option>
              ))}
            </optgroup>
          )}
        </select>
        <label>Card</label>
        <select
          value={element.cardinality.min}
          onChange={(e) =>
            update({ cardinality: { ...element.cardinality, min: e.target.value as "0" | "1" } })
          }
          className="inline-ed-card"
        >
          <option value="0">0</option>
          <option value="1">1</option>
        </select>
        <span className="inline-ed-dots">..</span>
        <select
          value={element.cardinality.max}
          onChange={(e) =>
            update({ cardinality: { ...element.cardinality, max: e.target.value as "0" | "1" | "*" } })
          }
          className="inline-ed-card"
        >
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="*">*</option>
        </select>
      </div>

      {/* Type warning */}
      {hasChildren && !isContainerType(element.dataType) && (
        <div className="inline-ed-warning">
          Should be Base or BackboneElement.{" "}
          <button onClick={() => update({ dataType: "Base" })}>Fix</button>
        </div>
      )}

      {/* Reference target */}
      {showRefTarget && (
        <div className="inline-ed-row">
          <label>Target</label>
          <select
            value={element.referenceTarget}
            onChange={(e) => update({ referenceTarget: e.target.value })}
          >
            <option value="">-- select --</option>
            {spaceModels.map((m) => (
              <option key={m.id} value={m.url || m.name}>{m.title || m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ValueSet binding */}
      {showBinding && (
        <div className="inline-ed-row">
          <label>ValueSet</label>
          <select
            value={element.valueSet}
            onChange={(e) => update({ valueSet: e.target.value })}
          >
            <option value="">-- select --</option>
            {spaceValueSets.map((vs) => (
              <option key={vs.id} value={vs.url}>{vs.title || vs.name}</option>
            ))}
          </select>
          <input
            value={element.valueSet}
            onChange={(e) => update({ valueSet: e.target.value })}
            placeholder="or URL"
            className="inline-ed-vs-url"
          />
          <label>Strength</label>
          <select
            value={element.vsStrength}
            onChange={(e) => update({ vsStrength: e.target.value as Element["vsStrength"] })}
            className="inline-ed-strength"
          >
            <option value="">--</option>
            <option value="required">required</option>
            <option value="extensible">extensible</option>
            <option value="preferred">preferred</option>
            <option value="example">example</option>
          </select>
        </div>
      )}

      {/* Description */}
      <div className="inline-ed-desc">
        <div className="inline-ed-desc-tabs">
          {(["en", "fr", "nl"] as const).map((lang) => (
            <button
              key={lang}
              className={descTab === lang ? "active" : ""}
              onClick={() => setDescTab(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <textarea
          value={element.descriptions[descTab]}
          onChange={(e) =>
            update({ descriptions: { ...element.descriptions, [descTab]: e.target.value } })
          }
          placeholder={`Description (${descTab.toUpperCase()})`}
          rows={2}
        />
      </div>
    </div>
  );
}
