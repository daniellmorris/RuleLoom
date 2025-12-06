import React from "react";
import { useFlowStore } from "../state/flowStore";
import { useAppStore } from "../state/appStore";
import { useCatalogStore } from "../state/catalogStore";
import { buildGraph } from "../utils/graph";

type ParamMeta = { name: string; type?: string; required?: boolean; enum?: string[] };

function resolveStep(flow: any, path: string | null): any | null {
  if (!path) return null;
  const parts = path.split('.');
  let cur: any = { steps: flow.steps, $ui: flow.$ui, parameters: flow.parameters };
  for (const part of parts) {
    const mSteps = part.match(/^steps\[(\d+)\]$/);
    if (mSteps) { cur = cur?.steps?.[Number(mSteps[1])]; continue; }
    const mCases = part.match(/^cases\[(\d+)\]$/);
    if (mCases) { cur = cur?.cases?.[Number(mCases[1])]; continue; }
    if (part === 'otherwise') { cur = cur?.otherwise; continue; }
    if (part === 'parameters') { cur = cur?.parameters; continue; }
    if (cur?.parameters && Object.prototype.hasOwnProperty.call(cur.parameters, part)) { cur = cur.parameters[part]; continue; }
    if (part === '$call') { cur = cur?.$call; continue; }
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
  const graph = flow ? buildGraph(flow as any, app.inputs) : { pathById: {} as Record<string, string>, nodes: [] as any[] };

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
            <ParamRow
              key={p.name}
              param={p}
              value={input?.config?.[p.name]}
              onValue={(val) => updateInputConfig(inputIdx, p.name, val)}
              onCallToggle={() => null}
              onInitFlowSteps={() => null}
            />
          ))}
          <strong>Trigger</strong>
          {triggerParams.map((p) => (
            <ParamRow
              key={p.name}
              param={p}
              value={trigger?.[p.name]}
              onValue={(val) => updateTriggerField(selection, p.name, val)}
              onCallToggle={() => null}
              onInitFlowSteps={() => null}
            />
          ))}
        </div>
      </div>
    );
  }

  // Step editing
  const step = resolveStep(flow, selection);
  const node =
    selection &&
    (graph.nodes as any[]).find((n) => (graph.pathById as Record<string, string>)[n.id] === selection || n.id === selection);
  const nodeLabel = node?.label;
  const closureName =
    step?.closure ??
    (typeof step?.type === "string" ? step.type : undefined) ??
    (typeof step?.label === "string" ? step.label : undefined) ??
    nodeLabel;
  const title = closureName || selection || "";
  const meta = catalog.closuresMeta[closureName ?? ""] ?? {};
  const metaParams: ParamMeta[] = meta.signature?.parameters ?? [];
  const fallbackParams: ParamMeta[] = Object.keys(step?.parameters ?? {}).map((name) => {
    const val = step?.parameters?.[name];
    const isFlow = typeof val === "object" && val !== null && Array.isArray((val as any).steps);
    const isCallFlow = typeof val === "object" && val !== null && typeof (val as any).$call === "object" && Array.isArray((val as any).$call.steps);
    return { name, type: isFlow || isCallFlow ? "flowSteps" : "string" };
  });
  const params: ParamMeta[] = metaParams.length ? metaParams : fallbackParams;

  return (
    <div className="panel">
      <h3>Inspector</h3>
      <p style={{ color: "var(--muted)" }}>{title}</p>
      <div className="stack" style={{ gap: 8 }}>
        {params.map((p) => (
          <ParamRow
            key={p.name}
            param={p}
            value={step?.parameters?.[p.name]}
            onValue={(val) => updateStepParam(flow.name, selection, p.name, val)}
            onCallToggle={(enabled) =>
              updateStepParam(flow.name, selection, p.name, enabled ? { $call: "" } : "")
            }
            onInitFlowSteps={() => updateStepParam(flow.name, selection, p.name, { steps: [] })}
            allowCall
          />
        ))}
      </div>
    </div>
  );
};

const ParamRow: React.FC<{
  param: ParamMeta;
  value: any;
  onValue: (v: any) => void;
  onCallToggle: (enabled: boolean) => void;
  onInitFlowSteps: () => void;
  allowCall?: boolean;
}> = ({ param, value, onValue, onCallToggle, onInitFlowSteps, allowCall }) => {
  const isFlowSteps = param.type === "flowSteps";
  const isCall = typeof value === "object" && value !== null && "$call" in value;
  const baseValue = isCall ? (value as any).$call : value;

  const field =
    isFlowSteps || isCall ? (
      <input className="input" value="(connected)" readOnly disabled />
    ) : param.enum && param.enum.length ? (
      <select className="input" value={baseValue ?? ""} onChange={(e) => onValue(e.target.value)}>
        <option value="">(select)</option>
        {param.enum.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    ) : (
      <input className="input" value={baseValue ?? ""} onChange={(e) => onValue(e.target.value)} />
    );

  return (
    <div className="stack" style={{ gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{param.name}</span>
        {allowCall && param.type !== "flowSteps" && (
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={isCall}
              onChange={(e) => onCallToggle(e.target.checked)}
              style={{ verticalAlign: "middle" }}
            />
            $call
          </label>
        )}
        {isFlowSteps && (
          <button className="button tertiary" style={{ marginLeft: "auto" }} onClick={onInitFlowSteps}>
            init steps
          </button>
        )}
      </div>
      {field}
    </div>
  );
};

export default Inspector;
