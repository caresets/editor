import { useState } from "react";
import type { LogicalModel, Space, ValueSetDef } from "../types";
import { isGitHubAuthenticated } from "../github";
import { GitHubAuth } from "./GitHubAuth";

type SelectedItem =
  | { kind: "model"; id: string }
  | { kind: "valueset"; id: string }
  | null;

interface Props {
  space: Space;
  selectedItem: SelectedItem;
  onSelectModel: (id: string) => void;
  onSelectValueSet: (id: string) => void;
  onAddModel: () => void;
  onAddValueSet: () => void;
  onDeleteModel: (id: string) => void;
  onDeleteValueSet: (id: string) => void;
  onUploadFile: () => void;
  onGitHub: () => void;
  onCommit: () => void;
}

export function SpaceExplorer({
  space,
  selectedItem,
  onSelectModel,
  onSelectValueSet,
  onAddModel,
  onAddValueSet,
  onDeleteModel,
  onDeleteValueSet,
  onUploadFile,
  onGitHub,
  onCommit,
}: Props) {
  const [modelsExpanded, setModelsExpanded] = useState(true);
  const [valueSetsExpanded, setValueSetsExpanded] = useState(true);
  const [, forceUpdate] = useState(0);

  const authenticated = isGitHubAuthenticated();

  return (
    <div className="space-explorer">
      {/* Space header */}
      <div className="space-header">
        <div className="space-header-title">
          <span className="space-icon">&#9671;</span>
          <span className="space-name">{space.name}</span>
        </div>
        <div className="space-header-actions">
          <button onClick={onUploadFile} title="Import file (.json / .fsh)">Import</button>
          <button onClick={onGitHub} title="Load from GitHub">GitHub</button>
          {authenticated && (
            <button onClick={onCommit} title="Commit models to GitHub" className="commit-btn">
              Commit
            </button>
          )}
        </div>
      </div>

      {/* GitHub auth */}
      <div className="explorer-auth">
        <GitHubAuth onAuthChange={() => forceUpdate((n) => n + 1)} />
      </div>

      {/* Models section */}
      <div className="explorer-section">
        <div
          className="explorer-section-header"
          onClick={() => setModelsExpanded(!modelsExpanded)}
        >
          <span className="explorer-toggle">{modelsExpanded ? "▾" : "▸"}</span>
          <span className="explorer-section-title">MODELS</span>
          <span className="explorer-count">{space.models.length}</span>
          <button
            className="explorer-add-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAddModel();
            }}
            title="New model"
          >
            +
          </button>
        </div>
        {modelsExpanded && (
          <div className="explorer-items">
            {space.models.length === 0 && (
              <div className="explorer-empty">No models yet</div>
            )}
            {space.models.map((m) => (
              <ModelItem
                key={m.id}
                model={m}
                isSelected={selectedItem?.kind === "model" && selectedItem.id === m.id}
                onSelect={() => onSelectModel(m.id)}
                onDelete={() => {
                  if (confirm(`Delete model "${m.name}"?`)) onDeleteModel(m.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ValueSets section */}
      <div className="explorer-section">
        <div
          className="explorer-section-header"
          onClick={() => setValueSetsExpanded(!valueSetsExpanded)}
        >
          <span className="explorer-toggle">{valueSetsExpanded ? "▾" : "▸"}</span>
          <span className="explorer-section-title">VALUE SETS</span>
          <span className="explorer-count">{space.valueSets.length}</span>
          <button
            className="explorer-add-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAddValueSet();
            }}
            title="New value set"
          >
            +
          </button>
        </div>
        {valueSetsExpanded && (
          <div className="explorer-items">
            {space.valueSets.length === 0 && (
              <div className="explorer-empty">No value sets yet</div>
            )}
            {space.valueSets.map((vs) => (
              <ValueSetItem
                key={vs.id}
                vs={vs}
                isSelected={selectedItem?.kind === "valueset" && selectedItem.id === vs.id}
                onSelect={() => onSelectValueSet(vs.id)}
                onDelete={() => {
                  if (confirm(`Delete value set "${vs.name}"?`)) onDeleteValueSet(vs.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelItem({
  model,
  isSelected,
  onSelect,
  onDelete,
}: {
  model: LogicalModel;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`explorer-item${isSelected ? " selected" : ""}`}
      onClick={onSelect}
    >
      <span className="explorer-item-icon model-icon">LM</span>
      <span className="explorer-item-name">{model.title || model.name}</span>
      <span className={`model-status-badge status-${model.status}`}>{model.status}</span>
      <button
        className="explorer-item-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}

function ValueSetItem({
  vs,
  isSelected,
  onSelect,
  onDelete,
}: {
  vs: ValueSetDef;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`explorer-item${isSelected ? " selected" : ""}`}
      onClick={onSelect}
    >
      <span className="explorer-item-icon vs-icon">VS</span>
      <span className="explorer-item-name">{vs.title || vs.name}</span>
      <span className="explorer-item-meta">{vs.concepts.length}</span>
      <button
        className="explorer-item-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}
