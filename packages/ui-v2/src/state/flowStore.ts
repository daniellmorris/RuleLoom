import { nanoid } from "../utils/id";
import { Edge, Flow, Node, NodeKind } from "../types";
import { create } from "zustand";

type Selection = { nodeId: string | null; edgeId: string | null };

interface FlowState {
  flows: Flow[];
  activeFlowId: string;
  availableClosures: string[];
  availableInputs: string[];
  selection: Selection;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  addFlow: (name: string) => void;
  setActiveFlow: (id: string) => void;
  setFlowName: (name: string) => void;
  registerPlugin: (manifest: { closures?: string[]; inputs?: string[] }) => void;
  addNode: (partial: Omit<Node, "id">) => void;
  updateNode: (id: string, patch: Partial<Node>) => void;
  connect: (from: string, to: string, label?: string, kind?: Edge["kind"]) => void;
  connectParam: (toNode: string, param: string, fromNode: string | null) => void;
  deleteEdge: (id: string) => void;
  deleteNode: (id: string) => void;
  layout: () => void;
  reset: () => void;
}

const baseNodes: Node[] = [
  {
    id: "input-1",
    kind: "input",
    label: "Flow Input",
    x: 120,
    y: 140,
    connectors: [
      { id: "next", label: "next", direction: "next" }
    ],
    data: {
      schema: {
        userId: { type: "string", required: true },
        payload: { type: "object" }
      },
      description: "Entry point for flow parameters"
    }
  },
  {
    id: "branch-1",
    kind: "branch",
    label: "Risk Branch",
    x: 680,
    y: 140,
    connectors: [
      { id: "next", label: "default", direction: "next" },
      { id: "high", label: "high", direction: "dynamic" }
    ],
    data: {
      branchRules: [
        { label: "high", condition: "riskScore > 80" },
        { label: "default", condition: "otherwise" }
      ]
    }
  },
  {
    id: "closure-1",
    kind: "closure",
    label: "Notify & Persist",
    x: 980,
    y: 60,
    connectors: [
      { id: "next", label: "next", direction: "next" },
      { id: "firstStep", label: "closureParameter", direction: "dynamic" }
    ],
    data: { closureName: "notifyAndPersist" }
  }
];

const baseEdges: Edge[] = [
  { id: "e1", from: "input-1", to: "branch-1", kind: "control" },
  { id: "e3", from: "branch-1", to: "closure-1", label: "high", kind: "branch" }
];

const initialFlow: Flow = {
  id: "flow-1",
  name: "Customer Onboarding",
  entryId: "input-1",
  nodes: baseNodes,
  edges: baseEdges
};

