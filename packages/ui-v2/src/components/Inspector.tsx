import React from "react";
import { useFlowStore } from "../state/flowStore";
import { useAppStore } from "../state/appStore";
import { useCatalogStore } from "../state/catalogStore";

type ParamMeta = { name: string; type?: string; required?: boolean; enum?: string[] };

function pathToStep(flow: any, path: string | null): any | null {
  if (!path || !path.startsWith("steps")) return null;
  const parts = path.split('.');
  let cur: any = flow.steps;
  for (const part of parts) {
    if (part.startsWith('steps[')) {
      const idx = Number(part.match(/steps\[(\d+)\]/)![1]);
      cur = cur[idx];
    } else if (part.startsWith('cases[')) {
      const idx = Number(part.match(/cases\[(\d+)\]/)![1]);
      cur = cur.cases[idx];
    } else if (part === 'otherwise') {
      cur = cur.otherwise;
    }
  }
  return cur ?? null;
}

function inputPathPieces(path: string) {
  const m = path.match(/inputs\[(\d+)\]\.triggers\[(\d+)\]/);
  if (!m) return null;
  return { inputIdx: Number(m[1]), triggerIdx: Number(m[2]) };
}

const Inspector: React.FC = () => {
  const selection = useFlowStore((s) => s.selection.nodePath);
  const app = useAppStore((s) => s.app);
  const flowIdx = useFlowStore((s) => s.activeFlowId);
  const updateStepParam = useAppStore((s) => s.updateStepParam);
  const updateTriggerField = useAppStore((s) => s.updateTriggerField);
  const updateInputConfig = useAppStore((s) => s.updateInputConfig);
  const catalog = useCatalogStore((s) => s);
  const flow = app.flows[flowIdx] ?? app.flows[0];

  if (!selection || !flow) {
    return (
      <div className="panel">
        <h3>Inspector</h3>
        <p style={{ color: "var(--muted)" }}>Select a node to edit.</p>
      </div>
    );
  }

  // Input trigger editing
  const inputPieces = inputPathPieces(selection);
  if (inputPieces) {
    const { inputIdx, triggerIdx } = inputPieces;
    const input = app.inputs[inputIdx];
    const trigger = input?.triggers?.[triggerIdx];
    const meta = catalog.inputsMeta[input?.type ?? ""] ?? {};
    const triggerParams: ParamMeta[] = meta.triggerParameters ?? [];
    const configParams: ParamMeta[] = meta.configParameters ?? [];

    return (
      <div className="panel">
        <h3>Input: {input?.type}</h3>
        <div className="stack" style={{ gap: 8 }}>
          <strong>Config</strong>
          {configParams.map((p) => (
            <ParamField
              key={p.name}
              label={p.name}
              meta={p}
              value={input?.config?.[p.name] ?? ""}
              onChange={(val) => updateInputConfig(inputIdx, p.name, val)}
            />
          ))}
          <strong>Trigger</strong>
          {triggerParams.map((p) => (
            <ParamField
              key={p.name}
              label={p.name}
              meta={p}
              value={trigger?.[p.name] ?? ""}
              onChange={(val) => updateTriggerField(selection, p.name, val)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Step editing
  const step = pathToStep(flow, selection);
  const meta = catalog.closuresMeta[step?.closure ?? ""] ?? {};
  const params: ParamMeta[] = meta.signature?.parameters ?? [];

  return (
    <div className="panel">
      <h3>Inspector</h3>
      <p style={{ color: "var(--muted)" }}>{step?.closure ?? selection}</p>
      <div className="stack" style={{ gap: 8 }}>
        {params.map((p) => (
          <ParamField
            key={p.name}
            label={p.name}
            meta={p}
            value={step?.parameters?.[p.name] ?? ""}
            onChange={(val) => updateStepParam(flow.name, selection, p.name, val)}
          />
        ))}
      </div>
    </div>
  );
};

const ParamField: React.FC<{ label: string; meta: ParamMeta; value: any; onChange: (v: any) => void }> = ({ label, meta, value, onChange }) => {
  if (meta.enum && meta.enum.length) {
    return (
      <label className="stack" style={{ gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
        <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">(select)</option>
          {meta.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="stack" style={{ gap: 4 }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
      <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
};

export default Inspector;
