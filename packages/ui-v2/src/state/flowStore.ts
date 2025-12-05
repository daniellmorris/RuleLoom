import { create } from "zustand";

type Selection = { nodePath: string | null };

interface FlowState {
  activeMode: "flow" | "closure";
  activeFlowId: number; // index in app.flows
  activeClosureId: number; // not used yet
  selection: Selection;
  setActiveFlow: (idx: number) => void;
  setActiveClosure: (idx: number) => void;
  setActiveMode: (mode: "flow" | "closure") => void;
  selectNode: (path: string | null) => void;
}

export const useFlowStore = create<FlowState>((set) => ({
  activeMode: "flow",
  activeFlowId: 0,
  activeClosureId: 0,
  selection: { nodePath: null },
  setActiveFlow: (idx) => set({ activeMode: "flow", activeFlowId: idx, selection: { nodePath: null } }),
  setActiveClosure: (idx) => set({ activeMode: "closure", activeClosureId: idx, selection: { nodePath: null } }),
  setActiveMode: (mode) => set({ activeMode: mode, selection: { nodePath: null } }),
  selectNode: (path) => set({ selection: { nodePath: path } }),
}));