export const useFlowStore = create<FlowState>((set) => ({
  flows: [initialFlow],
  activeFlowId: initialFlow.id,
  availableClosures: ["core.log", "core.respond", "core.assign", "core.for-each", "core.truthy"],
  availableInputs: ["http"],
  selection: { nodeId: null, edgeId: null },
  registerPlugin: (manifest) =>
    set((state) => ({
      availableClosures: Array.from(new Set([...state.availableClosures, ...(manifest.closures ?? [])])),
      availableInputs: Array.from(new Set([...state.availableInputs, ...(manifest.inputs ?? [])]))
    })),
  addFlow: (name) =>
    set((state) => {
      const id = nanoid();
      const flow: Flow = {
        id,
        name,
        entryId: "",
        nodes: [],
        edges: []
      };
      return { flows: [...state.flows, flow], activeFlowId: id, selection: { nodeId: null, edgeId: null } };
    }),
  setActiveFlow: (id) => set(() => ({ activeFlowId: id, selection: { nodeId: null, edgeId: null } })),
  selectNode: (id) => set({ selection: { nodeId: id, edgeId: null } }),
  selectEdge: (id) => set({ selection: { nodeId: null, edgeId: id } }),
  addNode: (partial) =>
    set((state) => ({
      flows: state.flows.map((flow) => {
        if (flow.id !== state.activeFlowId) return flow;
        const node = { ...partial, id: nanoid() };
        const nodes = [...flow.nodes, node];
        const edges = [...flow.edges];
        const entryId = flow.entryId || flow.nodes.find((n) => n.kind === "input")?.id || node.id;
        // if adding input and there's already an input with a start edge, connect to that same target
        if (node.kind === "input") {
          const anchor = edges.find((e) => (e.kind === "control" || e.kind === "branch") && flow.nodes.find((n) => n.id === e.from)?.kind === "input");
          if (anchor) {
            edges.push({ id: nanoid(), from: node.id, to: anchor.to, kind: "control", label: "next" });
          }
        } else {
          // auto-connect input to first step if none
          const hasStartEdge = edges.some((e) => e.from === entryId);
          if (!hasStartEdge && entryId) {
            edges.push({ id: nanoid(), from: entryId, to: node.id, kind: "control", label: "next" });
          }
        }
        return { ...flow, entryId, nodes, edges };
      })
    })),
  updateNode: (id, patch) =>
    set((state) => ({
      flows: state.flows.map((flow) =>
        flow.id === state.activeFlowId
          ? { ...flow, nodes: flow.nodes.map((n) => (n.id === id ? { ...n, ...patch, data: { ...n.data, ...patch.data } } : n)) }
          : flow
      )
    })),
  connect: (from, to, label, kind = "control") =>
    set((state) => ({
      flows: state.flows.map((flow) =>
        flow.id === state.activeFlowId
          ? (() => {
              const fromNode = flow.nodes.find((n) => n.id === from);
              const targetNode = flow.nodes.find((n) => n.id === to);
              // forbid edges into inputs
              if (targetNode?.kind === "input") return flow;
              // all inputs share same start target; if connecting from an input, update all input edges to this target
              let finalTo = to;
              const inputNodes = flow.nodes.filter((n) => n.kind === "input");
              const connectingFromInput = fromNode?.kind === "input";
              if (connectingFromInput) {
                // remove existing edges from inputs; we'll re-add
              }
              const effectiveLabel = label ?? (kind === "control" ? "next" : undefined);
              // enforce single outbound per connector (from+kind+label)
              let filtered = flow.edges.filter((e) => {
                const sameOut = e.from === from && e.kind === kind && (kind === "branch" ? e.label === label : true);
                const inboundConflict =
                  (kind === "control" || kind === "branch") &&
                  (e.kind === "control" || e.kind === "branch") &&
                  e.to === finalTo;
                const blockBranchSameTarget = kind === "branch" && e.kind === "branch" && e.to === finalTo;
                return !sameOut && !blockBranchSameTarget && !inboundConflict;
              });
              // if connecting from an input, drop all existing input edges first
              if (connectingFromInput) {
                filtered = filtered.filter((e) => !(flow.nodes.find((n) => n.id === e.from)?.kind === "input"));
              }
              const edge: Edge = { id: nanoid(), from, to: finalTo, label: effectiveLabel, kind };
              let nextEdges = [...filtered, edge];
              if (connectingFromInput) {
                inputNodes
                  .filter((n) => n.id !== from)
                  .forEach((n) => {
                    // add edge for each other input to the same target
                    nextEdges.push({ id: nanoid(), from: n.id, to: finalTo, label: "next", kind: "control" });
                  });
              }
              return { ...flow, edges: nextEdges };
            })()
          : flow
      )
    })),
  connectParam: (toNode, param, fromNode) =>
    set((state) => ({
      flows: state.flows.map((flow) => {
        if (flow.id !== state.activeFlowId) return flow;
        const edges = flow.edges.filter((e) => !(e.kind === "param" && e.to === toNode && e.label === param));
        if (fromNode) edges.push({ id: nanoid(), from: fromNode, to: toNode, label: param, kind: "param" });
        return { ...flow, edges };
      })
    })),
  deleteEdge: (id) =>
    set((state) => ({
      flows: state.flows.map((flow) =>
        flow.id === state.activeFlowId ? { ...flow, edges: flow.edges.filter((e) => e.id !== id) } : flow
      ),
      selection: { nodeId: null, edgeId: null }
    })),
  deleteNode: (id) =>
    set((state) => ({
      flows: state.flows.map((flow) =>
        flow.id === state.activeFlowId
          ? { ...flow, nodes: flow.nodes.filter((n) => n.id !== id), edges: flow.edges.filter((e) => e.from !== id && e.to !== id) }
          : flow
      ),
      selection: { nodeId: null, edgeId: null }
    })),
  setFlowName: (name) =>
    set((state) => ({
      flows: state.flows.map((f) => (f.id === state.activeFlowId ? { ...f, name } : f))
    })),
  layout: () =>
    set((state) => ({
      flows: state.flows.map((flow) => (flow.id === state.activeFlowId ? autoLayout(flow) : flow))
    })),
  reset: () =>
    set({
      flows: [initialFlow],
      activeFlowId: initialFlow.id,
      selection: { nodeId: null, edgeId: null }
    })
}));

