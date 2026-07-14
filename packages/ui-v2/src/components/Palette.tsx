import React from "react";
import { useCatalogStore } from "../state/catalogStore";
import { useAppStore } from "../state/appStore";
import { useFlowStore } from "../state/flowStore";
import type { ComponentRegistry } from "../utils/componentRegistry";

const Palette: React.FC<{ registry?: ComponentRegistry }> = ({ registry }) => {
  const availableClosures = useCatalogStore((s) => s.availableClosures);
  const closuresMeta = useCatalogStore((s) => s.closuresMeta);
  const availableInputs = useCatalogStore((s) => s.availableInputs);
  const closureSources = useCatalogStore((s) => s.closureSources);
  const inputSources = useCatalogStore((s) => s.inputSources);
  const inputInstances = useAppStore((s) => s.app.inputs);
  const userClosures = useAppStore((s) => s.app.closures);
  const addTriggerToStore = useAppStore((s) => s.addTrigger);
  const addClosureStepToStore = useAppStore((s) => s.addClosureStep);
  const mode = useFlowStore((s) => s.activeMode);
  const flowIdx = useFlowStore((s) => (s.activeMode === "flow" ? s.activeFlowId : s.activeClosureId));
  const flowName = useAppStore((s) => (mode === "flow" ? s.app.flows[flowIdx]?.name : s.app.closures[flowIdx]?.name) ?? "Flow 1");
  const [closureSearch, setClosureSearch] = React.useState("");
  const paletteProviders = React.useMemo(() => registry?.extensions("paletteProvider") ?? [], [registry]);

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

  const shortGithubLabel = (source: string) => {
    const trimmed = source.replace(/^github:/, "");
    const [repoPart] = trimmed.split("@");
    const parts = repoPart.split("/").filter(Boolean);
    return parts[parts.length - 1] || "github";
  };

  const pluginLabel = (source?: string) => {
    if (!source) return "unknown";
    if (source.startsWith("repo:")) {
      const parts = source.split("/");
      return parts[parts.length - 1] || "repo";
    }
    if (source.startsWith("runtime:")) return source.replace(/^runtime:/, "") || "runtime";
    if (source.startsWith("github:")) return shortGithubLabel(source);
    return source;
  };

  const closureNamespace = (name: string) => {
    const meta = closuresMeta[name] ?? {};
    return meta.namespace ?? (name.includes(".") ? name.split(".")[0] : "global");
  };

  const closureShortName = (name: string) => {
    const namespace = closureNamespace(name);
    return name.startsWith(`${namespace}.`) ? name.slice(namespace.length + 1) : name;
  };

  const matchesClosureSearch = (name: string) => {
    const query = closureSearch.trim().toLowerCase();
    if (!query) return true;
    const meta = closuresMeta[name] ?? {};
    const values = [
      name,
      closureShortName(name),
      closureNamespace(name),
      ...(Array.isArray(meta.aliases) ? meta.aliases : []),
    ].map((value) => String(value).toLowerCase());
    return values.some((value) => value.includes(query));
  };

  const groupedClosures = closureNames.filter(matchesClosureSearch).reduce((acc, name) => {
    const label = closureNamespace(name);
    acc[label] = acc[label] ?? [];
    acc[label].push(name);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="panel stack">
      <h3>Palette</h3>
      <div className="stack">
        {mode === "flow" && inputInstances.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Input instances</div>
            {inputInstances.map((input, idx) => (
              <div key={`${input.type}-${input.id ?? idx}`} className="tag" title={`Input instance ${input.id ?? "(no id)"}`}>
                {input.type}
                {input.id ? `:${input.id}` : ""} · {(input.triggers ?? []).length} trigger{(input.triggers ?? []).length === 1 ? "" : "s"}
              </div>
            ))}
          </div>
        )}
        {mode === "flow" &&
          availableInputs.map((inp) => (
            <button key={inp} className="button" onClick={() => addTrigger(inp)}>
              Add {inp} instance{" "}
              <span className="badge" title={`Source: ${inputSources[inp] ?? "unknown"}`}>{pluginLabel(inputSources[inp] ?? "unknown")}</span>
            </button>
          ))}
        <input
          className="input"
          value={closureSearch}
          onChange={(event) => setClosureSearch(event.target.value)}
          placeholder="Search closures"
        />
        {Object.keys(groupedClosures).sort().map((label) => (
          <div key={label} className="stack" style={{ gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
            {(groupedClosures[label] ?? []).sort().map((c) => (
              <button key={c} className="button secondary" onClick={() => addClosure(c)} title={`Source: ${closureSources[c] ?? "unknown"}`}>
                Add {c} <span className="badge">{pluginLabel(closureSources[c])}</span>
              </button>
            ))}
          </div>
        ))}
        {paletteProviders.map((provider) => {
          const Provider = provider.value as React.ComponentType<any>;
          return <Provider key={`${provider.pluginId ?? "plugin"}-${provider.name}`} />;
        })}
      </div>
    </div>
  );
};

export default Palette;
