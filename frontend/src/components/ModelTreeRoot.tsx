import { useState } from "react";
import type { Element, LogicalModel, ValueSetDef } from "../types";
import { ElementTree } from "./ElementTree";
import { ModelMetadataEditor } from "./ModelMetadataEditor";

interface Props {
  model: LogicalModel;
  onUpdateModel: (updated: LogicalModel) => void;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onRenameElement?: (id: string, newName: string) => void;
  onChangeElement?: (updated: Element) => void;
  spaceModels: LogicalModel[];
  spaceValueSets: ValueSetDef[];
}

export function ModelTreeRoot({
  model,
  onUpdateModel,
  selectedElementId,
  onSelectElement,
  onRenameElement,
  onChangeElement,
  spaceModels,
  spaceValueSets,
}: Props) {
  const [metaExpanded, setMetaExpanded] = useState(false);
  const hasElements = model.elements.length > 0;

  return (
    <div className="tree-root">
      <div className="tree-node">
        <div
          className="tree-node-row tree-trunk-row"
          onClick={() => {
            onSelectElement(null);
            setMetaExpanded(!metaExpanded);
          }}
        >
          <span
            className="tree-toggle has-children"
            onClick={(e) => {
              e.stopPropagation();
              setMetaExpanded(!metaExpanded);
            }}
          >
            {metaExpanded ? "▾" : "▸"}
          </span>
          <span className="tree-trunk-name">{model.title || model.name}</span>
          <span className={`model-status-badge status-${model.status}`}>
            {model.status}
          </span>
        </div>

        {metaExpanded && (
          <div className="tree-trunk-meta">
            <ModelMetadataEditor model={model} onChange={onUpdateModel} />
          </div>
        )}

        <div className="tree-children">
          {hasElements ? (
            <ElementTree
              elements={model.elements}
              selectedId={selectedElementId}
              onSelect={onSelectElement}
              onRename={onRenameElement}
              onChange={onChangeElement}
              spaceModels={spaceModels}
              spaceValueSets={spaceValueSets}
            />
          ) : (
            <div style={{ padding: "8px 0 8px 20px", color: "#6c757d", fontSize: 13 }}>
              Click "+ Element" to add a data element.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
