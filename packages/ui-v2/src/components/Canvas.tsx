import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFlowStore } from "../state/flowStore";
import { createNodeTemplate } from "../state/flowStore";
import { Node, Edge, Connector } from "../types";
import { getNodeColor } from "../styles/palette";
import clsx from "clsx";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const CONNECTOR_COLORS = ["#7dd3fc", "#fbbf24", "#a78bfa", "#34d399", "#f87171", "#38bdf8"];

const Canvas: React.FC = () => {
  const mode = useFlowStore((s) => s.activeMode);
  const flow =
    mode === "closure"
      ? useFlowStore((s) => s.closures.find((f) => f.id === s.activeClosureId) ?? s.closures[0])
      : useFlowStore((s) => s.flows.find((f) => f.id === s.activeFlowId) ?? s.flows[0]);
  const { nodes = [], edges = [] } = flow ?? { nodes: [], edges: [] };
  const closuresMeta = useFlowStore((s) => s.closuresMeta);
  const selectNode = useFlowStore((s) => s.selectNode);
  const selection = useFlowStore((s) => s.selection.nodeId);
  const selectedEdge = useFlowStore((s) => s.selection.edgeId);
  const updateNode = useFlowStore((s) => s.updateNode);
  const addNode = useFlowStore((s) => s.addNode);
  const layout = useFlowStore((s) => s.layout);
  const connect = useFlowStore((s) => s.connect);
  const selectEdge = useFlowStore((s) => s.selectEdge);
  const deleteEdge = useFlowStore((s) => s.deleteEdge);
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const [dragging, setDragging] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const nodesRef = useRef(nodes);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [linking, setLinking] = useState<{
    from: string;
    kind: Edge["kind"];
    label?: string;
    connectorId: string;
    x: number;
    y: number;
    startsAtParam?: boolean;
  } | null>(null);

  const pointerToCanvas = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      x: rect ? (clientX - rect.left - pan.x) / scale : clientX,
      y: rect ? (clientY - rect.top - pan.y) / scale : clientY
    };
  };

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (draggingRef.current) {
        const node = nodesRef.current.find((n) => n.id === draggingRef.current);
        if (!node) return;
        const pt = pointerToCanvas(event.clientX, event.clientY);
        const nextX = pt.x - offsetRef.current.x;
        const nextY = pt.y - offsetRef.current.y;
        updateNode(node.id, { x: nextX, y: nextY });
      } else if (panStartRef.current) {
        const dx = event.clientX - panStartRef.current.clientX;
        const dy = event.clientY - panStartRef.current.clientY;
        setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
      } else if (linking) {
        const pt = pointerToCanvas(event.clientX, event.clientY);
        setLinking((prev) => (prev ? { ...prev, x: pt.x, y: pt.y } : prev));
      }
    },
    [updateNode, pointerToCanvas, linking]
  );

  const onMouseUp = useCallback(() => {
    setDragging(null);
    draggingRef.current = null;
    panStartRef.current = null;
    setLinking(null);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const startDrag = (event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    const pt = pointerToCanvas(event.clientX, event.clientY);
    offsetRef.current = { x: pt.x - node.x, y: pt.y - node.y };
    setDragging(node.id);
    draggingRef.current = node.id;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData("application/node-kind") as any;
    if (!kind) return;
    const label = event.dataTransfer.getData("application/node-label") || undefined;
    const pt = pointerToCanvas(event.clientX, event.clientY);
    const x = pt.x - 90;
    const y = pt.y - 40;
    const template = createNodeTemplate(kind, x, y);
    addNode({ ...template, label: label ?? template.label, data: { ...template.data, closureName: label ?? template.label } });
  };

const startLink = (
  event: React.MouseEvent,
  node: Node,
  connectorId: string,
  direction: string,
  overrideKind?: Edge["kind"],
  startsAtParam?: boolean
) => {
  event.stopPropagation();
  event.preventDefault();
  const kind: Edge["kind"] =
    overrideKind ?? (direction === "dynamic" && node.kind === "branch" ? "branch" : direction === "param" ? "param" : "control");
  const label = kind === "param" ? connectorId : direction === "dynamic" ? connectorId : undefined;
  const pt = pointerToCanvas(event.clientX, event.clientY);
  setLinking({ from: node.id, kind, label, connectorId, x: pt.x, y: pt.y, startsAtParam });
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
};

const completeLink = (event: React.MouseEvent, targetNode: Node) => {
  if (!linking) return;
  event.stopPropagation();
  const to = targetNode.id;
  const from = linking.from;
  // prevent linking into inputs for control/branch/param
  if (targetNode.kind === "input" && linking.kind !== "param") {
    setLinking(null);
    return;
  }
  if (from !== to) {
    connect(from, to, linking.label, linking.kind);
  }
  setLinking(null);
};

  const startPan = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-node-id]")) return;
    event.preventDefault();
    panStartRef.current = { x: pan.x, y: pan.y, clientX: event.clientX, clientY: event.clientY };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    return () => {
    };
  }, []);

  const width = Math.max(...nodes.map((n) => n.x + NODE_WIDTH), 1200);
  const height = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT), 720);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - pan.x) / scale;
    const worldY = (mouseY - pan.y) / scale;
    const factor = Math.exp(-e.deltaY * 0.001);
    const nextScale = clamp(scale * factor, 0.5, 2.5);
    const nextPan = {
      x: mouseX - worldX * nextScale,
      y: mouseY - worldY * nextScale
    };
    setScale(nextScale);
    setPan(nextPan);
  };

  if (!flow) {
    return (
      <div className="panel" style={{ minHeight: "calc(100vh - 120px)" }}>
        <h3 style={{ margin: 0 }}>Canvas</h3>
        <p style={{ color: "var(--muted)" }}>No {mode} selected.</p>
      </div>
    );
  }

  return (
    <div
      className="panel"
      ref={containerRef}
      style={{
        position: "relative",
        minHeight: "calc(100vh - 120px)",
        height: "calc(100vh - 120px)",
        overflow: "hidden",
        overscrollBehavior: "contain",
        touchAction: "none",
        backgroundImage:
          "linear-gradient(var(--panel-border) 1px, transparent 1px), linear-gradient(90deg, var(--panel-border) 1px, transparent 1px)",
        backgroundSize: "var(--grid-size) var(--grid-size)"
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onMouseDown={startPan}
      onWheel={onWheel}
      onMouseMove={(e) => onMouseMove(e.nativeEvent)}
      onMouseUp={() => {
        // if linking and mouseup not on node, cancel preview
        if (linking) setLinking(null);
        onMouseUp();
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0"
        }}
      >
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
        >
          <defs>
            {CONNECTOR_COLORS.map((c, i) => (
              <marker
                key={i}
                id={`arrow-color-${i}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
              </marker>
            ))}
          </defs>
          {edges.map((edge) => (
            <EdgeLine key={edge.id} edge={edge} nodes={nodes} onClick={() => selectEdge(edge.id)} selected={selectedEdge === edge.id} closuresMeta={closuresMeta} />
          ))}
          {linking && (
            <EdgePreview
              fromNode={nodes.find((n) => n.id === linking.from)!}
              connectorId={linking.connectorId}
              x={linking.x}
              y={linking.y}
            />
          )}
        </svg>

        {nodes.map((node) => {
          const connectors = buildConnectors(node, closuresMeta[node.data?.closureName ?? ""]);
          return (
          <div
            key={node.id}
            data-node-id={node.id}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onClick={() => selectNode(node.id)}
            onMouseDown={(e) => startDrag(e, node)}
            className={clsx("node-card", selection === node.id && "selected")}
            style={{
              position: "absolute",
              left: node.x,
              top: node.y,
              width: NODE_WIDTH,
              minHeight: NODE_HEIGHT,
              borderRadius: 14,
              border:
                (node.kind === "input" && !edges.some((e) => (e.kind === "control" || e.kind === "branch") && e.from === node.id)) ||
                (node.kind !== "input" && !edges.some((e) => (e.kind === "control" || e.kind === "branch" || e.kind === "param") && e.to === node.id))
                  ? "2px solid #f87171"
                  : "1px solid var(--panel-border)",
              background: "rgba(255,255,255,0.03)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
            onMouseUp={(e) => completeLink(e, node)}
            onDoubleClick={() => deleteNode(node.id)}
          >
            {connectors.map((c, idx) => {
              const top = 24 + idx * 18;
              const color = CONNECTOR_COLORS[idx % CONNECTOR_COLORS.length];
              const isParamCall = (node.data as any)?.paramCalls?.[c.id];
                return (
                  <div
                    key={c.id}
                    data-connector-id={c.id}
                    onMouseDown={(e) => startLink(e, node, c.id, isParamCall ? "param" : c.direction, isParamCall ? "param" : undefined, false)}
                    onMouseUp={(e) => {
                      if (!linking || linking.from === node.id) return;
                      e.stopPropagation();
                      connect(linking.from, node.id, c.id, "param");
                      setLinking(null);
                    }}
                    style={{
                      position: "absolute",
                      left: NODE_WIDTH + 10,
                      top,
                      width: 12,
                    height: 12,
                    borderRadius: 6,
                    background: color,
                    transform: "translate(-50%,-50%)",
                    cursor: "crosshair"
                  }}
                  title={`${c.label} (${c.direction})`}
                />
              );
            })}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  background: getNodeColor(node.kind),
                  boxShadow: `0 0 0 4px ${getNodeColor(node.kind)}22`
                }}
              />
              <div style={{ fontWeight: 700 }}>{node.label}</div>
              <span className="badge" style={{ marginLeft: "auto" }}>
                {node.kind}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {connectors.map((c, idx) => (
                <span key={c.id} className="tag" style={{ borderColor: CONNECTOR_COLORS[idx % CONNECTOR_COLORS.length], color: CONNECTOR_COLORS[idx % CONNECTOR_COLORS.length] }}>
                  {c.label} • {c.direction}
                </span>
              ))}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

const EdgeLine: React.FC<{ edge: Edge; nodes: Node[]; closuresMeta: Record<string, any>; onClick?: () => void; selected?: boolean }> = ({
  edge,
  nodes,
  closuresMeta,
  onClick,
  selected
}) => {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return null;

  const fromConnectors = buildConnectors(from, closuresMeta[from.data?.closureName ?? ""]);
  const idx = connectorIndex(fromConnectors, edge.label);
  const startPoint = connectorPoint(from, idx);
  const startX = startPoint.x;
  const startY = startPoint.y;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;

  const midX = (startX + endX) / 2;

  const color = CONNECTOR_COLORS[idx % CONNECTOR_COLORS.length];
  const marker = `url(#arrow-color-${idx % CONNECTOR_COLORS.length})`;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{ cursor: "pointer", pointerEvents: "stroke" }}
    >
      <path
        d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
        stroke={selected ? "var(--accent-2)" : color}
        strokeWidth={selected ? 3 : 2}
        fill="none"
        strokeOpacity={0.9}
        markerEnd={marker}
      />
      {edge.label && (
        <text
          x={midX}
          y={(startY + endY) / 2 - 6}
          fill={color}
          fontSize={12}
          textAnchor="middle"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
};

const EdgePreview: React.FC<{ fromNode: Node; connectorId: string; x: number; y: number }> = ({
  fromNode,
  connectorId,
  x,
  y
}) => {
  const connectors = buildConnectors(fromNode, undefined);
  const idx = connectorIndex(connectors, connectorId);
  const start = connectorPoint(fromNode, idx);
  const startX = start.x;
  const startY = start.y;
  const midX = (startX + x) / 2;
  const color = CONNECTOR_COLORS[idx % CONNECTOR_COLORS.length];
  return (
    <path
      d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${y}, ${x} ${y}`}
      stroke={color}
      strokeWidth={2}
      fill="none"
      strokeDasharray="6 4"
      strokeOpacity={0.7}
    />
  );
};

function buildConnectors(node: Node, meta?: any): Connector[] {
  if (node.kind === "branch") {
    const rules = node.data?.branchRules ?? [];
    const dynamic = rules.map((r) => ({ id: r.label, label: r.label, direction: "dynamic" as const }));
    return [{ id: "next", label: "next", direction: "next" as const }, ...dynamic];
  }
  if (node.kind === "closure") {
    const flowParams =
      (node.data as any)?.closureParameters ??
      ((meta?.signature?.parameters ?? []).filter((p: any) => p.type === "flowSteps").map((p: any) => p.name) as string[]) ??
      [];
    const dyn = Array.isArray(flowParams)
      ? flowParams.map((p: string) => ({ id: p, label: p, direction: "dynamic" as const }))
      : [{ id: "closureParameter", label: "closureParameter", direction: "dynamic" as const }];
    const paramCalls = Object.entries((node.data as any)?.paramCalls ?? {})
      .filter(([, v]) => v)
      .map(([name]) => ({ id: name, label: name, direction: "param" as const }));
    return [{ id: "next", label: "next", direction: "next" as const }, ...dyn, ...paramCalls];
  }
  if (node.kind === "input") {
    return [{ id: "next", label: "next", direction: "next" as const }];
  }
  return node.connectors;
}

function connectorIndex(connectors: Connector[], id?: string) {
  if (!id) return 0;
  const idx = connectors.findIndex((c) => c.id === id);
  return idx >= 0 ? idx : 0;
}

function connectorPoint(node: Node, idx: number) {
  const top = node.y + 24 + idx * 18;
  const x = node.x + NODE_WIDTH + 10;
  return { x, y: top };
}

export default Canvas;
