export type Tab = "overview" | "models" | "valuesets";

interface Props {
  spaceName: string;
  onValidate: () => void;
  onExportFSH: () => void;
  onSaveSpace: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function Toolbar({
  spaceName,
  onValidate,
  onExportFSH,
  onSaveSpace,
  activeTab,
  onTabChange,
}: Props) {
  return (
    <div className="toolbar">
      <h1>{spaceName}</h1>

      <div className="toolbar-tabs">
        <button
          className={`toolbar-tab${activeTab === "overview" ? " active" : ""}`}
          onClick={() => onTabChange("overview")}
        >
          Overview
        </button>
        <button
          className={`toolbar-tab${activeTab === "models" ? " active" : ""}`}
          onClick={() => onTabChange("models")}
        >
          Models
        </button>
        <button
          className={`toolbar-tab${activeTab === "valuesets" ? " active" : ""}`}
          onClick={() => onTabChange("valuesets")}
        >
          Value Sets
        </button>
      </div>

      <div className="toolbar-separator" />

      <button onClick={onValidate}>Validate</button>
      <button className="primary" onClick={onExportFSH}>Export FSH</button>
      <button onClick={onSaveSpace}>Save Space</button>
    </div>
  );
}
