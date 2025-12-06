import React, { useState, useRef } from "react";
import clsx from "clsx";
import { useFlowStore } from "../state/flowStore";
import { useAppStore } from "../state/appStore";
import { useCatalogStore } from "../state/catalogStore";
import { buildGraph } from "../utils/graph";
import { getNodeColor } from "../styles/palette";
import { Connector, Edge, Node } from "../types";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const CONNECTOR_COLORS = ["#7dd3fc", "#fbbf24", "#a78bfa", "#34d399", "#f87171", "#38bdf8"];

const Canvas: React.FC = () => {
  const app = useAppStore((s) => s.app);
  const setFlowStartUi = useAppStore((s) => s.updateNodeUi); // reuse node UI updater for start via flow $ui path
  const activeIdx = useFlowStore((s) => s.activeFlowId);
  const flow = app.flows[activeIdx] ?? app.flows[0];
  const { nodes, edges, pathById } = flow ? buildGraph(flow as any, app.inputs) : { nodes: [], edges: [], pathById: {} };
  const selection = useFlowStore((s) => s.selection.nodePath);
  const selectNode = useFlowStore((s) => s.selectNode);
  const updateNodeUi = useAppStore((s) => s.updateNodeUi);
  const attachCallChain = useAppStore((s) => s.attachCallChain);
  const attachFlowStepsChain = useAppStore((s) => s.attachFlowStepsChain);
  const moveStepChainAfter = useAppStore((s) => s.moveStepChainAfter);
  const closuresMeta = useCatalogStore((s) => s.closuresMeta);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [ghost, setGhost] = useState<{ fromX: number; fromY: number; toX: number; toY: number; color: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; path: string; offsetX: number; offsetY: number } | null>(null);
  const panningRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const linkRef = useRef<{ fromPath: string; connectorId: string; color: string }>({ fromPath: "", connectorId: "", color: "" });

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
      const { id, path, offsetX, offsetY } = dragRef.current;
      const wp = worldPos(e.clientX, e.clientY);
      const x = wp.x - offsetX;
      const y = wp.y - offsetY;
      if (id === "start") {
        setFlowStartUi(flow.name, "$ui", { x, y });
      } else {
        updateNodeUi(flow.name, path, { x, y });
      }
      return;
    }
    if (linkRef.current.fromPath) {
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
    linkRef.current = { fromPath: "", connectorId: "", color: "" };
    setGhost(null);
  };

  const width = Math.max(...nodes.map((n) => n.x + NODE_WIDTH), 1200);
  const height = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT), 720);

  // Precompute connectors per node for edge anchoring
  const connectorsByNode: Record<string, Connector[]> = {};
  nodes.forEach((n) => {
    connectorsByNode[n.id] = buildConnectors(n, closuresMeta[n.data?.closureName ?? ""]);
  });

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
            <EdgeLine key={edge.id} edge={edge} nodes={nodes} connectorsByNode={connectorsByNode} selected={selection === pathById[edge.id]} />
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
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              className={clsx("node-card", selection === pathById[node.id] && "selected")}
              onMouseDown={(e) => {
                e.stopPropagation();
                const path = pathById[node.id];
                if (linkRef.current.fromPath) {
                  const isBoundaryPrefix = (a: string, b: string) => b === a || b.startsWith(a + ".");
                  if (path && (isBoundaryPrefix(linkRef.current.fromPath, path) || isBoundaryPrefix(path, linkRef.current.fromPath))) {
                    linkRef.current = { fromPath: "", connectorId: "", color: "" };
                    setGhost(null);
                    return;
                  }
                  if (linkRef.current.connectorId === "next") {
                    moveStepChainAfter(flow.name, linkRef.current.fromPath, path ?? "");
                  } else {
                    const fromNodeId = nodes.find((n) => pathById[n.id] === linkRef.current.fromPath)?.id;
                    const fromConnectors = fromNodeId ? connectorsByNode[fromNodeId] ?? [] : [];
                    const connector = fromConnectors.find((c) => c.id === linkRef.current.connectorId);
                    if (connector?.direction === "dynamic") {
                      attachFlowStepsChain(flow.name, linkRef.current.fromPath, linkRef.current.connectorId, path ?? "");
                    } else {
                      attachCallChain(flow.name, linkRef.current.fromPath, linkRef.current.connectorId, path ?? "");
                    }
                  }
                  linkRef.current = { fromPath: "", connectorId: "", color: "" };
                  setGhost(null);
                  return;
                }
                selectNode(path ?? null);
                const wp = worldPos(e.clientX, e.clientY);
                dragRef.current = {
                  id: node.id,
                  path: path ?? "",
                  offsetX: wp.x - node.x,
                  offsetY: wp.y - node.y
                };
              }}
              onMouseUp={(e) => {
                if (!linkRef.current.fromPath) return;
                e.stopPropagation();
                const path = pathById[node.id];
                if (!path) return;
                const isBoundaryPrefix = (a: string, b: string) => b === a || b.startsWith(a + ".");
                if (isBoundaryPrefix(linkRef.current.fromPath, path) || isBoundaryPrefix(path, linkRef.current.fromPath)) {
                  linkRef.current = { fromPath: "", connectorId: "", color: "" };
                  setGhost(null);
                  return;
                }
                if (linkRef.current.connectorId === "next") {
                  moveStepChainAfter(flow.name, linkRef.current.fromPath, path);
                } else {
                  const fromNodeId = nodes.find((n) => pathById[n.id] === linkRef.current.fromPath)?.id;
                  const fromConnectors = fromNodeId ? connectorsByNode[fromNodeId] ?? [] : [];
                  const connector = fromConnectors.find((c) => c.id === linkRef.current.connectorId);
                  if (connector?.direction === "dynamic") {
                    attachFlowStepsChain(flow.name, linkRef.current.fromPath, linkRef.current.connectorId, path);
                  } else {
                    attachCallChain(flow.name, linkRef.current.fromPath, linkRef.current.connectorId, path);
                  }
                }
                linkRef.current = { fromPath: "", connectorId: "", color: "" };
                setGhost(null);
              }}
              style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                width: NODE_WIDTH,
                minHeight: NODE_HEIGHT,
                borderRadius: 14,
                border: "1px solid var(--panel-border)",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                overflow: "visible"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 6, background: getNodeColor(node.kind), boxShadow: `0 0 0 4px ${getNodeColor(node.kind)}22` }} />
                <div style={{ fontWeight: 700 }}>{node.label}</div>
                <span className="badge" style={{ marginLeft: "auto" }}>{node.kind}</span>
              </div>
              {/* connector dots along right edge */}
              <div style={{ position: "absolute", right: -6, top: 36, display: "flex", flexDirection: "column", gap: 14 }}>
                {connectors.map((c, idx) => {
                  const color = CONNECTOR_COLORS[idx % CONNECTOR_COLORS.length];
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
                          const path = pathById[node.id];
                          if (!path) return;
                          linkRef.current = { fromPath: path, connectorId: c.id, color };
                          setGhost({
                            fromX: node.x + NODE_WIDTH + 2,
                            fromY: node.y + 32 + idx * 24,
                            toX: node.x + NODE_WIDTH + 40,
                            toY: node.y + 32 + idx * 24,
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
    </div>
  );
};

const EdgeLine: React.FC<{ edge: Edge; nodes: Node[]; connectorsByNode: Record<string, Connector[]>; selected?: boolean }> = ({ edge, nodes, connectorsByNode, selected }) => {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return null;
  const fromConnectors = connectorsByNode[from.id] ?? [];
  const connIdx = Math.max(0, fromConnectors.findIndex((c) => c.id === edge.label));
  const color = CONNECTOR_COLORS[connIdx % CONNECTOR_COLORS.length];
  const startX = from.x + NODE_WIDTH + 2;
  const startY = from.y + 22 + connIdx * 22;
  const endX = to.x - 6;
  const endY = to.y + NODE_HEIGHT / 2;
  const midX = (startX + endX) / 2;
  return (
    <g style={{ pointerEvents: "stroke", cursor: "pointer" }}>
      <path d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`} stroke={selected ? "var(--accent-2)" : color} strokeWidth={selected ? 3 : 2} fill="none" markerEnd={`url(#arrow-color-0)`} />
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
  paramsMeta.filter((p: any) => p.type === "flowSteps").forEach((p: any) => add({ id: p.name, label: p.name, direction: "dynamic" }));
  Object.entries(node.data?.params ?? {})
    .filter(([, v]) => typeof v === "object" && v !== null && "$call" in (v as any))
    .forEach(([name]) => add({ id: name, label: name, direction: "param" }));
  return connectors;
}

export default Canvas;
