import React, { useState } from "react";
import { useFlowStore } from "../state/flowStore";
import { usePackageStore } from "../state/packageStore";
import { exportFlowToYaml, importFlowFromYaml, validateFlow } from "../utils/yaml";

const ImportExport: React.FC = () => {
  const flow = useFlowStore((s) => s.flow);
  const setFlowName = useFlowStore((s) => s.setFlowName);
  const setFlow = useFlowStore((s) => s.setFlow);
  const pkgExport = usePackageStore((s) => s.exportPackage);
  const pkgImport = usePackageStore((s) => s.importPackage);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const doPkgExport = () => {
    try {
      const y = pkgExport();
      setText(y);
      setMessage("Exported package YAML.");
    } catch (err) {
      setMessage(`Package export failed: ${(err as Error).message}`);
    }
  };

  const doPkgImport = () => {
    try {
      pkgImport(text);
      setMessage("Imported package YAML.");
    } catch (err) {
      setMessage(`Package import failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Import / Export</h3>
        {message && <span className="badge">{message}</span>}
      </div>
      <div className="row">
        <button className="button" onClick={doPkgExport}>
          Export Package
        </button>
        <button className="button secondary" onClick={doPkgImport}>
          Import Package
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
