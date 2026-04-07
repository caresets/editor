import { useState } from "react";
import type { Space } from "../types";
import { exportModelFSH } from "../utils";
import { commitFiles } from "../github";

interface Props {
  space: Space;
  onClose: () => void;
}

export function CommitDialog({ space, onClose }: Props) {
  const gh = space.github;
  const [owner, setOwner] = useState(gh?.owner || "");
  const [repo, setRepo] = useState(gh?.repo || "");
  const [branch, setBranch] = useState(gh?.branch || "master");
  const [modelsPath, setModelsPath] = useState(gh?.path || "input/fsh/models");
  const [message, setMessage] = useState("Update logical models");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleCommit() {
    setLoading(true);
    setResult(null);

    try {
      // Build one .fsh file per model
      const files = space.models.map((model) => ({
        path: `${modelsPath}/${model.name}.fsh`,
        content: exportModelFSH(model),
      }));

      if (files.length === 0) {
        setResult({ ok: false, text: "No models to commit." });
        setLoading(false);
        return;
      }

      const sha = await commitFiles({
        owner,
        repo,
        branch,
        message,
        files,
      });

      setResult({ ok: true, text: `Committed ${files.length} file(s). ${sha}` });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "Commit failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Commit to GitHub</h2>

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
            <label>Branch</label>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>
          <div className="prop-row">
            <label>Models path</label>
            <input value={modelsPath} onChange={(e) => setModelsPath(e.target.value)} />
          </div>
          <div className="prop-row">
            <label>Message</label>
            <input value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>

        {/* Preview */}
        <div className="commit-preview">
          <div className="commit-preview-header">
            Files to commit ({space.models.length}):
          </div>
          {space.models.map((m) => (
            <div key={m.id} className="commit-preview-file">
              {modelsPath}/{m.name}.fsh
            </div>
          ))}
        </div>

        {result && (
          <div className={`commit-result ${result.ok ? "commit-ok" : "commit-err"}`}>
            {result.text}
          </div>
        )}

        <div className="dialog-actions" style={{ gap: 8 }}>
          <button onClick={onClose}>Cancel</button>
          <button
            className="dialog-browse-btn"
            onClick={handleCommit}
            disabled={!owner || !repo || !message || loading}
          >
            {loading ? "Committing..." : "Commit"}
          </button>
        </div>
      </div>
    </div>
  );
}
