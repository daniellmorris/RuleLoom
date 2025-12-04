import { create } from "zustand";
import yaml from "js-yaml";
import { nanoid } from "../utils/id";

export type UiMeta = { x?: number; y?: number; w?: number; h?: number; color?: string; collapsed?: boolean; id?: string };
export type StepWithUi = any & { $ui?: UiMeta };
export type FlowWithUi = { name: string; steps: StepWithUi[]; $ui?: { id?: string; x?: number; y?: number; disconnected?: { steps: StepWithUi[] }[] } };

export interface AppState {
  version: number;
  inputs: any[];
  closures: any[];
  flows: FlowWithUi[];
}

interface AppStore {
  app: AppState;
  loadYaml: (text: string) => void;
  toYaml: () => string;
  setFlows: (flows: FlowWithUi[]) => void;
  updateStepUi: (flowName: string, stepPath: string, ui: UiMeta) => void;
  updateStepCallTarget: (flowName: string, stepPath: string, paramName: string, targetPath: string | null) => void;
  moveStepChainAfter: (flowName: string, sourceStepPath: string, targetStepPath: string) => void;
  updateTriggerUi: (triggerPath: string, ui: UiMeta) => void;
  updateNodeUi: (flowName: string, path: string, ui: UiMeta) => void;
  addDisconnected: (flowName: string, steps: StepWithUi[]) => void;
  addTrigger: (type: string, flowName: string) => void;
  addClosureStep: (flowIdx: number, closureName: string) => void;
  updateStepParam: (flowName: string, stepPath: string, key: string, value: any) => void;
  updateTriggerField: (triggerPath: string, key: string, value: any) => void;
  updateInputConfig: (inputIdx: number, key: string, value: any) => void;
}

const defaultState: AppState = {
  version: 1,
  inputs: [],
  closures: [],
  flows: [
    {
      name: "Flow 1",
      steps: [],
      $ui: { disconnected: [] }
    }
  ]
};

function parse(text: string): AppState {
  const obj = yaml.load(text) as any;
  const seedIds = (steps: StepWithUi[]) => {
    steps.forEach((s) => {
      s.$ui = s.$ui ?? {};
      s.$ui.id = s.$ui.id ?? nanoid();
      if (Array.isArray(s.cases)) s.cases.forEach((c: any) => seedIds(c.steps ?? []));
      if (Array.isArray((s as any).otherwise)) seedIds((s as any).otherwise as any);
    });
  };
  (obj?.flows ?? []).forEach((f: any) => {
    f.$ui = f.$ui ?? { id: nanoid(), x: 60, y: 120, disconnected: [] };
    f.$ui.id = f.$ui.id ?? nanoid();
    f.$ui.x = f.$ui.x ?? 60;
    f.$ui.y = f.$ui.y ?? 120;
    seedIds(f.steps ?? []);
    (f?.$ui?.disconnected ?? []).forEach((d: any) => seedIds(d.steps ?? []));
  });
  return {
    version: obj?.version ?? 1,
    inputs: obj?.inputs ?? [],
    closures: obj?.closures ?? [],
    flows: obj?.flows ?? []
  };
}

function dump(app: AppState): string {
  return yaml.dump(app, { lineWidth: 120 });
}

function getStep(flow: FlowWithUi, path: string): any {
  const parts = path.split('.');
  let cursor: any = flow as any;
  for (const part of parts) {
    const mSteps = part.match(/^steps\[(\d+)\]$/);
    if (mSteps) {
      cursor = cursor?.steps?.[Number(mSteps[1])];
      continue;
    }
    const mCases = part.match(/^cases\[(\d+)\]$/);
    if (mCases) {
      cursor = cursor?.cases?.[Number(mCases[1])];
      continue;
    }
    if (part === 'otherwise') {
      cursor = cursor?.otherwise;
      continue;
    }
    if (part === '$ui') {
      cursor = cursor?.$ui ?? (cursor.$ui = {});
      continue;
    }
    const mDisc = part.match(/^disconnected\[(\d+)\]$/);
    if (mDisc) {
      cursor = cursor?.disconnected?.[Number(mDisc[1])];
      continue;
    }
  }
  return cursor ?? null;
}

function setStepUi(flow: FlowWithUi, path: string, ui: UiMeta) {
  const step = getStep(flow, path);
  if (!step) return;
  step.$ui = { ...(step.$ui ?? {}), ...ui };
}

function setStepCall(flow: FlowWithUi, path: string, paramName: string, targetPath: string | null) {
  const step = getStep(flow, path);
  if (!step) return;
  if (!step.parameters) step.parameters = {};
  if (targetPath) step.parameters[paramName] = { $call: targetPath };
  else delete step.parameters[paramName];
}

