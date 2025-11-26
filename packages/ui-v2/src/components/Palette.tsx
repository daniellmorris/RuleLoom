import React from "react";
import { useFlowStore, createNodeTemplate } from "../state/flowStore";
import { NodeKind } from "../types";
import { getNodeColor } from "../styles/palette";

const Palette: React.FC = () => {
  const addNode = useFlowStore((s) => s.addNode);
  const availableClosures = useFlowStore((s) => s.availableClosures);
  const availableInputs = useFlowStore((s) => s.availableInputs);
  const registerPlugin = useFlowStore((s) => s.registerPlugin);
  const closuresMeta = useFlowStore((s) => s.closuresMeta);

  const handleAdd = (kind: NodeKind, label?: string) => {
    const x = 140 + Math.random() * 400;
    const y = 160 + Math.random() * 320;
    const template = createNodeTemplate(kind, x, y);
    if (kind === "closure" && label) {
      const meta = closuresMeta[label];
      const paramsMeta = meta?.signature?.parameters ?? [];
      const closureParameters = paramsMeta.filter((p: any) => p.type === "flowSteps").map((p: any) => p.name);
      addNode({
        ...template,
        label,
        data: {
          ...template.data,
          closureName: label,
          parametersMeta: paramsMeta,
          closureParameters,
          params: {}
        }
      });
    } else {
      addNode({ ...template, label: label ?? template.label, data: { ...template.data, closureName: label ?? template.label } });
    }
  };

  const loadPlugin = () => {
    // stub manifest
    registerPlugin({
      closures: ["payments.charge", "payments.refund", "risk.score"],
      inputs: ["scheduler"]
    });
  };

  return (
    <div className="panel stack">
      <div>
        <h3>Palette</h3>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
          Build flows by dropping node types. Colors map to node roles.
        </p>
      </div>

      <div className="legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: getNodeColor("input") }} />
          Input
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: getNodeColor("closure") }} />
          Closure
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: getNodeColor("branch") }} />
          Branch
        </div>
      </div>

      <div className="stack">
        {availableInputs.map((input) => (
          <div
            key={input}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/node-kind", "input");
              e.dataTransfer.setData("application/node-label", input);
              e.dataTransfer.effectAllowed = "copy";
            }}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 12px",
              border: "1px solid var(--panel-border)",
              borderRadius: 12
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{input}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Input</div>
            </div>
            <button className="button" onClick={() => handleAdd("input", input)}>
              Add
            </button>
          </div>
        ))}
        <div
          key="branch"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/node-kind", "branch");
            e.dataTransfer.effectAllowed = "copy";
          }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            border: "1px solid var(--panel-border)",
            borderRadius: 12
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>Branch</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Conditional split</div>
          </div>
          <button className="button" onClick={() => handleAdd("branch", "Branch")}>
            Add
          </button>
        </div>
        {availableClosures.map((c) => (
          <div
            key={c}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/node-kind", "closure");
              e.dataTransfer.setData("application/node-label", c);
              e.dataTransfer.effectAllowed = "copy";
            }}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 12px",
              border: "1px solid var(--panel-border)",
              borderRadius: 12
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{c}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Closure</div>
            </div>
            <button className="button" onClick={() => handleAdd("closure", c)}>
              Add
            </button>
          </div>
        ))}
      </div>

      <div className="panel" style={{ background: "rgba(255,255,255,0.02)" }}>
        <h3>Plugins</h3>
        <button className="button" onClick={loadPlugin}>
          Load sample plugin manifest
        </button>
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 0 }}>
          After loading, plugin closures/inputs appear above.
        </p>
      </div>

      <div className="panel" style={{ background: "rgba(255,255,255,0.02)" }}>
        <h3>Flow Templates</h3>
        <div className="row">
          <button className="button secondary">Import JSON</button>
          <button className="button secondary">Save as Template</button>
        </div>
      </div>
    </div>
  );
};

export default Palette;
