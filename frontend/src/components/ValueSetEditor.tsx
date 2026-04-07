import { useState } from "react";
import type { ValueSetDef, ValueSetConcept } from "../types";
import { newValueSet } from "../utils";

interface Props {
  valueSets: ValueSetDef[];
  selectedVsId: string | null;
  onChange: (valueSets: ValueSetDef[]) => void;
  onSelectVs: (id: string) => void;
}

type Lang = "en" | "fr" | "nl";

export function ValueSetEditor({ valueSets, selectedVsId, onChange, onSelectVs }: Props) {
  const [designationLang, setDesignationLang] = useState<Lang>("fr");

  const selectedVs = valueSets.find((vs) => vs.id === selectedVsId) ?? null;

  function addValueSet() {
    const vs = newValueSet();
    onChange([...valueSets, vs]);
    onSelectVs(vs.id);
  }

  function deleteValueSet(id: string) {
    onChange(valueSets.filter((vs) => vs.id !== id));
  }

  function updateVs(updated: ValueSetDef) {
    onChange(valueSets.map((vs) => (vs.id === updated.id ? updated : vs)));
  }

  function addConcept() {
    if (!selectedVs) return;
    const concept: ValueSetConcept = {
      code: "",
      display: "",
      definition: "",
      designations: { en: "", fr: "", nl: "" },
    };
    updateVs({ ...selectedVs, concepts: [...selectedVs.concepts, concept] });
  }

  function updateConcept(index: number, patch: Partial<ValueSetConcept>) {
    if (!selectedVs) return;
    const concepts = selectedVs.concepts.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    updateVs({ ...selectedVs, concepts });
  }

  function removeConcept(index: number) {
    if (!selectedVs) return;
    updateVs({ ...selectedVs, concepts: selectedVs.concepts.filter((_, i) => i !== index) });
  }

  return (
    <div className="valueset-editor">
      <div className="vs-sidebar">
        <div className="vs-sidebar-header">
          <h3>Value Sets</h3>
          <button onClick={addValueSet}>+ Add</button>
        </div>
        <div className="vs-list">
          {valueSets.length === 0 && (
            <div className="vs-list-empty">No value sets defined.</div>
          )}
          {valueSets.map((vs) => (
            <div
              key={vs.id}
              className={`vs-list-item${vs.id === selectedVsId ? " active" : ""}`}
              onClick={() => onSelectVs(vs.id)}
            >
              <span>{vs.title || vs.name}</span>
              <span className="vs-concept-count">{vs.concepts.length}</span>
              <button
                className="vs-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${vs.name}"?`)) deleteValueSet(vs.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="vs-detail">
        {!selectedVs ? (
          <div className="empty">Select a ValueSet to edit, or create a new one.</div>
        ) : (
          <>
            <div className="prop-section">
              <h3>ValueSet Identity</h3>
              <div className="prop-row">
                <label>Name</label>
                <input
                  value={selectedVs.name}
                  onChange={(e) => updateVs({ ...selectedVs, name: e.target.value })}
                />
              </div>
              <div className="prop-row">
                <label>Title</label>
                <input
                  value={selectedVs.title}
                  onChange={(e) => updateVs({ ...selectedVs, title: e.target.value })}
                />
              </div>
              <div className="prop-row">
                <label>URL</label>
                <input
                  value={selectedVs.url}
                  onChange={(e) => updateVs({ ...selectedVs, url: e.target.value })}
                />
              </div>
              <div className="prop-row">
                <label>Status</label>
                <select
                  value={selectedVs.status}
                  onChange={(e) =>
                    updateVs({ ...selectedVs, status: e.target.value as ValueSetDef["status"] })
                  }
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="retired">retired</option>
                </select>
              </div>
            </div>

            <div className="prop-section">
              <h3>Concepts</h3>
              <div className="desc-tabs" style={{ marginBottom: 8 }}>
                {(["fr", "nl", "en"] as const).map((lang) => (
                  <button
                    key={lang}
                    className={`desc-tab${designationLang === lang ? " active" : ""}`}
                    onClick={() => setDesignationLang(lang)}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>

              <table className="vs-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Display</th>
                    <th>Definition</th>
                    <th>Designation ({designationLang.toUpperCase()})</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVs.concepts.map((c, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          value={c.code}
                          onChange={(e) => updateConcept(i, { code: e.target.value })}
                          placeholder="code"
                        />
                      </td>
                      <td>
                        <input
                          value={c.display}
                          onChange={(e) => updateConcept(i, { display: e.target.value })}
                          placeholder="Display"
                        />
                      </td>
                      <td>
                        <input
                          value={c.definition}
                          onChange={(e) => updateConcept(i, { definition: e.target.value })}
                          placeholder="Definition"
                        />
                      </td>
                      <td>
                        <input
                          value={c.designations[designationLang]}
                          onChange={(e) =>
                            updateConcept(i, {
                              designations: {
                                ...c.designations,
                                [designationLang]: e.target.value,
                              },
                            })
                          }
                          placeholder={`Name ${designationLang.toUpperCase()}`}
                        />
                      </td>
                      <td>
                        <button className="vs-row-delete" onClick={() => removeConcept(i)}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="vs-add-concept" onClick={addConcept}>
                + Add concept
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