function moveChain(flow: FlowWithUi, sourcePath: string, targetPath: string) {
  const resolve = (p: string) => {
    if (p === "start") return { arr: flow.steps, idx: -1, discIdx: undefined } as const;
    const main = p.match(/^steps\[(\d+)\]$/);
    if (main) return { arr: flow.steps, idx: Number(main[1]), discIdx: undefined } as const;
    const disc = p.match(/^\$ui\.disconnected\[(\d+)\]\.steps\[(\d+)\]$/);
    if (disc) {
      const di = Number(disc[1]);
      const si = Number(disc[2]);
      return { arr: flow.$ui?.disconnected?.[di]?.steps, idx: si, discIdx: di } as const;
    }
    return null;
  };

  const src = resolve(sourcePath);
  const tgt = resolve(targetPath);
  if (!src || !tgt) return;
  if (!flow.steps) return;

  const isSrcMain = src.arr === flow.steps;
  const isTgtMain = tgt.arr === flow.steps;

  // Case 1: source and target both in main (start treated as idx -1); target must be after source
  if (isSrcMain && isTgtMain) {
    const sIdx = src.idx;
    const tIdx = tgt.idx;
    if (tIdx <= sIdx) return;
    const steps = flow.steps;
    const head = sIdx === -1 ? [] : steps.slice(0, sIdx + 1);
    const orphan = steps.slice(sIdx + 1, tIdx);
    const tail = steps.slice(tIdx);
    flow.steps = [...head, ...tail];
    if (orphan.length) {
      const disc = flow.$ui?.disconnected ?? [];
      disc.push({ steps: orphan });
      flow.$ui = { ...(flow.$ui ?? {}), disconnected: disc };
    }
    return;
  }

  // Case 2: source in disconnected, target in main -> splice chain before target
  if (!isSrcMain && isTgtMain && src.arr && tgt.arr) {
    const chain = src.arr.slice(src.idx);
    src.arr.splice(src.idx, chain.length);
    if (typeof src.discIdx === "number" && src.arr.length === 0) {
      const discList = flow.$ui?.disconnected ?? [];
      discList.splice(src.discIdx, 1);
      flow.$ui = { ...(flow.$ui ?? {}), disconnected: discList };
    }
    const tIdx = tgt.idx;
    const steps = flow.steps;
    const before = steps.slice(0, tIdx);
    const after = steps.slice(tIdx);
    flow.steps = [...before, ...chain, ...after];
    return;
  }

  // Case 3: source main, target in disconnected -> attach that fragment after source, orphan everything after source
  if (isSrcMain && !isTgtMain && tgt.arr) {
    const steps = flow.steps;
    const sIdx = src.idx;
    const head = steps.slice(0, sIdx + 1);
    const orphan = steps.slice(sIdx + 1);
    const attach = tgt.arr.slice(tgt.idx);
    tgt.arr.splice(tgt.idx, attach.length);
    if (typeof tgt.discIdx === "number" && tgt.arr.length === 0) {
      const discList = flow.$ui?.disconnected ?? [];
      discList.splice(tgt.discIdx, 1);
      flow.$ui = { ...(flow.$ui ?? {}), disconnected: discList };
    }
    flow.steps = [...head, ...attach];
    if (orphan.length) {
      const disc = flow.$ui?.disconnected ?? [];
      disc.push({ steps: orphan });
      flow.$ui = { ...(flow.$ui ?? {}), disconnected: disc };
    }
    return;
  }
}

function setStepParam(flow: FlowWithUi, path: string, key: string, value: any) {
  const step = getStep(flow, path);
  if (!step) return;
  step.parameters = { ...(step.parameters ?? {}), [key]: value };
}

function setTriggerUi(inputs: any[], path: string, ui: UiMeta) {
  // path like inputs[0].triggers[1]
  const match = path.match(/inputs\[(\d+)\]\.triggers\[(\d+)\]/);
  if (!match) return;
  const [, iStr, tStr] = match;
  const i = Number(iStr);
  const t = Number(tStr);
  if (!inputs[i]) return;
  const triggers = inputs[i].triggers ?? [];
  if (!triggers[t]) return;
  triggers[t] = { ...(triggers[t] ?? {}), $ui: { ...(triggers[t]?.$ui ?? {}), ...ui } };
  inputs[i] = { ...inputs[i], triggers: [...triggers] };
}

