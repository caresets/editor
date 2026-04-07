import { useEffect, useRef, useState } from "react";
import type { Element, LogicalModel, ValueSetDef } from "../types";
import { isContainerType } from "../utils";
import { InlineEditor } from "./InlineEditor";

interface Props {
  elements: Element[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRename?: (id: string, newName: string) => void;
  onChange?: (updated: Element) => void;
  spaceModels?: LogicalModel[];
  spaceValueSets?: ValueSetDef[];
}

export function ElementTree({
  elements,
  selectedId,
  onSelect,
  onRename,
  onChange,
  spaceModels,
  spaceValueSets,
}: Props) {
  return (
    <>
      {elements.map((el, idx) => (
        <TreeNode
          key={el.id}
          element={el}
          selectedId={selectedId}
          onSelect={onSelect}
          onRename={onRename}
          onChange={onChange}
          spaceModels={spaceModels}
          spaceValueSets={spaceValueSets}
          isLast={idx === elements.length - 1}
          depth={0}
        />
      ))}
    </>
  );
}

function TreeNode({
  element,
  selectedId,
  onSelect,
  onRename,
  onChange,
  spaceModels,
  spaceValueSets,
  isLast,
  depth,
}: {
  element: Element;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRename?: (id: string, newName: string) => void;
  onChange?: (updated: Element) => void;
  spaceModels?: LogicalModel[];
  spaceValueSets?: ValueSetDef[];
  isLast: boolean;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(element.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = element.children.length > 0;
  const isSelected = element.id === selectedId;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commitRename() {
    setEditing(false);
    if (editValue.trim() && editValue !== element.name && onRename) {
      onRename(element.id, editValue.trim());
    } else {
      setEditValue(element.name);
    }
  }

  return (
    <div className={`tree-node${isLast ? " tree-node-last" : ""}`}>
      {/* The row */}
      <div
        className={`tree-node-row${isSelected ? " selected" : ""}`}
        onClick={() => onSelect(isSelected ? null : element.id)}
        onDoubleClick={() => {
          if (onRename) {
            setEditValue(element.name);
            setEditing(true);
          }
        }}
      >
        <span className="tree-arm" />

        <span
          className={`tree-toggle${hasChildren ? " has-children" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
        >
          {hasChildren ? (expanded ? "▾" : "▸") : ""}
        </span>

        {editing ? (
          <input
            ref={inputRef}
            className="tree-name-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setEditValue(element.name);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`tree-name${!element.name ? " tree-name-empty" : ""}`}>
            {element.name || "(unnamed)"}
          </span>
        )}

        <span className="tree-meta">
          <span
            className={`tree-badge${isContainerType(element.dataType) ? " tree-badge-container" : ""}`}
          >
            {element.dataType}
          </span>
          <span className="tree-cardinality">
            {element.cardinality.min}..{element.cardinality.max}
          </span>
          {element.valueSet && (
            <span className="tree-vs-badge" title={element.valueSet}>
              {element.valueSet.split("/").pop() || element.valueSet}
              {element.vsStrength ? ` (${element.vsStrength.charAt(0)})` : ""}
            </span>
          )}
        </span>
      </div>

      {/* Inline editor — shown below the row when selected */}
      {isSelected && onChange && (
        <div className="tree-inline-editor">
          <InlineEditor
            element={element}
            onChange={onChange}
            spaceModels={spaceModels || []}
            spaceValueSets={spaceValueSets || []}
          />
        </div>
      )}

      {/* Children */}
      {hasChildren && expanded && (
        <div className="tree-children">
          {element.children.map((child, idx) => (
            <TreeNode
              key={child.id}
              element={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onRename={onRename}
              onChange={onChange}
              spaceModels={spaceModels}
              spaceValueSets={spaceValueSets}
              isLast={idx === element.children.length - 1}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
