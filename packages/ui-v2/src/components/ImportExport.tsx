import React, { useState } from "react";
import { useFlowStore } from "../state/flowStore";
import { exportFlowToYaml, importFlowFromYaml, validateFlow } from "../utils/yaml";

const ImportExport: React.FC = () => {
  const flow = useFlowStore((s) => s.flow);
  const setFlowName = useFlowStore((s) => s.setFlowName);
  const setFlow = useFlowStore((s) => s.setFlow);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const doExport = () => {
    const errors = validateFlow(flow);
    if (errors.length) {
      setMessage(`Fix errors before export: ${errors[0]}`);
      return;
    }
    const yaml = exportFlowToYaml(flow);
    setText(yaml);
    setMessage("Exported current flow to YAML.");
  };

  const doImport = () => {
    try {
      const imported = importFlowFromYaml(text);
      setFlow(imported);
      setFlowName(imported.name);
      setMessage("Imported flow from YAML.");
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Import / Export</h3>
        {message && <span className="badge">{message}</span>}
      </div>
      <div className="row">
        <button className="button" onClick={doExport}>
          Export YAML
        </button>
        <button className="button secondary" onClick={doImport}>
          Import YAML
        </button>
      </div>
      <textarea
        style={{
          minHeight: 220,
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--panel-border)",
          color: "var(--text)",
          borderRadius: 12,
          padding: 10,
          fontFamily: "ui-monospace",
          fontSize: 13
        }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste runner YAML here"
      />
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        Format matches runner config: version, inputs, closures, flows[].steps (with cases/otherwise).
      </p>
    </div>
  );
};

export default ImportExport;