export const useAppStore = create<AppStore>((set, get) => ({
  app: defaultState,
  loadYaml: (text) => set({ app: parse(text) }),
  toYaml: () => dump(get().app),
  setFlows: (flows) => set((state) => ({ app: { ...state.app, flows } })),
  updateStepUi: (flowName, stepPath, ui) =>
    set((state) => {
      const flows = state.app.flows.map((f) => {
        if (f.name !== flowName) return f;
        const copy: FlowWithUi = JSON.parse(JSON.stringify(f));
        setStepUi(copy, stepPath, ui);
        return copy;
      });
      return { app: { ...state.app, flows } };
    }),
  updateStepCallTarget: (flowName, stepPath, paramName, targetPath) =>
    set((state) => {
      const flows = state.app.flows.map((f) => {
        if (f.name !== flowName) return f;
        const copy: FlowWithUi = JSON.parse(JSON.stringify(f));
        setStepCall(copy, stepPath, paramName, targetPath);
        return copy;
      });
      return { app: { ...state.app, flows } };
    }),
  moveStepChainAfter: (flowName, sourceStepPath, targetStepPath) =>
    set((state) => {
      const flows = state.app.flows.map((f) => {
        if (f.name !== flowName) return f;
        const copy: FlowWithUi = JSON.parse(JSON.stringify(f));
        moveChain(copy, sourceStepPath, targetStepPath);
        return copy;
      });
      return { app: { ...state.app, flows } };
    }),
  updateTriggerUi: (triggerPath, ui) =>
    set((state) => {
      const inputs = JSON.parse(JSON.stringify(state.app.inputs ?? []));
      setTriggerUi(inputs, triggerPath, ui);
      return { app: { ...state.app, inputs } };
    }),
  updateNodeUi: (flowName, path, ui) => {
    if (path === "$ui") {
      return set((state) => {
        const flows = state.app.flows.map((f) => (f.name === flowName ? { ...f, $ui: { ...(f.$ui ?? {}), ...ui } } : f));
        return { app: { ...state.app, flows } };
      });
    }
    if (path.startsWith("inputs[")) {
      return (useAppStore.getState() as any).updateTriggerUi(path, ui);
    }
    return (useAppStore.getState() as any).updateStepUi(flowName, path, ui);
  },
  addDisconnected: (flowName, steps) =>
    set((state) => {
      const flows = state.app.flows.map((f) => {
        if (f.name !== flowName) return f;
        const disc = f.$ui?.disconnected ?? [];
        return { ...f, $ui: { ...(f.$ui ?? {}), disconnected: [...disc, { steps }] } } as FlowWithUi;
      });
      return { app: { ...state.app, flows } };
    }),
  addTrigger: (type, flowName) =>
    set((state) => {
      const inputs = state.app.inputs.map((i) => ({ ...i, triggers: i.triggers ? [...i.triggers] : [] }));
      let target = inputs.find((i) => i.type === type);
      if (!target) {
        target = { type, config: {}, triggers: [] as any[] };
        inputs.push(target);
      }
      target.triggers = [...(target.triggers ?? []), { flow: flowName, $ui: { x: 40, y: 160 + (target.triggers?.length ?? 0) * 90 } }];
      return { app: { ...state.app, inputs } };
    }),
  addClosureStep: (flowIdx, closureName) =>
    set((state) => {
      const flows = state.app.flows.map((f) => ({ ...f, steps: [...(f.steps ?? [])] }));
      const flow = flows[flowIdx] ?? flows[0];
      if (!flow) return state;
      flow.steps = [
        ...(flow.steps ?? []),
        { closure: closureName, parameters: {}, $ui: { id: nanoid(), x: 240, y: 200 + (flow.steps?.length ?? 0) * 120 } }
      ];
      flows[flowIdx] = flow;
      return { app: { ...state.app, flows } };
    }),
  updateStepParam: (flowName, stepPath, key, value) =>
    set((state) => {
      const flows = state.app.flows.map((f) => {
        if (f.name !== flowName) return f;
        const copy: FlowWithUi = JSON.parse(JSON.stringify(f));
        setStepParam(copy, stepPath, key, value);
        return copy;
      });
      return { app: { ...state.app, flows } };
    }),
  updateTriggerField: (triggerPath, key, value) =>
    set((state) => {
      const inputs = JSON.parse(JSON.stringify(state.app.inputs ?? []));
      const match = triggerPath.match(/inputs\[(\d+)\]\.triggers\[(\d+)\]/);
      if (!match) return state;
      const [, iStr, tStr] = match;
      const i = Number(iStr);
      const t = Number(tStr);
      if (!inputs[i] || !inputs[i].triggers?.[t]) return state;
      const trig = { ...(inputs[i].triggers[t] ?? {}) };
      trig[key] = value;
      inputs[i].triggers[t] = trig;
      return { app: { ...state.app, inputs } };
    }),
  updateInputConfig: (inputIdx, key, value) =>
    set((state) => {
      const inputs = JSON.parse(JSON.stringify(state.app.inputs ?? []));
      if (!inputs[inputIdx]) return state;
      const cfg = { ...(inputs[inputIdx].config ?? {}) };
      cfg[key] = value;
      inputs[inputIdx] = { ...inputs[inputIdx], config: cfg };
      return { app: { ...state.app, inputs } };
    }),
}));
