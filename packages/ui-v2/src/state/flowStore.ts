import { nanoid } from "../utils/id";
import { Edge, Flow, Node, NodeKind } from "../types";
import { create } from "zustand";
import coreManifest from "../data/coreManifest.json";

type Selection = { nodeId: string | null; edgeId: string | null };

interface FlowState {
  flows: Flow[];
  closures: Flow[];
  activeFlowId: string;
  activeClosureId: string | null;
  activeMode: "flow" | "closure";
  availableClosures: string[];
  availableInputs: string[];
  closuresMeta: Record<string, any>;
  inputsMeta: Record<string, any>;
  selection: Selection;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setFlow: (flow: Flow) => void;
  setFlows: (flows: Flow[]) => void;
  setClosures: (flows: Flow[]) => void;
  addFlow: (name: string) => void;
  addClosureFlow: (name: string) => void;
  setActiveFlow: (id: string) => void;
  setActiveClosure: (id: string | null) => void;
  setActiveMode: (mode: "flow" | "closure") => void;
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
  setCatalog: (closures: any[], inputs: any[]) => void;
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
  edges: baseEdges,
  kind: "flow"
};

const manifestClosuresArr = Array.isArray((coreManifest as any)?.closures) ? (coreManifest as any).closures : [];
const manifestInputsArr = Array.isArray((coreManifest as any)?.inputs) ? (coreManifest as any).inputs : [];
const manifestClosures = manifestClosuresArr.map((c: any) => c.name).filter(Boolean);
const manifestInputs = manifestInputsArr.map((i: any) => i.type).filter(Boolean);
const closuresMetaMap = Object.fromEntries(manifestClosuresArr.map((c: any) => [c.name, c]));
const inputsMetaMap = Object.fromEntries(manifestInputsArr.map((i: any) => [i.type, i]));

