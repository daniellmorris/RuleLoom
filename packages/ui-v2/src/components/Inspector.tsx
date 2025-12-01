import React, { useMemo } from "react";
import { useFlowStore } from "../state/flowStore";
import { Node } from "../types";
const PARAM_COLORS = ["#7dd3fc", "#fbbf24", "#a78bfa", "#34d399", "#f87171", "#38bdf8"];

const Inspector: React.FC = () => {
  const selectedId = useFlowStore((s) => s.selection.nodeId);
  const selectedEdge = useFlowStore((s) => s.selection.edgeId);
  const mode = useFlowStore((s) => s.activeMode);
  const flow =
    mode === "closure"
      ? useFlowStore((s) => s.closures.find((f) => f.id === s.activeClosureId) ?? s.closures[0])
      : useFlowStore((s) => s.flows.find((f) => f.id === s.activeFlowId) ?? s.flows[0]);
  const flowNodes = flow?.nodes ?? [];
  const flowEdges = flow?.edges ?? [];
  const closuresMeta = useFlowStore((s) => s.closuresMeta);
  const inputsMeta = useFlowStore((s) => s.inputsMeta);
  const updateNode = useFlowStore((s) => s.updateNode);
  const connectParam = useFlowStore((s) => s.connectParam);
  const deleteEdge = useFlowStore((s) => s.deleteEdge);
  const deleteNode = useFlowStore((s) => s.deleteNode);

  const node = useMemo(() => flowNodes.find((n) => n.id === selectedId), [flowNodes, selectedId]);

  if (!flow) {
    return (
      <div className="panel">
        <h3>Inspector</h3>
        <p style={{ color: "var(--muted)" }}>No {mode} selected.</p>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="panel">
        <h3>Inspector</h3>
        {selectedEdge ? (
          <div className="stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="pill">Edge</span>
              <button className="button secondary" onClick={() => deleteEdge(selectedEdge)}>
                Delete edge
              </button>
            </div>
            <p style={{ color: "var(--muted)" }}>Edge id: {selectedEdge}</p>
          </div>
        ) : (
          <p style={{ color: "var(--muted)" }}>Select a node or edge to edit configuration.</p>
        )}
      </div>
    );
  }

  const updateLabel = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNode(node.id, { label: e.target.value });
  };

  return (
    <div className="panel stack">
      <div>
        <h3>Inspector</h3>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="pill">{node.kind}</span>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>#{node.id}</span>
          <button className="button secondary" onClick={() => deleteNode(node.id)}>
            Delete node
          </button>
        </div>
      </div>

      <label className="stack">
        <span style={{ color: "var(--muted)", fontSize: 12 }}>Label</span>
        <input className="input" value={node.label} onChange={updateLabel} />
      </label>

      {node.kind === "input" && <SchemaEditor node={node} />}
      {node.kind === "input" && <InputConfig node={node} meta={inputsMeta[node.label]} />}
      {node.kind === "branch" && <BranchConfig node={node} />}
      {node.kind === "closure" && (
        <ClosureConfig
          node={node}
          meta={closuresMeta[node.data?.closureName ?? ""]}
          upstream={flow.nodes.filter((n) => n.kind === "closure" || n.kind === "branch")}
          edges={flow.edges}
          onBind={(param, from) => connectParam(node.id, param, from)}
        />
      )}
    </div>
  );
};

const InputConfig: React.FC<{ node: Node; meta?: any }> = ({ node, meta }) => {
  const updateNode = useFlowStore((s) => s.updateNode);
  const schemaProps = (meta?.schema?.properties as Record<string, any>) ?? {};
  const required = meta?.schema?.required ?? [];
  const entries = Object.entries(schemaProps);
  if (!entries.length) {
    return (
      <div className="stack">
        <h3 style={{ margin: 0 }}>Input Config</h3>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>No schema provided.</div>
      </div>
    );
  }
  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>Input Config</h3>
      {entries.map(([key, val]) => (
        <div key={key} className="stack" style={{ border: "1px solid var(--panel-border)", borderRadius: 10, padding: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600 }}>{key}</span>
            <span className="badge">{val.type ?? "any"}</span>
          </div>
          <input
            className="input"
            placeholder={val.description ?? key}
            value={(node.data?.params as any)?.[key] ?? ""}
            onChange={(e) =>
              updateNode(node.id, {
                data: { ...node.data, params: { ...(node.data?.params ?? {}), [key]: e.target.value } }
              })
            }
          />
          {required.includes(key) && <span className="badge" style={{ color: "#fbbf24" }}>required</span>}
          {val.description && <div style={{ color: "var(--muted)", fontSize: 12 }}>{val.description}</div>}
        </div>
      ))}
    </div>
  );
};

const SchemaEditor: React.FC<{ node: Node }> = ({ node }) => {
  const updateNode = useFlowStore((s) => s.updateNode);
  const schemaText = JSON.stringify(node.data?.schema ?? {}, null, 2);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const parsed = JSON.parse(e.target.value || "{}");
      updateNode(node.id, { data: { ...node.data, schema: parsed } });
    } catch {
      // ignore invalid JSON; keep optimistic typing
    }
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Input Schema</h3>
        <span className="badge">JSON Schema</span>
      </div>
      <textarea
        style={{
          minHeight: 180,
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--panel-border)",
          color: "var(--text)",
          borderRadius: 12,
          padding: 10,
          fontFamily: "ui-monospace",
          fontSize: 13
        }}
        defaultValue={schemaText}
        onChange={onChange}
      />
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        Schema drives the available connector parameters and validation.
      </p>
    </div>
  );
};