export const createNodeTemplate = (kind: NodeKind, x: number, y: number): Omit<Node, "id"> => {
  const base: Omit<Node, "id"> = {
    kind,
    label: kind === "input" ? "Input" : kind === "branch" ? "Branch" : "Closure",
    x,
    y,
    connectors: [{ id: "next", label: "next", direction: "next" }]
  };

  switch (kind) {
    case "input":
      return {
        ...base,
        connectors: [{ id: "next", label: "next", direction: "next" }],
        data: { schema: { example: { type: "string" } } }
      };
    case "branch":
      return {
        ...base,
        connectors: [
          { id: "default", label: "default", direction: "next" },
          { id: "alt", label: "alt", direction: "dynamic" }
        ],
        data: { branchRules: [{ label: "default", condition: "true" }] }
      };
    case "closure":
      return {
        ...base,
        connectors: [
          { id: "next", label: "next", direction: "next" },
          { id: "closureParam", label: "closureParameter", direction: "dynamic" }
        ],
        data: { closureName: "closure", params: {} }
      };
    default:
      return base;
  }
};

export function autoLayout(flow: Flow): Flow {
  const edges = flow.edges;
  const entry = flow.nodes.find((n) => n.id === flow.entryId) ?? flow.nodes[0];
  const layerMap = new Map<string, number>();
  const visited = new Set<string>();
  const adj = new Map<string, string[]>();

  edges.forEach((e) => {
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    adj.set(e.from, list);
  });

  const queue: string[] = [];
  if (entry) {
    layerMap.set(entry.id, 0);
    queue.push(entry.id);
  }

  while (queue.length) {
    const id = queue.shift()!;
    visited.add(id);
    const nexts = adj.get(id) ?? [];
    nexts.forEach((to) => {
      const nextLayer = (layerMap.get(id) ?? 0) + 1;
      if (!layerMap.has(to) || (layerMap.get(to) ?? 0) < nextLayer) {
        layerMap.set(to, nextLayer);
      }
      if (!visited.has(to)) queue.push(to);
    });
  }

  let maxLayer = Math.max(0, ...Array.from(layerMap.values()));
  flow.nodes.forEach((n) => {
    if (!layerMap.has(n.id)) {
      maxLayer += 1;
      layerMap.set(n.id, maxLayer);
    }
  });

  const byLayer: Record<number, Node[]> = {};
  flow.nodes.forEach((n) => {
    const l = layerMap.get(n.id) ?? 0;
    byLayer[l] = byLayer[l] ?? [];
    byLayer[l].push(n);
  });

  const newNodes = flow.nodes.map((n) => {
    const layer = layerMap.get(n.id) ?? 0;
    const siblings = byLayer[layer] ?? [];
    const idx = siblings.findIndex((s) => s.id === n.id);
    return {
      ...n,
      x: 120 + layer * 240,
      y: 140 + idx * 140
    };
  });

  return { ...flow, nodes: newNodes };
}