export const useFlowStore = create<FlowState>((set) => ({
  flows: [initialFlow],
  closures: [],
  activeFlowId: initialFlow.id,
  activeClosureId: null,
  activeMode: "flow",
  availableClosures: manifestClosures,
  availableInputs: manifestInputs,
  closuresMeta: closuresMetaMap,
  inputsMeta: inputsMetaMap,
  selection: { nodeId: null, edgeId: null },
  registerPlugin: (manifest) =>
    set((state) => ({
      availableClosures: Array.from(new Set([...state.availableClosures, ...(manifest.closures ?? [])])),
      availableInputs: Array.from(new Set([...state.availableInputs, ...(manifest.inputs ?? [])]))
    })),
  setFlow: (flow) =>
    set((state) => {
      const exists = state.flows.some((f) => f.id === flow.id);
      const flows = exists ? state.flows.map((f) => (f.id === flow.id ? flow : f)) : [...state.flows, flow];
      return { flows, activeFlowId: flow.id, selection: { nodeId: null, edgeId: null } };
    }),
  setFlows: (flows) =>
    set((state) => ({
      flows,
      activeFlowId: flows.find((f) => f.id === state.activeFlowId)?.id ?? flows[0]?.id ?? null,
      selection: { nodeId: null, edgeId: null }
    })),
  setClosures: (flows) =>
    set((state) => ({
      closures: flows,
      activeClosureId: flows.find((f) => f.id === state.activeClosureId)?.id ?? flows[0]?.id ?? null,
      selection: { nodeId: null, edgeId: null }
    })),
  addFlow: (name) =>
    set((state) => {
      const id = nanoid();
      const startId = `start-${id}`;
      const flow: Flow = {
        id,
        name,
        entryId: startId,
        nodes: [
          {
            id: startId,
            kind: "start",
            label: "START",
            x: 60,
            y: 120,
            connectors: [{ id: "next", label: "next", direction: "next" }]
          }
        ],
        edges: []
      };
      return { flows: [...state.flows, flow], activeFlowId: id, selection: { nodeId: null, edgeId: null } };
    }),
  addClosureFlow: (name) =>
    set((state) => {
      const id = nanoid();
      const startId = `start-${id}`;
      const flow: Flow = {
        id,
        name,
        kind: "closure",
        entryId: startId,
        nodes: [
          {
            id: startId,
            kind: "start",
            label: "START",
            x: 60,
            y: 120,
            connectors: [{ id: "next", label: "next", direction: "next" }]
          }
        ],
        edges: []
      };
      return { closures: [...state.closures, flow], activeClosureId: id, selection: { nodeId: null, edgeId: null } };
    }),
  setActiveFlow: (id) => set(() => ({ activeFlowId: id, selection: { nodeId: null, edgeId: null } })),
  setActiveClosure: (id) => set(() => ({ activeClosureId: id, selection: { nodeId: null, edgeId: null } })),
  setActiveMode: (mode) =>
    set((state) => ({
      activeMode: mode,
      activeFlowId: mode === "flow" ? state.activeFlowId ?? state.flows[0]?.id ?? null : state.activeFlowId,
      activeClosureId: mode === "closure" ? state.activeClosureId ?? state.closures[0]?.id ?? null : state.activeClosureId,
      selection: { nodeId: null, edgeId: null }
    })),
  selectNode: (id) => set({ selection: { nodeId: id, edgeId: null } }),
  selectEdge: (id) => set({ selection: { nodeId: null, edgeId: id } }),
  addNode: (partial) =>
    set((state) =>
      applyActive(state, (flow) => {
        // block inputs inside closure canvases
        if (state.activeMode === "closure" && partial.kind === "input") return flow;
        // block adding additional start nodes
        if (partial.kind === "start") return flow;
        const node = { ...partial, id: nanoid() };
        const nodes = [...flow.nodes, node];
        const edges = [...flow.edges];
        const entryId = flow.entryId || flow.nodes.find((n) => n.kind === "start")?.id || node.id;
        if (node.kind === "input") {
          // inputs always connect to START
          if (entryId) edges.push({ id: nanoid(), from: node.id, to: entryId, kind: "control", label: "next" });
        } else {
          const hasStartEdge = edges.some((e) => e.from === entryId);
          if (!hasStartEdge && entryId) edges.push({ id: nanoid(), from: entryId, to: node.id, kind: "control", label: "next" });
        }
        return { ...flow, entryId, nodes, edges };
      })
    ),
  updateNode: (id, patch) =>
    set((state) =>
      applyActive(state, (flow) => ({
        ...flow,
        nodes: flow.nodes.map((n) => (n.id === id ? { ...n, ...patch, data: { ...n.data, ...patch.data } } : n))
      }))
    ),
  connect: (from, to, label, kind = "control") =>
    set((state) =>
      applyActive(state, (flow) => {
        const fromNode = flow.nodes.find((n) => n.id === from);
        const targetNode = flow.nodes.find((n) => n.id === to);
        if (!fromNode || !targetNode) return flow;
        // forbid edges into inputs
        if (targetNode.kind === "input" && kind !== "param") return flow;
        // in closure mode, inputs are not allowed
        if (state.activeMode === "closure" && (fromNode.kind === "input" || targetNode.kind === "input")) return flow;
        // inputs always target START
        const startNode = flow.nodes.find((n) => n.kind === "start");
        if (fromNode.kind === "input" && startNode) {
          to = startNode.id;
        }

        const inputNodes = flow.nodes.filter((n) => n.kind === "input");
        const connectingFromInput = fromNode.kind === "input";
        const effectiveLabel = label ?? (kind === "control" ? "next" : label);

        let filtered = flow.edges.filter((e) => {
          const sameOut =
            e.from === from &&
            e.kind === kind &&
            (kind === "branch" || kind === "param" || (kind === "control" && effectiveLabel) ? e.label === effectiveLabel : true);
          const inboundConflict =
            (e.kind === "control" || e.kind === "branch" || e.kind === "param") &&
            (kind === "control" || kind === "branch" || kind === "param") &&
            e.to === to;
          const blockBranchSameTarget = kind === "branch" && e.kind === "branch" && e.to === to;
          return !sameOut && !blockBranchSameTarget && !inboundConflict;
        });

        if (connectingFromInput) {
          filtered = filtered.filter((e) => !(flow.nodes.find((n) => n.id === e.from)?.kind === "input"));
        }

        const edge: Edge = { id: nanoid(), from, to, label: effectiveLabel, kind };
        let nextEdges = [...filtered, edge];

        if (connectingFromInput) {
          inputNodes
            .filter((n) => n.id !== from)
            .forEach((n) => {
              nextEdges.push({ id: nanoid(), from: n.id, to, label: "next", kind: "control" });
            });
        }

        return { ...flow, edges: nextEdges };
      })
    ),
  connectParam: (toNode, param, fromNode) =>
    set((state) =>
      applyActive(state, (flow) => {
        const edges = flow.edges.filter((e) => !(e.kind === "param" && e.to === toNode && e.label === param));
        if (fromNode) edges.push({ id: nanoid(), from: fromNode, to: toNode, label: param, kind: "param" });
        return { ...flow, edges };
      })
    ),
  deleteEdge: (id) =>
    set((state) => ({
      ...applyActive(state, (flow) => ({ ...flow, edges: flow.edges.filter((e) => e.id !== id) })),
      selection: { nodeId: null, edgeId: null }
    })),
  deleteNode: (id) =>
    set((state) => ({
      ...applyActive(state, (flow) => {
        const target = flow.nodes.find((n) => n.id === id);
        if (!target || target.kind === "start") return flow;
        return {
          ...flow,
          nodes: flow.nodes.filter((n) => n.id !== id),
          edges: flow.edges.filter((e) => e.from !== id && e.to !== id)
        };
      }),
      selection: { nodeId: null, edgeId: null }
    })),
  setFlowName: (name) =>
    set((state) =>
      applyActive(state, (flow) => ({
        ...flow,
        name
      }))
    ),
  setCatalog: (closures, inputs) =>
    set(() => ({
      availableClosures: closures.map((c: any) => c.name).filter(Boolean),
      availableInputs: inputs.map((i: any) => i.type).filter(Boolean),
      closuresMeta: Object.fromEntries(closures.map((c: any) => [c.name, c])),
      inputsMeta: Object.fromEntries(inputs.map((i: any) => [i.type, i]))
    })),
  layout: () =>
    set((state) => applyActive(state, (flow) => autoLayout(flow))),
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
  const entry = flow.nodes.find((n) => n.id === flow.entryId) ?? flow.nodes.find((n) => n.kind === "start") ?? flow.nodes[0];
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

function applyActive(state: FlowState, mutator: (flow: Flow) => Flow): Partial<FlowState> {
  if (state.activeMode === "flow") {
    const flows = state.flows.map((f) => (f.id === state.activeFlowId ? mutator(f) : f));
    const activeFlowId = flows.find((f) => f.id === state.activeFlowId)?.id ?? flows[0]?.id ?? null;
    return { flows, activeFlowId };
  }
  const closures = state.closures.map((f) => (f.id === state.activeClosureId ? mutator(f) : f));
  const activeClosureId = closures.find((f) => f.id === state.activeClosureId)?.id ?? closures[0]?.id ?? null;
  return { closures, activeClosureId };
}
