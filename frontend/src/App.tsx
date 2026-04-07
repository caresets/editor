import { useCallback, useEffect, useRef, useState } from "react";
import type { Element, LogicalModel, Space, ValidationResult, ValueSetDef } from "./types";
import { DiagramView } from "./components/DiagramView";
import { ElementTree } from "./components/ElementTree";
import { CommitDialog } from "./components/CommitDialog";
import { GitHubDialog } from "./components/GitHubDialog";
import { ModelTreeRoot } from "./components/ModelTreeRoot";
import { SpaceExplorer } from "./components/SpaceExplorer";
import type { Tab } from "./components/Toolbar";
import { Toolbar } from "./components/Toolbar";
import { ValueSetEditor } from "./components/ValueSetEditor";
import {
  exportSpaceFSH,
  findElement,
  generateModelPlantUML,
  isContainerType,
  newElement,
  newModel,
  newSpace,
  newValueSet,
  plantumlServerUrl,
  validate,
} from "./utils";

type SelectedItem =
  | { kind: "model"; id: string }
  | { kind: "valueset"; id: string }
  | null;

const STORAGE_KEY = "fhir-editor-space";

function loadSavedSpace(): Space {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.id && parsed.models) return parsed;
    }
  } catch { /* ignore corrupt data */ }
  return newSpace("My Space");
}