const BranchConfig: React.FC<{ node: Node }> = ({ node }) => {
  const updateNode = useFlowStore((s) => s.updateNode);
  const rules = node.data?.branchRules ?? [];

  const updateRule = (idx: number, field: "label" | "condition", value: string) => {
    const next = rules.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    updateNode(node.id, { data: { ...node.data, branchRules: next } });
  };

  const addRule = () => {
    updateNode(node.id, { data: { ...node.data, branchRules: [...rules, { label: "branch", condition: "" }] } });
  };

  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>Branch Rules</h3>
      <div className="stack">
        {rules.map((rule, idx) => (
          <div key={idx} className="row" style={{ alignItems: "stretch" }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={rule.label}
              onChange={(e) => updateRule(idx, "label", e.target.value)}
              placeholder="label"
            />
            <input
              className="input"
              style={{ flex: 2 }}
              value={rule.condition}
              onChange={(e) => updateRule(idx, "condition", e.target.value)}
              placeholder="condition expression"
            />
          </div>
        ))}
      </div>
      <button className="button secondary" onClick={addRule}>
        Add branch path
      </button>
      <p style={{ color: "var(--muted)", fontSize: 12 }}>Branches render as labeled connectors on the canvas.</p>
    </div>
  );
};

const ClosureConfig: React.FC<{
  node: Node;
  meta?: any;
  upstream: Node[];
  edges: any[];
  onBind: (param: string, from: string | null) => void;
}> = ({ node, meta, upstream, edges, onBind }) => {
  const updateNode = useFlowStore((s) => s.updateNode);
  const paramsMeta = node.data?.parametersMeta ?? meta?.signature?.parameters ?? [];
  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>Closure</h3>
      <input
        className="input"
        placeholder="closure name"
        value={node.data?.closureName ?? ""}
        onChange={(e) => updateNode(node.id, { data: { ...node.data, closureName: e.target.value } })}
      />
      <textarea
        style={{
          minHeight: 110,
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--panel-border)",
          color: "var(--text)",
          borderRadius: 12,
          padding: 10,
          fontFamily: "ui-monospace",
          fontSize: 13
        }}
        placeholder="Describe closureParameters / first step connector"
        defaultValue={node.data?.description ?? ""}
        onChange={(e) => updateNode(node.id, { data: { ...node.data, description: e.target.value } })}
      />
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        Use closureParameter connector for first node selection in a step list.
      </p>
      <ParameterList node={node} upstream={upstream} edges={edges} meta={meta} onBind={onBind} updateNode={updateNode} />
    </div>
  );
};

const ParameterList: React.FC<{
  node: Node;
  upstream: Node[];
  edges: any[];
  meta?: any;
  onBind: (param: string, from: string | null) => void;
  updateNode: (id: string, patch: Partial<Node>) => void;
}> = ({ node, upstream, edges, meta, onBind, updateNode }) => {
  const paramsMeta = (node.data?.parametersMeta ?? meta?.signature?.parameters ?? []) ?? [];
  const params = paramsMeta.length > 0 ? paramsMeta.map((p: any) => p.name) : Object.keys(node.data?.params ?? {});
  if (!params.length) return null;
  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>Parameters</h3>
      {params.map((p: string, idx: number) => {
        const metaEntry = paramsMeta.find((m: any) => m.name === p);
        const existing = edges.find((e) => e.kind === "param" && e.to === node.id && e.label === p);
        const bound = Boolean(existing);
        const callMode = Boolean((node.data as any)?.paramCalls?.[p]);
        const color = PARAM_COLORS[idx % PARAM_COLORS.length];
        return (
          <div key={p} className="stack" style={{ border: `1px solid ${color}`, borderRadius: 10, padding: 8 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600 }}>{p}</span>
              <span className="badge" style={{ borderColor: color, color }}>
                {metaEntry?.type ?? "any"}
              </span>
            </div>
            {metaEntry?.type === "flowSteps" ? (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Connect a closureParameter edge for this nested flow.
              </div>
            ) : (
              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder={metaEntry?.description ?? p}
                  value={(node.data?.params as any)?.[p] ?? ""}
                  onChange={(e) => {
                    if (bound) return;
                    updateNode(node.id, {
                      data: { ...node.data, params: { ...(node.data?.params ?? {}), [p]: e.target.value } }
                    });
                  }}
                  disabled={bound}
                />
                <label className="row" style={{ gap: 4, color: "var(--muted)", fontSize: 12 }}>
                  <input
                    type="checkbox"
                  checked={callMode}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const state = useFlowStore.getState();
                    // clear any existing binding when toggling
                    onBind(p, null);
                    const paramCalls = { ...(node.data as any)?.paramCalls, [p]: checked };
                    state.updateNode(node.id, { data: { ...node.data, paramCalls } });
                  }}
                />
                  $call
                </label>
              </div>
            )}
            {metaEntry?.required && <span className="badge" style={{ color: "#fbbf24" }}>required</span>}
            {metaEntry?.description && <div style={{ color: "var(--muted)", fontSize: 12 }}>{metaEntry.description}</div>}
          </div>
        );
      })}
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        Check $call to bind this parameter to an upstream closure output; otherwise set a static value.
      </p>
    </div>
  );
};

export default Inspector;
