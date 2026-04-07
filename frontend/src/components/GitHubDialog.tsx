import { useState } from "react";
import { listGitHubFiles, fetchGitHubFile, parseFSH } from "../utils";
import type { LogicalModel, Space, ValueSetDef } from "../types";

interface Props {
  onLoadSpace: (partial: { models: LogicalModel[]; valueSets: ValueSetDef[]; github: Space["github"] }) => void;
  onClose: () => void;
}

interface FileEntry {
  name: string;
  download_url: string;
  source: "models" | "valuesets";
}

export function GitHubDialog({ onLoadSpace, onClose }: Props) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [modelsPath, setModelsPath] = useState("input/fsh/models");
  const [valueSetsPath, setValueSetsPath] = useState("input/fsh/terminology");
  const [branch, setBranch] = useState("master");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBrowse() {
    setLoading(true);
    setError("");
    const allFiles: FileEntry[] = [];

    // Browse models path
    try {
      const modelFiles = await listGitHubFiles(owner, repo, modelsPath, branch);
      allFiles.push(...modelFiles.map((f) => ({ ...f, source: "models" as const })));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("404")) {
        setError(msg);
        setLoading(false);
        return;
      }
      // 404 on models path is ok — maybe user only has valuesets
    }

    // Browse valuesets path
    try {
      const vsFiles = await listGitHubFiles(owner, repo, valueSetsPath, branch);
      allFiles.push(...vsFiles.map((f) => ({ ...f, source: "valuesets" as const })));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("404")) {
        setError(msg);
        setLoading(false);
        return;
      }
      // 404 on valuesets path is ok
    }

    if (allFiles.length === 0) {
      setError(`No files found. Check paths and branch "${branch}".`);
    }

    setFiles(allFiles);
    setSelected(new Set(allFiles.map((f) => f.download_url)));
    setLoading(false);
  }

  function toggleFile(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function handleLoad() {
    setLoading(true);
    setError("");
    const models: LogicalModel[] = [];
    const valueSets: ValueSetDef[] = [];

    try {
      for (const url of selected) {
        const data = await fetchGitHubFile(url);
        if (typeof data === "string") {
          const parsed = parseFSH(data);
          models.push(...parsed);
          continue;
        }
        const obj = data as Record<string, unknown>;
        if (obj.elements || obj.resourceType === "StructureDefinition") {
          if (!obj.id) obj.id = `model-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          models.push(obj as unknown as LogicalModel);
        } else if (obj.concepts || obj.resourceType === "ValueSet") {
          if (!obj.id) obj.id = `vs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          valueSets.push(obj as unknown as ValueSetDef);
        } else if (obj.models && obj.valueSets) {
          models.push(...(obj as unknown as { models: LogicalModel[] }).models);
          valueSets.push(...(obj as unknown as { valueSets: ValueSetDef[] }).valueSets);
        }
      }

      onLoadSpace({
        models,
        valueSets,
        github: { owner, repo, path: modelsPath, branch },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }

  const modelFiles = files.filter((f) => f.source === "models");
  const vsFiles = files.filter((f) => f.source === "valuesets");

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Load Space from GitHub</h2>
        <div className="dialog-form">
          <div className="prop-row">
            <label>Owner</label>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="hl7-be" />
          </div>
          <div className="prop-row">
            <label>Repo</label>
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="medication" />
          </div>
          <div className="prop-row">
            <label>Models path</label>
            <input value={modelsPath} onChange={(e) => setModelsPath(e.target.value)} />
          </div>
          <div className="prop-row">
            <label>ValueSets path</label>
            <input value={valueSetsPath} onChange={(e) => setValueSetsPath(e.target.value)} />
          </div>
          <div className="prop-row">
            <label>Branch</label>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>
          <button
            className="dialog-browse-btn"
            onClick={handleBrowse}
            disabled={!owner || !repo || loading}
          >
            {loading ? "Loading..." : "Browse"}
          </button>
        </div>

        {error && <div className="dialog-error">{error}</div>}

        {files.length > 0 && (
          <>
            {modelFiles.length > 0 && (
              <div className="dialog-file-group">
                <div className="dialog-file-group-header">
                  Models ({modelFiles.length})
                </div>
                <div className="dialog-file-list">
                  {modelFiles.map((f) => (
                    <label key={f.download_url} className="dialog-file-item">
                      <input
                        type="checkbox"
                        checked={selected.has(f.download_url)}
                        onChange={() => toggleFile(f.download_url)}
                      />
                      <span>{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {vsFiles.length > 0 && (
              <div className="dialog-file-group">
                <div className="dialog-file-group-header">
                  Value Sets ({vsFiles.length})
                </div>
                <div className="dialog-file-list">
                  {vsFiles.map((f) => (
                    <label key={f.download_url} className="dialog-file-item">
                      <input
                        type="checkbox"
                        checked={selected.has(f.download_url)}
                        onChange={() => toggleFile(f.download_url)}
                      />
                      <span>{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              className="dialog-browse-btn"
              onClick={handleLoad}
              disabled={selected.size === 0 || loading}
              style={{ marginTop: 12, marginBottom: 16 }}
            >
              {loading ? "Loading..." : `Load ${selected.size} file(s)`}
            </button>
          </>
        )}

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