export function App() {
  const [space, setSpace] = useState<Space>(loadSavedSpace);
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showGitHub, setShowGitHub] = useState(false);
  const [showCommit, setShowCommit] = useState(false);
  const [modelDiagramSource, setModelDiagramSource] = useState("");
  const [showModelDiagram, setShowModelDiagram] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save to localStorage on every space change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(space));
  }, [space]);

  // Derived state
  const activeModel =
    selectedItem?.kind === "model"
      ? space.models.find((m) => m.id === selectedItem.id) ?? null
      : null;

  const selectedElement =
    activeModel && selectedElementId
      ? findElement(activeModel.elements, selectedElementId)
      : null;

  // ---------------------------------------------------------------
  // Space mutations
  // ---------------------------------------------------------------

  function updateSpace(patch: Partial<Space>) {
    setSpace((prev) => ({ ...prev, ...patch }));
  }

  function updateModel(updated: LogicalModel) {
    setSpace((prev) => ({
      ...prev,
      models: prev.models.map((m) => (m.id === updated.id ? updated : m)),
    }));
  }

  function updateValueSets(valueSets: ValueSetDef[]) {
    updateSpace({ valueSets });
  }

  // ---------------------------------------------------------------
  // Model CRUD
  // ---------------------------------------------------------------

  function handleAddModel() {
    const m = newModel();
    setSpace((prev) => ({ ...prev, models: [...prev.models, m] }));
    setSelectedItem({ kind: "model", id: m.id });
    setSelectedElementId(null);
    setActiveTab("models");
  }

  function handleDeleteModel(id: string) {
    setSpace((prev) => ({ ...prev, models: prev.models.filter((m) => m.id !== id) }));
    if (selectedItem?.kind === "model" && selectedItem.id === id) {
      setSelectedItem(null);
      setSelectedElementId(null);
    }
  }

  // ---------------------------------------------------------------
  // ValueSet CRUD (space level)
  // ---------------------------------------------------------------

  function handleAddValueSet() {
    const vs = newValueSet();
    setSpace((prev) => ({ ...prev, valueSets: [...prev.valueSets, vs] }));
    setSelectedItem({ kind: "valueset", id: vs.id });
    setActiveTab("valuesets");
  }

  function handleDeleteValueSet(id: string) {
    setSpace((prev) => ({ ...prev, valueSets: prev.valueSets.filter((v) => v.id !== id) }));
    if (selectedItem?.kind === "valueset" && selectedItem.id === id) {
      setSelectedItem(null);
    }
  }

  // ---------------------------------------------------------------
  // File upload
  // ---------------------------------------------------------------

  function handleUploadFile() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        // Detect what was uploaded
        if (data.models && data.valueSets) {
          // Full space
          setSpace({
            ...data,
            id: data.id || space.id,
            name: data.name || file.name.replace(/\.json$/, ""),
          });
          setSelectedItem(null);
          setSelectedElementId(null);
        } else if (data.elements !== undefined || data.resourceType === "StructureDefinition") {
          // Single model
          if (!data.id) data.id = `model-${Date.now()}`;
          setSpace((prev) => ({ ...prev, models: [...prev.models, data as LogicalModel] }));
          setSelectedItem({ kind: "model", id: data.id });
          setActiveTab("models");
        } else if (data.concepts !== undefined || data.resourceType === "ValueSet") {
          // Single VS
          if (!data.id) data.id = `vs-${Date.now()}`;
          setSpace((prev) => ({ ...prev, valueSets: [...prev.valueSets, data as ValueSetDef] }));
          setSelectedItem({ kind: "valueset", id: data.id });
          setActiveTab("valuesets");
        } else {
          alert("Unrecognised file format. Expected a Space, LogicalModel, or ValueSet JSON.");
        }
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ---------------------------------------------------------------
  // GitHub load
  // ---------------------------------------------------------------

  function handleGitHubLoad(partial: {
    models: LogicalModel[];
    valueSets: ValueSetDef[];
    github: Space["github"];
  }) {
    setSpace((prev) => ({
      ...prev,
      models: [...prev.models, ...partial.models],
      valueSets: [...prev.valueSets, ...partial.valueSets],
      github: partial.github,
    }));
    setShowGitHub(false);
  }

  // ---------------------------------------------------------------
  // Save / Export
  // ---------------------------------------------------------------

  function handleSaveSpace() {
    const blob = new Blob([JSON.stringify(space, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${space.name.replace(/\s+/g, "-").toLowerCase()}.space.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleExportFSH = useCallback(() => {
    const fsh = exportSpaceFSH(space);
    const blob = new Blob([fsh], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${space.name.replace(/\s+/g, "-").toLowerCase()}.fsh`;
    a.click();
    URL.revokeObjectURL(url);
  }, [space]);

  // ---------------------------------------------------------------
  // Element helpers
  // ---------------------------------------------------------------

  function replaceElement(list: Element[], id: string, updated: Element): Element[] {
    return list.map((el) => {
      if (el.id === id) return updated;
      if (el.children.length > 0) {
        return { ...el, children: replaceElement(el.children, id, updated) };
      }
      return el;
    });
  }

  function removeElement(list: Element[], id: string): Element[] {
    return list
      .filter((el) => el.id !== id)
      .map((el) => ({ ...el, children: removeElement(el.children, id) }));
  }

  const handleAddElement = useCallback(() => {
    if (!activeModel) return;
    const el = newElement();
    updateModel({ ...activeModel, elements: [...activeModel.elements, el] });
    setSelectedElementId(el.id);
  }, [activeModel]);

  const handleAddChild = useCallback(() => {
    if (!activeModel || !selectedElementId) return;
    const child = newElement();
    const parent = findElement(activeModel.elements, selectedElementId);
    if (!parent) return;
    // Auto-set parent type to Base if it's not already a container type
    const parentType = isContainerType(parent.dataType) ? parent.dataType : "Base";
    const updatedParent = {
      ...parent,
      dataType: parentType,
      children: [...parent.children, child],
    };
    updateModel({
      ...activeModel,
      elements: replaceElement(activeModel.elements, selectedElementId, updatedParent),
    });
    setSelectedElementId(child.id);
  }, [activeModel, selectedElementId]);

  const handleDeleteElement = useCallback(() => {
    if (!activeModel || !selectedElementId) return;
    updateModel({
      ...activeModel,
      elements: removeElement(activeModel.elements, selectedElementId),
    });
    setSelectedElementId(null);
  }, [activeModel, selectedElementId]);

  const handleElementChange = useCallback(
    (updated: Element) => {
      if (!activeModel || !selectedElementId) return;
      updateModel({
        ...activeModel,
        elements: replaceElement(activeModel.elements, selectedElementId, updated),
      });
    },
    [activeModel, selectedElementId]
  );

  // ---------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------

  const handleValidate = useCallback(async () => {
    // Validate all models in the space
    const allResults: ValidationResult[] = [];
    for (const model of space.models) {
      const results = validate(model.elements);
      allResults.push(...results);
    }
    try {
      for (const model of space.models) {
        const res = await fetch("/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elements: model.elements }),
        });
        if (res.ok) {
          const data = await res.json();
          const seen = new Set(allResults.map((r) => `${r.elementId}:${r.message}`));
          for (const r of data.results) {
            const key = `${r.elementId}:${r.message}`;
            if (!seen.has(key)) allResults.push(r);
          }
        }
      }
    } catch {
      // backend unavailable
    }
    setValidationResults(allResults);
  }, [space]);

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.fsh"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <Toolbar
        spaceName={space.name}
        onValidate={handleValidate}
        onExportFSH={handleExportFSH}
        onSaveSpace={handleSaveSpace}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="main-layout">
        {/* Left: Space explorer (always visible) */}
        <div className="left-panel">
          <SpaceExplorer
            space={space}
            selectedItem={selectedItem}
            onSelectModel={(id) => {
              setSelectedItem({ kind: "model", id });
              setSelectedElementId(null);
              setActiveTab("models");
            }}
            onSelectValueSet={(id) => {
              setSelectedItem({ kind: "valueset", id });
              setActiveTab("valuesets");
            }}
            onAddModel={handleAddModel}
            onAddValueSet={handleAddValueSet}
            onDeleteModel={handleDeleteModel}
            onDeleteValueSet={handleDeleteValueSet}
            onUploadFile={handleUploadFile}
            onGitHub={() => setShowGitHub(true)}
            onCommit={() => setShowCommit(true)}
          />
        </div>

        {/* Right: unified content area */}
        <div className="content-panel">
          {activeTab === "models" && (
            <>
              {!activeModel ? (
                <div className="empty">Select or create a model in the explorer.</div>
              ) : (
                <div className="model-editor">
                  {/* Tree with model as root */}
                  <div className="model-tree-section">
                    <div className="tree-actions">
                      <button onClick={handleAddElement}>+ Element</button>
                      <button onClick={handleAddChild} disabled={!selectedElementId}>
                        + Child
                      </button>
                      <button
                        className="danger"
                        onClick={handleDeleteElement}
                        disabled={!selectedElementId}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="tree-content">
                      <ModelTreeRoot
                        model={activeModel}
                        onUpdateModel={updateModel}
                        selectedElementId={selectedElementId}
                        onSelectElement={setSelectedElementId}
                        onRenameElement={(id, newName) => {
                          const el = findElement(activeModel.elements, id);
                          if (el) {
                            updateModel({
                              ...activeModel,
                              elements: replaceElement(activeModel.elements, id, {
                                ...el,
                                name: newName,
                              }),
                            });
                          }
                        }}
                        onChangeElement={handleElementChange}
                        spaceModels={space.models}
                        spaceValueSets={space.valueSets}
                      />
                    </div>
                  </div>

                  {/* Validation results */}
                  {validationResults.length > 0 && (
                    <div className="validation-results">
                      <h3>Validation Results ({validationResults.length})</h3>
                      {validationResults.map((r, i) => (
                        <div
                          key={i}
                          className={`val-item ${r.level}`}
                          onClick={() => setSelectedElementId(r.elementId)}
                          style={{ cursor: "pointer" }}
                        >
                          [{r.level}] {r.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Model-level PlantUML diagram */}
                  <div className="model-diagram-section">
                    <div
                      className="model-diagram-header"
                      onClick={() => setShowModelDiagram(!showModelDiagram)}
                    >
                      <span className="model-meta-toggle">
                        {showModelDiagram ? "▾" : "▸"}
                      </span>
                      <span>Model Diagram</span>
                      <button
                        className="model-diagram-generate"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModelDiagramSource(
                            generateModelPlantUML(activeModel, space)
                          );
                          setShowModelDiagram(true);
                        }}
                      >
                        Generate
                      </button>
                    </div>
                    {showModelDiagram && (
                      <div className="model-diagram-body">
                        {!modelDiagramSource ? (
                          <div style={{ padding: 16, color: "#6c757d", fontSize: 13 }}>
                            Click <strong>Generate</strong> to create a diagram for this model.
                          </div>
                        ) : (
                          <>
                            <div className="model-diagram-preview">
                              <img
                                src={plantumlServerUrl(modelDiagramSource)}
                                alt="Model diagram"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                            <textarea
                              className="model-diagram-editor"
                              value={modelDiagramSource}
                              onChange={(e) => setModelDiagramSource(e.target.value)}
                              spellCheck={false}
                              rows={12}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "valuesets" && (
            <ValueSetEditor
              valueSets={space.valueSets}
              selectedVsId={selectedItem?.kind === "valueset" ? selectedItem.id : null}
              onChange={updateValueSets}
              onSelectVs={(id) => setSelectedItem({ kind: "valueset", id })}
            />
          )}

          {activeTab === "overview" && (
            <DiagramView
              space={space}
              onUpdateSource={(src) =>
                setSpace((prev) => ({ ...prev, diagramSource: src }))
              }
            />
          )}
        </div>
      </div>

      {showGitHub && (
        <GitHubDialog
          onLoadSpace={handleGitHubLoad}
          onClose={() => setShowGitHub(false)}
        />
      )}

      {showCommit && (
        <CommitDialog
          space={space}
          onClose={() => setShowCommit(false)}
        />
      )}
    </>
  );
}
