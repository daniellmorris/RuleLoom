import { create } from "zustand";

type Selection = { nodeId: string | null };

interface FlowState {
  activeMode: "flow" | "closure";
  activeFlowId: number; // index in app.flows
  activeClosureId: number; // not used yet
  selection: Selection;
  setActiveFlow: (idx: number) => void;
  setActiveClosure: (idx: number) => void;
  setActiveMode: (mode: "flow" | "closure") => void;
  selectNode: (nodeId: string | null) => void;
}

export const useFlowStore = create<FlowState>((set) => ({
  activeMode: "flow",
  activeFlowId: 0,
  activeClosureId: 0,
  selection: { nodeId: null },
  setActiveFlow: (idx) => set({ activeMode: "flow", activeFlowId: idx, selection: { nodeId: null } }),
  setActiveClosure: (idx) => set({ activeMode: "closure", activeClosureId: idx, selection: { nodeId: null } }),
  setActiveMode: (mode) => set({ activeMode: mode, selection: { nodeId: null } }),
  selectNode: (nodeId) => set({ selection: { nodeId } }),
}));
