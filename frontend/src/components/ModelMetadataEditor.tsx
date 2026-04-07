import { useState } from "react";
import type { LogicalModel } from "../types";

interface Props {
  model: LogicalModel;
  onChange: (updated: LogicalModel) => void;
}

type Lang = "en" | "fr" | "nl";

export function ModelMetadataEditor({ model, onChange }: Props) {
  const [descTab, setDescTab] = useState<Lang>("en");

  function update(patch: Partial<LogicalModel>) {
    onChange({ ...model, ...patch });
  }

  const descriptions: Record<Lang, string> =
    typeof model.description === "object" && model.description !== null
      ? (model.description as unknown as Record<Lang, string>)
      : { en: model.description || "", fr: "", nl: "" };

  function updateDescription(lang: Lang, value: string) {
    const newDescs = { ...descriptions, [lang]: value };
    update({ description: newDescs as unknown as string });
  }

  return (
    <div className="model-meta-fields">
      <div className="prop-row">
        <label>Name</label>
        <input
          value={model.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="ModelName (PascalCase)"
        />
      </div>
      <div className="prop-row">
        <label>Title</label>
        <input
          value={model.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Human-readable title"
        />
      </div>
      <div className="prop-row">
        <label>URL</label>
        <input
          value={model.url}
          onChange={(e) => update({ url: e.target.value })}
          placeholder="http://example.org/fhir/StructureDefinition/..."
        />
      </div>
      <div className="prop-row">
        <label>Status</label>
        <select
          value={model.status}
          onChange={(e) => update({ status: e.target.value as LogicalModel["status"] })}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="retired">retired</option>
        </select>
      </div>

      <div style={{ marginTop: 8 }}>
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
          <label>Description</label>
          <textarea
            value={descriptions[descTab]}
            onChange={(e) => updateDescription(descTab, e.target.value)}
            placeholder={`Model description (${descTab.toUpperCase()})`}
          />
        </div>
      </div>
    </div>
  );
}
