import { useMemo, useState } from "react";
import type { Space } from "../types";
import { generateOverviewPlantUML, plantumlServerUrl } from "../utils";

interface Props {
  space: Space;
  onUpdateSource: (source: string) => void;
}

export function DiagramView({ space, onUpdateSource }: Props) {
  const [showSource, setShowSource] = useState(true);
  const [imgError, setImgError] = useState(false);

  const source = space.diagramSource;
  const hasSource = source.trim().length > 0;

  // Render URL derived from current (possibly hand-edited) source
  const imgUrl = useMemo(
    () => (hasSource ? plantumlServerUrl(source) : ""),
    [source, hasSource]
  );

  function handleGenerate() {
    const generated = generateOverviewPlantUML(space);
    onUpdateSource(generated);
    setImgError(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(source);
  }

  function handleDownloadSVG() {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `${space.name}-diagram.svg`;
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="diagram-view">
      <div className="diagram-toolbar">
        <button className="diagram-generate-btn" onClick={handleGenerate}>
          Generate from data
        </button>
        <div className="toolbar-separator" />
        <button
          className={!showSource ? "diagram-tab-active" : ""}
          onClick={() => { setShowSource(false); setImgError(false); }}
        >
          Diagram
        </button>
        <button
          className={showSource ? "diagram-tab-active" : ""}
          onClick={() => setShowSource(true)}
        >
          Source
        </button>
        <div className="toolbar-separator" />
        <button onClick={handleCopy} disabled={!hasSource}>Copy</button>
        <button onClick={handleDownloadSVG} disabled={!hasSource || showSource}>
          Download SVG
        </button>
      </div>

      {!hasSource ? (
        <div className="diagram-empty">
          Click <strong>Generate from data</strong> to create a diagram from your models,
          then edit the PlantUML source as needed.
        </div>
      ) : showSource ? (
        <textarea
          className="diagram-editor"
          value={source}
          onChange={(e) => onUpdateSource(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="diagram-image-container">
          {imgError ? (
            <div className="diagram-fallback">
              <p>Could not render diagram. Check PlantUML syntax in Source tab.</p>
            </div>
          ) : (
            <img
              src={imgUrl}
              alt="Model relationship diagram"
              className="diagram-image"
              onError={() => setImgError(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
