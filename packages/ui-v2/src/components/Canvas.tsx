import React, { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";
import { useFlowStore } from "../state/flowStore";
import { useAppStore } from "../state/appStore";
import { useCatalogStore } from "../state/catalogStore";
import { buildGraph } from "../utils/graph";
import { getNodeColor } from "../styles/palette";
import { Connector, Edge, Node } from "../types";

const NODE_WIDTH = 180;
const NODE_MIN_HEIGHT = 80;
const CONNECTOR_COLORS = ["#7dd3fc", "#fbbf24", "#a78bfa", "#34d399", "#f87171", "#38bdf8"];

const Canvas: React.FC = () => {
  const app = useAppStore((s) => s.app);
  const mode = useFlowStore((s) => s.activeMode);
  const activeFlowIdx = useFlowStore((s) => s.activeFlowId);
  const activeClosureIdx = useFlowStore((s) => s.activeClosureId);
  const flow = mode === "flow" ? app.flows[activeFlowIdx] ?? app.flows[0] : app.closures[activeClosureIdx] ?? app.closures[0];
  const { nodes, edges } = flow ? buildGraph(flow as any, mode === "flow" ? app.inputs : []) : { nodes: [], edges: [] as Edge[] };
  const selection = useFlowStore((s) => s.selection.nodeId);
  const selectNode = useFlowStore((s) => s.selectNode);
  const updateNodeUi = useAppStore((s) => s.updateNodeUi);
  const attachCallChain = useAppStore((s) => s.attachCallChain);
  const attachFlowStepsChain = useAppStore((s) => s.attachFlowStepsChain);
  const moveStepChainAfter = useAppStore((s) => s.moveStepChainAfter);
  const removeConnection = useAppStore((s) => s.removeConnection);
  const deleteNode = useAppStore((s) => s.deleteNode);
  const closuresMeta = useCatalogStore((s) => s.closuresMeta);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [ghost, setGhost] = useState<{ fromX: number; fromY: number; toX: number; toY: number; color: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const panningRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const linkRef = useRef<{ fromId: string; connectorId: string; color: string }>({ fromId: "", connectorId: "", color: "" });

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    if (errorTimer.current) {
      window.clearTimeout(errorTimer.current);
    }
    errorTimer.current = window.setTimeout(() => setErrorMsg(null), 2500);
  }, []);

  const handleResult = (res: any) => {
    if (res && typeof res === "object" && "ok" in res && !res.ok && "error" in res) {
      showError(res.error as string);
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - pan.x) / scale;
    const worldY = (mouseY - pan.y) / scale;
    const factor = Math.exp(-e.deltaY * 0.001);
    const nextScale = Math.min(2.5, Math.max(0.5, scale * factor));
    const nextPan = { x: mouseX - worldX * nextScale, y: mouseY - worldY * nextScale };
    setScale(nextScale);
    setPan(nextPan);
  };

  const worldPos = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - pan.x) / scale, y: (clientY - rect.top - pan.y) / scale };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // pan when background drag (no node) or holding space
    if ((e.target as HTMLElement).dataset.nodeId) return;
    if (e.button === 1 || e.altKey || e.metaKey || e.shiftKey || e.ctrlKey || (e.target as HTMLElement).dataset.canvas) {
      panningRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const { id, offsetX, offsetY } = dragRef.current;
      const wp = worldPos(e.clientX, e.clientY);
      const x = wp.x - offsetX;
      const y = wp.y - offsetY;
      updateNodeUi(flow.name, id, { x, y });
      return;
    }
    if (linkRef.current.fromId) {
      const wp = worldPos(e.clientX, e.clientY);
      setGhost((g) => (g ? { ...g, toX: wp.x, toY: wp.y } : g));
    }
    if (panningRef.current) {
      const dX = e.clientX - panningRef.current.startX;
      const dY = e.clientY - panningRef.current.startY;
      setPan({ x: panningRef.current.panX + dX, y: panningRef.current.panY + dY });
    }
  };

  const onMouseUp = () => {
    dragRef.current = null;
    panningRef.current = null;
    linkRef.current = { fromId: "", connectorId: "", color: "" };
    setGhost(null);
  };

  const width = Math.max(...nodes.map((n) => n.x + NODE_WIDTH), 1200);
  const height = Math.max(...nodes.map((n) => n.y + NODE_MIN_HEIGHT), 720);

  // Precompute connectors per node for edge anchoring
  const connectorsByNode: Record<string, Connector[]> = {};
  nodes.forEach((n) => {
    connectorsByNode[n.id] = buildConnectors(n, closuresMeta[n.data?.closureName ?? ""]);
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const currentSelection = useFlowStore.getState().selection.nodeId;
      const flowName =
        mode === "flow"
          ? app.flows[useFlowStore.getState().activeFlowId]?.name ?? app.flows[0]?.name
          : app.closures[useFlowStore.getState().activeClosureId]?.name ?? app.closures[0]?.name;
      if (!currentSelection || !flowName) return;
      const res = deleteNode(flowName, currentSelection);
      if (!res.ok) showError(res.error);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [app.flows, app.closures, mode, deleteNode, showError]);

  return (
    <div
      className="panel"
      ref={containerRef}
      style={{ position: "relative", minHeight: "calc(100vh - 120px)", overflow: "hidden", backgroundSize: "var(--grid-size) var(--grid-size)", backgroundImage:
        "linear-gradient(var(--panel-border) 1px, transparent 1px), linear-gradient(90deg, var(--panel-border) 1px, transparent 1px)" }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      data-canvas
    >
      <div style={{ position: "absolute", inset: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "0 0" }}>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
          <defs>
            {CONNECTOR_COLORS.map((c, i) => (
              <marker key={i} id={`arrow-color-${i}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
              </marker>
            ))}
          </defs>
          {edges.map((edge) => (
            <EdgeLine
              key={edge.id}
              edge={edge}
              nodes={nodes}
              connectorsByNode={connectorsByNode}
              selected={selection === edge.from || selection === edge.to}
              onDelete={() => {
                if (!flow) return;
                const res = removeConnection(flow.name, edge.from, edge.to, edge.label);
                if (!res.ok) showError(res.error);
              }}
            />
          ))}
          {ghost && (
            <path
              d={`M ${ghost.fromX} ${ghost.fromY} C ${(ghost.fromX + ghost.toX) / 2} ${ghost.fromY}, ${(ghost.fromX + ghost.toX) / 2} ${ghost.toY}, ${ghost.toX} ${ghost.toY}`}
              stroke={ghost.color}
              strokeWidth={2}
              fill="none"
              markerEnd="url(#arrow-color-0)"
              pointerEvents="none"
            />
          )}
        </svg>
        {nodes.map((node) => {
          const connectors = connectorsByNode[node.id] ?? [];
          const nodeHeight = Math.max(NODE_MIN_HEIGHT, 60 + connectors.length * 28);
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              className={clsx("node-card", selection === node.id && "selected")}
              onMouseDown={(e) => {
                e.stopPropagation();
                const nodeId = node.id;
                if (linkRef.current.fromId) {
                  const fromConnectors = connectorsByNode[linkRef.current.fromId] ?? [];
                  const connector = fromConnectors.find((c) => c.id === linkRef.current.connectorId);
                  if (linkRef.current.connectorId === "next") {
                    handleResult(moveStepChainAfter(flow.name, linkRef.current.fromId, nodeId));
                  } else if (connector?.direction === "dynamic") {
                    handleResult(attachFlowStepsChain(flow.name, linkRef.current.fromId, linkRef.current.connectorId, nodeId));
                  } else {
                    handleResult(attachCallChain(flow.name, linkRef.current.fromId, linkRef.current.connectorId, nodeId));
                  }
                  linkRef.current = { fromId: "", connectorId: "", color: "" };
                  setGhost(null);
                  return;
                }
                selectNode(nodeId ?? null);
                const wp = worldPos(e.clientX, e.clientY);
                dragRef.current = {
                  id: node.id,
                  offsetX: wp.x - node.x,
                  offsetY: wp.y - node.y
                };
              }}
              onMouseUp={(e) => {
                if (!linkRef.current.fromId) return;
                e.stopPropagation();
                const nodeId = node.id;
                if (linkRef.current.connectorId === "next") {
                  handleResult(moveStepChainAfter(flow.name, linkRef.current.fromId, nodeId));
                } else {
                  const fromConnectors = connectorsByNode[linkRef.current.fromId] ?? [];
                  const connector = fromConnectors.find((c) => c.id === linkRef.current.connectorId);
                  if (connector?.direction === "dynamic") {
                    handleResult(attachFlowStepsChain(flow.name, linkRef.current.fromId, linkRef.current.connectorId, nodeId));
                  } else {
                    handleResult(attachCallChain(flow.name, linkRef.current.fromId, linkRef.current.connectorId, nodeId));
                  }
                }
                linkRef.current = { fromId: "", connectorId: "", color: "" };
                setGhost(null);
              }}
              style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                width: NODE_WIDTH,
                minHeight: nodeHeight,
                borderRadius: 14,
                border: "1px solid var(--panel-border)",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                overflow: "visible",
                paddingRight: 10
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: 8, marginBottom: 6, paddingRight: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: 6, background: getNodeColor(node.kind), boxShadow: `0 0 0 4px ${getNodeColor(node.kind)}22` }} />
                <div style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.label}</div>
                <span className="badge" style={{ justifySelf: "end" }}>{node.kind}</span>
                <button
                  className="button tertiary"
                  style={{ padding: "2px 6px", justifySelf: "end" }}
                  title="Delete node"
                  onClick={(e) => {
                    e.stopPropagation();
                    const res = deleteNode(flow.name, node.id);
                    if (!res.ok) showError(res.error);
                    else selectNode(null);
                  }}
                >
                  ✕
                </button>
              </div>
              {/* connector dots along right edge */}
              <div style={{ position: "absolute", right: -8, top: 40, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                {connectors.map((c, idx) => {
                  const color = CONNECTOR_COLORS[idx % CONNECTOR_COLORS.length];
                  const dotY = node.y + 40 + idx * 28 + 7;
                  return (
                    <div key={`${c.id}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color, fontSize: 12, fontWeight: 600 }}>{c.label}</span>
                      <div
                        title={`${c.label} (${c.direction})`}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          background: color,
                          boxShadow: `0 0 0 4px ${color}33`,
                          cursor: "pointer"
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          linkRef.current = { fromId: node.id, connectorId: c.id, color };
                          setGhost({
                            fromX: node.x + NODE_WIDTH + 8,
                            fromY: dotY,
                            toX: node.x + NODE_WIDTH + 40,
                            toY: dotY,
                            color
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {errorMsg && (
        <div style={{ position: "absolute", top: 12, right: 16, background: "rgba(248,113,113,0.9)", color: "#fff", padding: "8px 12px", borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.3)", zIndex: 20 }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
};

const EdgeLine: React.FC<{
  edge: Edge;
  nodes: Node[];
  connectorsByNode: Record<string, Connector[]>;
  selected?: boolean;
  onDelete?: () => void;
}> = ({ edge, nodes, connectorsByNode, selected, onDelete }) => {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return null;
  const fromConnectors = connectorsByNode[from.id] ?? [];
  const connIdx = Math.max(0, fromConnectors.findIndex((c) => c.id === edge.label));
  const color = CONNECTOR_COLORS[connIdx % CONNECTOR_COLORS.length];
  const startX = from.x + NODE_WIDTH + 8;
  const startY = from.y + 40 + connIdx * 28 + 7;
  const endHeight = Math.max(NODE_MIN_HEIGHT, 60 + (connectorsByNode[to.id]?.length ?? 0) * 28);
  const endX = to.x - 6;
  const endY = to.y + endHeight / 2;
  const midX = (startX + endX) / 2;
  return (
    <g
      style={{ pointerEvents: "stroke", cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onDelete?.();
      }}
    >
      <path
        d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
        stroke={selected ? "var(--accent-2)" : color}
        strokeWidth={selected ? 3 : 2}
        fill="none"
        markerEnd={`url(#arrow-color-${connIdx % CONNECTOR_COLORS.length})`}
      />
      {edge.label && (
        <text x={midX} y={(startY + endY) / 2 - 6} fill={color} fontSize={12} textAnchor="middle">
          {edge.label}
        </text>
      )}
    </g>
  );
};

function buildConnectors(node: Node, meta?: any): Connector[] {
  const seen = new Set<string>();
  const connectors: Connector[] = [];
  const add = (c: Connector) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    connectors.push(c);
  };
  add({ id: "next", label: "next", direction: "next" });
  if (node.kind !== "closure") return connectors;
  const paramsMeta = meta?.signature?.parameters ?? [];
  const paramsValue = node.data?.params ?? {};

  const visit = (param: any, val: any, base: string) => {
    if (!param) return;
    if (param.type === "flowSteps") {
      add({ id: base, label: base, direction: "dynamic" });
      return;
    }
    if (param.type === "array" && Array.isArray(val) && Array.isArray(param.children)) {
      val.forEach((item: any, idx: number) => {
        param.children.forEach((child: any) => {
          visit(child, item?.[child.name], `${base}[${idx}].${child.name}`);
        });
      });
      return;
    }
  };

  paramsMeta.forEach((p: any) => {
    visit(p, paramsValue[p.name], p.name);
  });

  Object.entries(node.data?.params ?? {})
    .filter(([, v]) => typeof v === "object" && v !== null && "$call" in (v as any))
    .forEach(([name]) => add({ id: name, label: name, direction: "param" }));
  return connectors;
}

export default Canvas;
