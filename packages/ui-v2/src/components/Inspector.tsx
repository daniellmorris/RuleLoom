import React from "react";
import { useFlowStore } from "../state/flowStore";
import { useAppStore } from "../state/appStore";
import { useCatalogStore } from "../state/catalogStore";
import { buildGraph } from "../utils/graph";
import { buildNodeIndex } from "../state/appStore";

type ParamMeta = { name: string; type?: string; required?: boolean; enum?: string[]; children?: ParamMeta[]; skipTemplateResolution?: boolean };

function findTriggerById(app: any, flowName: string | undefined, triggerId: string) {
  if (!flowName) return null;
  for (let i = 0; i < (app.inputs ?? []).length; i++) {
    const triggers = app.inputs[i]?.triggers ?? [];
    for (let t = 0; t < triggers.length; t++) {
      if (triggers[t]?.flow === flowName && triggers[t]?.$ui?.id === triggerId) {
        return { inputIdx: i, triggerIdx: t };
      }
    }
  }
  return null;
}

const Inspector: React.FC = () => {
  const selection = useFlowStore((s) => s.selection.nodeId);
  const app = useAppStore((s) => s.app);
  const mode = useFlowStore((s) => s.activeMode);
  const flowIdx = useFlowStore((s) => (s.activeMode === "flow" ? s.activeFlowId : s.activeClosureId));
  const updateStepParam = useAppStore((s) => s.updateStepParam);
  const updateTriggerField = useAppStore((s) => s.updateTriggerField);
  const updateInputConfig = useAppStore((s) => s.updateInputConfig);
  const catalog = useCatalogStore((s) => s);
  const flow = mode === "flow" ? app.flows[flowIdx] ?? app.flows[0] : app.closures[flowIdx] ?? app.closures[0];
  const graph = flow ? buildGraph(flow as any, app.inputs) : { pathById: {} as Record<string, string>, nodes: [] as any[] };
  const nodeIndex = flow ? buildNodeIndex(flow as any) : { byId: {}, idByPath: {}, pathById: {} };

  if (!selection || !flow) {
    return (
      <div className="panel">
        <h3>Inspector</h3>
        <p style={{ color: "var(--muted)" }}>Select a node to edit.</p>
      </div>
    );
  }

  // Input trigger editing
  const triggerLoc = findTriggerById(app, flow?.name, selection);
  if (triggerLoc) {
    const { inputIdx, triggerIdx } = triggerLoc;
    const input = app.inputs[inputIdx];
    const trigger = input?.triggers?.[triggerIdx];
    const meta = catalog.inputsMeta[input?.type ?? ""] ?? {};
    const triggerParams: ParamMeta[] = meta.triggerParameters ?? [];
    const configParams: ParamMeta[] = meta.configParameters ?? [];
    const currentFlowName = flow?.name;

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
              onValue={p.name === "flow" || p.type === "flow" ? () => null : (val) => updateTriggerField(selection, p.name, val)}
              lockedValue={p.name === "flow" || p.type === "flow" ? currentFlowName : undefined}
              readOnly={p.name === "flow" || p.type === "flow"}
              onCallToggle={() => null}
              onInitFlowSteps={() => null}
            />
          ))}
        </div>
      </div>
    );
  }

  // Step editing
  const stepLoc = nodeIndex.byId?.[selection];
  const step =
    stepLoc && stepLoc.kind === "step" && Array.isArray(stepLoc.arr) && typeof stepLoc.idx === "number" ? stepLoc.arr[stepLoc.idx] : null;
  const node = selection && (graph.nodes as any[]).find((n) => n.id === selection);
  const nodeLabel = node?.label;
  if (!step) {
    return (
      <div className="panel">
        <h3>Inspector</h3>
        <p style={{ color: "var(--muted)" }}>Select a step to edit its parameters.</p>
      </div>
    );
  }
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
            onInitFlowSteps={() => updateStepParam(flow.name, selection, p.name, [])}
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
  readOnly?: boolean;
  lockedValue?: any;
}> = ({ param, value, onValue, onCallToggle, onInitFlowSteps, allowCall, readOnly, lockedValue }) => {
  const isFlowSteps = param.type === "flowSteps";
  const isArray = param.type === "array";
  const isCall = typeof value === "object" && value !== null && "$call" in value;
  const baseValue = lockedValue ?? (isCall ? (value as any).$call : value);

  if (isArray) {
    const items: any[] = Array.isArray(baseValue) ? baseValue : [];
    const children = param.children ?? [];

    const addItem = () => {
      const next = [...items, createDefaultArrayItem(children)];
      onValue(next);
    };

    const updateItem = (idx: number, childName: string, childVal: any) => {
      const next = [...items];
      next[idx] = { ...(next[idx] ?? {}), [childName]: childVal };
      onValue(next);
    };

    const removeItem = (idx: number) => {
      const next = [...items];
      next.splice(idx, 1);
      onValue(next);
    };

    return (
      <div className="stack" style={{ gap: 6, border: "1px solid var(--border)", padding: 8, borderRadius: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{param.name} (array)</span>
          <button className="button tertiary" style={{ marginLeft: "auto" }} onClick={addItem}>
            + add
          </button>
        </div>
        {items.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>No items</div>}
        {items.map((item, idx) => (
          <div key={idx} className="stack" style={{ gap: 6, border: "1px dashed var(--border)", padding: 8, borderRadius: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>item {idx + 1}</span>
              <button className="button tertiary" style={{ marginLeft: "auto" }} onClick={() => removeItem(idx)}>
                delete
              </button>
            </div>
            {children.length === 0 ? (
              <input
                className="input"
                value={item ?? ""}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = e.target.value;
                  onValue(next);
                }}
              />
            ) : (
              children.map((child) => (
                <ParamRow
                  key={child.name}
                  param={child}
                  value={item?.[child.name]}
                  onValue={(val) => updateItem(idx, child.name, val)}
                  onCallToggle={(enabled) =>
                    updateItem(idx, child.name, enabled ? { $call: "" } : "")
                  }
                  onInitFlowSteps={() => updateItem(idx, child.name, [])}
                  allowCall
                />
              ))
            )}
          </div>
        ))}
      </div>
    );
  }

  const field =
    isFlowSteps || isCall || readOnly ? (
      <input className="input" value={baseValue ?? "(connected)"} readOnly disabled />
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
        {allowCall && !readOnly && param.type !== "flowSteps" && (
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

function createDefaultArrayItem(children: ParamMeta[]): any {
  if (!children || children.length === 0) return "";
  const obj: any = {};
  children.forEach((child) => {
    if (child.type === "flowSteps") {
      obj[child.name] = [];
    } else {
      obj[child.name] = "";
    }
  });
  return obj;
}
