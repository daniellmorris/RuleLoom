import React, { useState } from "react";
import { useAppStore } from "../state/appStore";

const ImportExport: React.FC = () => {
  const loadYaml = useAppStore((s) => s.loadYaml);
  const toYaml = useAppStore((s) => s.toYaml);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const doImport = () => {
    try {
      loadYaml(text);
      setMessage("Imported YAML");
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`);
    }
  };

  const doExport = () => {
    try {
      const y = toYaml();
      setText(y);
      setMessage("Exported YAML");
    } catch (err) {
      setMessage(`Export failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Import / Export</h3>
        {message && <span className="badge">{message}</span>}
      </div>
      <div className="row">
        <button className="button" onClick={doExport}>Export Package</button>
        <button className="button secondary" onClick={doImport}>Import Package</button>
      </div>
      <textarea
        style={{ minHeight: 220, width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--panel-border)", color: "var(--text)", borderRadius: 12, padding: 10, fontFamily: "ui-monospace", fontSize: 13 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste runner YAML here"
      />
      <p style={{ color: "var(--muted)", fontSize: 12 }}>YAML mirrors runner config plus optional $meta on steps/disconnected.</p>
    </div>
  );
};

export default ImportExport;
