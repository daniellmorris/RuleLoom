import React from "react";
import { useCatalogStore } from "../state/catalogStore";
import { useAppStore } from "../state/appStore";
import { useFlowStore } from "../state/flowStore";

const Palette: React.FC = () => {
  const availableClosures = useCatalogStore((s) => s.availableClosures);
  const availableInputs = useCatalogStore((s) => s.availableInputs);
  const closureSources = useCatalogStore((s) => s.closureSources);
  const inputSources = useCatalogStore((s) => s.inputSources);
  const userClosures = useAppStore((s) => s.app.closures);
  const addTriggerToStore = useAppStore((s) => s.addTrigger);
  const addClosureStepToStore = useAppStore((s) => s.addClosureStep);
  const mode = useFlowStore((s) => s.activeMode);
  const flowIdx = useFlowStore((s) => (s.activeMode === "flow" ? s.activeFlowId : s.activeClosureId));
  const flowName = useAppStore((s) => (mode === "flow" ? s.app.flows[flowIdx]?.name : s.app.closures[flowIdx]?.name) ?? "Flow 1");

  const addTrigger = (type: string) => {
    if (mode !== "flow") return;
    addTriggerToStore(type, flowName);
  };

  const addClosure = (name: string) => {
    addClosureStepToStore(mode === "closure" ? "closures" : "flows", flowIdx, name);
  };

  const closureNames = Array.from(new Set([
    ...availableClosures,
    ...userClosures.map((c) => c.name).filter(Boolean)
  ]));

  const groupLabel = (source?: string) => {
    if (!source) return "Unknown";
    if (source === "core") return "Core";
    if (source.startsWith("runtime:")) return "Runtime";
    if (source.startsWith("repo:")) return "Repo";
    return source;
  };

  const groupedClosures = closureNames.reduce((acc, name) => {
    const label = groupLabel(closureSources[name]);
    acc[label] = acc[label] ?? [];
    acc[label].push(name);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="panel stack">
      <h3>Palette</h3>
      <div className="stack">
        {mode === "flow" &&
          availableInputs.map((inp) => (
            <button key={inp} className="button" onClick={() => addTrigger(inp)}>
              Add {inp} trigger{" "}
              <span className="badge" title={`Source: ${inputSources[inp] ?? "unknown"}`}>{groupLabel(inputSources[inp] ?? "unknown")}</span>
            </button>
          ))}
        {Object.keys(groupedClosures).sort().map((label) => (
          <div key={label} className="stack" style={{ gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
            {(groupedClosures[label] ?? []).map((c) => (
              <button key={c} className="button secondary" onClick={() => addClosure(c)} title={`Source: ${closureSources[c] ?? "unknown"}`}>
                Add {c} <span className="badge">{label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Palette;
