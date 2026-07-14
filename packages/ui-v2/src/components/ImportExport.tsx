import React, { useState } from "react";
import { useAppStore } from "../state/appStore";
import { useCatalogStore } from "../state/catalogStore";
import { validateApp } from "../utils/validation";
import type { ComponentRegistry } from "../utils/componentRegistry";

const ImportExport: React.FC<{ registry?: ComponentRegistry }> = ({ registry }) => {
  const app = useAppStore((s) => s.app);
  const loadYaml = useAppStore((s) => s.loadYaml);
  const toYaml = useAppStore((s) => s.toYaml);
  const closuresMeta = useCatalogStore((s) => s.closuresMeta);
  const inputsMeta = useCatalogStore((s) => s.inputsMeta);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const pluginValidators = React.useMemo(() => registry?.extensions("validator").map((entry) => entry.value) ?? [], [registry]);
  const transformers = React.useMemo(() => registry?.extensions("transformer").map((entry) => entry.value) ?? [], [registry]);
  const validation = React.useMemo(() => validateApp(app, { closuresMeta, inputsMeta }, pluginValidators), [app, closuresMeta, inputsMeta, pluginValidators]);
  const validationErrorCount = validation.issues.filter((issue) => issue.severity === "error").length;

  const doImport = () => {
    try {
      const nextText = applyBeforeImport(text, transformers);
      loadYaml(nextText);
      setMessage("Imported YAML");
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`);
    }
  };

  const doExport = () => {
    try {
      const y = applyBeforeExport(toYaml(), transformers, { app, validation });
      setText(y);
      setMessage(validationErrorCount > 0 ? `Exported with ${validationErrorCount} validation issue${validationErrorCount === 1 ? "" : "s"}` : "Exported YAML");
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
      {validationErrorCount > 0 && (
        <div className="validation-summary">
          Export warning: {validationErrorCount} validation issue{validationErrorCount === 1 ? "" : "s"} found.
        </div>
      )}
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

export function applyBeforeImport(text: string, transformers: any[]): string {
  return transformers.reduce((current, transformer) => {
    const fn = typeof transformer === "function" ? transformer : transformer?.beforeImport;
    const result = fn?.(current);
    return typeof result === "string" ? result : current;
  }, text);
}

export function applyBeforeExport(text: string, transformers: any[], context: Record<string, any>): string {
  return transformers.reduce((current, transformer) => {
    const fn = typeof transformer === "function" ? transformer : transformer?.beforeExport;
    const result = fn?.(current, context);
    return typeof result === "string" ? result : current;
  }, text);
}
