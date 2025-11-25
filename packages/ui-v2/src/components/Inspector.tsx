import React, { useMemo } from "react";
import { useFlowStore } from "../state/flowStore";
import { Node } from "../types";

const Inspector: React.FC = () => {
  const selectedId = useFlowStore((s) => s.selection.nodeId);
  const selectedEdge = useFlowStore((s) => s.selection.edgeId);
  const flow = useFlowStore((s) => s.flows.find((f) => f.id === s.activeFlowId)!);
  const updateNode = useFlowStore((s) => s.updateNode);
  const connectParam = useFlowStore((s) => s.connectParam);
  const deleteEdge = useFlowStore((s) => s.deleteEdge);
  const deleteNode = useFlowStore((s) => s.deleteNode);

  const node = useMemo(() => flow.nodes.find((n) => n.id === selectedId), [flow.nodes, selectedId]);

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
      {node.kind === "branch" && <BranchConfig node={node} />}
      {node.kind === "closure" && <ClosureConfig node={node} />}
      {node.kind === "closure" && (
        <ParamBindings
          node={node}
          upstream={flow.nodes.filter((n) => n.kind === "closure" || n.kind === "branch")}
          edges={flow.edges}
          onBind={(param, from) => connectParam(node.id, param, from)}
        />
      )}
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

const ClosureConfig: React.FC<{ node: Node }> = ({ node }) => {
  const updateNode = useFlowStore((s) => s.updateNode);
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
    </div>
  );
};

const ParamBindings: React.FC<{
  node: Node;
  upstream: Node[];
  edges: any[];
  onBind: (param: string, from: string | null) => void;
}> = ({ node, upstream, edges, onBind }) => {
  const params = Object.keys(node.data?.params ?? {}).length ? Object.keys(node.data?.params ?? {}) : ["value"];
  return (
    <div className="stack">
      <h3 style={{ margin: 0 }}>Parameters</h3>
      {params.map((p) => {
        const existing = edges.find((e) => e.kind === "param" && e.to === node.id && e.label === p);
        return (
          <div key={p} className="stack" style={{ border: "1px solid var(--panel-border)", borderRadius: 10, padding: 8 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600 }}>{p}</span>
              {existing && <span className="badge">bound from {existing.from}</span>}
            </div>
            <div className="row">
              <select
                className="input"
                style={{ flex: 1 }}
                value={existing?.from ?? ""}
                onChange={(e) => onBind(p, e.target.value || null)}
              >
                <option value="">— static —</option>
                {upstream
                  .filter((n) => n.id !== node.id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        );
      })}
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        Bind a parameter to a closure output (replacement for $call). Leave empty for static config.
      </p>
    </div>
  );
};

export default Inspector;
