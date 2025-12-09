import { create } from "zustand";
import yaml from "js-yaml";
import { nanoid } from "../utils/id";

export type UiMeta = { x?: number; y?: number; w?: number; h?: number; color?: string; collapsed?: boolean; id?: string };
export type StepWithUi = any & { $ui?: UiMeta };
export type FlowWithUi = { name: string; steps: StepWithUi[]; $ui?: { id?: string; x?: number; y?: number; disconnected?: { steps: StepWithUi[] }[] } };

export interface AppState {
  version: number;
  inputs: any[];
  closures: FlowWithUi[];
  flows: FlowWithUi[];
}

interface AppStore {
  app: AppState;
  loadYaml: (text: string) => void;
  toYaml: () => string;
  setFlows: (flows: FlowWithUi[]) => void;
  addFlow: (name?: string) => void;
  addClosure: (name?: string) => void;
  renameFlow: (idx: number, name: string) => void;
  renameClosure: (idx: number, name: string) => void;
  removeFlow: (idx: number) => void;
  removeClosure: (idx: number) => void;
  updateStepUi: (flowName: string, stepPath: string, ui: UiMeta) => void;
  updateStepCallTarget: (flowName: string, stepPath: string, paramName: string, targetPath: string | null) => void;
  attachCallChain: (flowName: string, stepPath: string, paramName: string, targetPath: string) => void;
  attachFlowStepsChain: (flowName: string, stepPath: string, paramName: string, targetPath: string) => void;
  moveStepChainAfter: (flowName: string, sourceStepPath: string, targetStepPath: string) => void;
  updateTriggerUi: (triggerPath: string, ui: UiMeta) => void;
  updateNodeUi: (flowName: string, path: string, ui: UiMeta) => void;
  addDisconnected: (flowName: string, steps: StepWithUi[]) => void;
  addTrigger: (type: string, flowName: string) => void;
  addClosureStep: (collection: "flows" | "closures", idx: number, closureName: string) => void;
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
      Object.values(s.parameters ?? {}).forEach((p: any) => {
        if (p?.steps) seedIds(p.steps);
        if (p?.$call?.steps) seedIds(p.$call.steps);
      });
    });
  };
  const seedFlow = (f: any) => {
    f.$ui = f.$ui ?? { id: nanoid(), x: 60, y: 120, disconnected: [] };
    f.$ui.id = f.$ui.id ?? nanoid();
    f.$ui.x = f.$ui.x ?? 60;
    f.$ui.y = f.$ui.y ?? 120;
    seedIds(f.steps ?? []);
    (f?.$ui?.disconnected ?? []).forEach((d: any) => seedIds(d.steps ?? []));
  };
  (obj?.flows ?? []).forEach(seedFlow);
  (obj?.closures ?? []).forEach(seedFlow);

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
    if (mSteps) { cursor = cursor?.steps?.[Number(mSteps[1])]; continue; }

    const mCases = part.match(/^cases\[(\d+)\]$/);
    if (mCases) { cursor = cursor?.cases?.[Number(mCases[1])]; continue; }

    if (part === 'otherwise') { cursor = cursor?.otherwise; continue; }

    const mDisc = part.match(/^\$ui\.disconnected\[(\d+)\]$/);
    if (mDisc) { cursor = cursor?.$ui?.disconnected?.[Number(mDisc[1])]; continue; }

    if (part === 'parameters') { cursor = cursor?.parameters ?? (cursor.parameters = {}); continue; }

    if (cursor?.parameters && Object.prototype.hasOwnProperty.call(cursor.parameters, part)) { cursor = cursor.parameters[part]; continue; }
    if (cursor && typeof cursor === 'object' && part in cursor && !Array.isArray(cursor)) { cursor = (cursor as any)[part]; continue; }
    if (part === '$call') { cursor = cursor?.$call; continue; }
    if (part === '$ui') { cursor = cursor?.$ui ?? (cursor.$ui = {}); continue; }

    const arrIdx = part.match(/^\[(\d+)\]$/);
    if (arrIdx && Array.isArray(cursor)) { cursor = cursor[Number(arrIdx[1])]; continue; }
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

function resolveStepArray(flow: FlowWithUi, path: string): { arr: StepWithUi[]; idx: number; discIdx?: number; parentStepPath?: string; paramName?: string } | null {
  if (path === "start") return { arr: flow.steps, idx: -1 };
  const main = path.match(/^steps\[(\d+)\]$/);
  if (main) return { arr: flow.steps, idx: Number(main[1]) };
  const disc = path.match(/^\$ui\.disconnected\[(\d+)\]\.steps\[(\d+)\]$/);
  if (disc) {
    const di = Number(disc[1]);
    const si = Number(disc[2]);
    const arr = flow.$ui?.disconnected?.[di]?.steps;
    if (!arr) return null;
    return { arr, idx: si, discIdx: di };
  }
  const paramSteps = path.match(/^(.*)\.parameters\.([^.]+)\.steps\[(\d+)\]$/);
  if (paramSteps) {
    const parentPath = paramSteps[1];
    const paramName = paramSteps[2];
    const idx = Number(paramSteps[3]);
    const parent = getStep(flow, parentPath);
    const arr = parent?.parameters?.[paramName]?.steps;
    if (!Array.isArray(arr)) return null;
    return { arr, idx, parentStepPath: parentPath, paramName };
  }
  const callSteps = path.match(/^(.*)\.parameters\.([^.]+)\.\$call\.steps\[(\d+)\]$/);
  if (callSteps) {
    const parentPath = callSteps[1];
    const paramName = callSteps[2];
    const idx = Number(callSteps[3]);
    const parent = getStep(flow, parentPath);
    const arr = parent?.parameters?.[paramName]?.$call?.steps;
    if (!Array.isArray(arr)) return null;
    return { arr, idx, parentStepPath: parentPath, paramName };
  }
  return null;
}

function detachChain(
  flow: FlowWithUi,
  targetPath: string,
  callerCtx?: { arr: StepWithUi[]; idx: number }
): { chain: StepWithUi[]; flow: FlowWithUi } | null {
  const tgt = resolveStepArray(flow, targetPath);
  if (!tgt) return null;
  if (tgt.idx < 0) return null;
  // default: detach tail
  let len = tgt.arr.length - tgt.idx;
  // if target is in same array as caller and before/at caller, detach only that node
  if (callerCtx && callerCtx.arr === tgt.arr && tgt.idx <= callerCtx.idx) {
    len = 1;
  }
  const chain = tgt.arr.splice(tgt.idx, len);
  if (typeof tgt.discIdx === "number" && tgt.arr.length === 0) {
    const disc = flow.$ui?.disconnected ?? [];
    disc.splice(tgt.discIdx, 1);
    flow.$ui = { ...(flow.$ui ?? {}), disconnected: disc };
  }
  return { chain, flow };
}

function reseedUiIds(steps: StepWithUi[]) {
  steps.forEach((s) => {
    s.$ui = s.$ui ?? {};
    s.$ui.id = nanoid();
    // ensure embedded steps keep closure/type if present
    if (!s.closure && s.type) s.closure = s.type;
    if (Array.isArray(s.cases)) s.cases.forEach((c: any) => reseedUiIds(c.steps ?? []));
    if (Array.isArray((s as any).otherwise)) reseedUiIds((s as any).otherwise as any);
    Object.values(s.parameters ?? {}).forEach((p: any) => {
      if (p?.steps) reseedUiIds(p.steps);
      if (p?.$call?.steps) reseedUiIds(p.$call.steps);
    });
  });
}

function moveChain(flow: FlowWithUi, sourcePath: string, targetPath: string) {
  const src = resolveStepArray(flow, sourcePath);
  const tgt = resolveStepArray(flow, targetPath);
  if (!src || !tgt || !flow.steps) return;
  // prevent ancestor/descendant cycles
  const isBoundaryPrefix = (a: string, b: string) => b === a || b.startsWith(a + ".");
  if (isBoundaryPrefix(sourcePath, targetPath) || isBoundaryPrefix(targetPath, sourcePath)) return;

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
  }
}

function attachCallChain(flow: FlowWithUi, callerPath: string, paramName: string, targetPath: string) {
  const isBoundaryPrefix = (a: string, b: string) => b === a || b.startsWith(a + ".") || a === b;
  if (isBoundaryPrefix(callerPath, targetPath) || isBoundaryPrefix(targetPath, callerPath)) return;
  const caller = getStep(flow, callerPath);
  const callerCtx = resolveStepArray(flow, callerPath);
  if (!caller) return;
  const detached = detachChain(flow, targetPath, callerCtx ?? undefined);
  if (!detached) return;
  reseedUiIds(detached.chain);
  caller.parameters = caller.parameters ?? {};
  caller.parameters[paramName] = { $call: { steps: detached.chain } };
}

function attachFlowStepsChain(flow: FlowWithUi, callerPath: string, paramName: string, targetPath: string) {
  const isBoundaryPrefix = (a: string, b: string) => b === a || b.startsWith(a + ".") || a === b;
  if (isBoundaryPrefix(callerPath, targetPath) || isBoundaryPrefix(targetPath, callerPath)) return;
  const caller = getStep(flow, callerPath);
  const callerCtx = resolveStepArray(flow, callerPath);
  if (!caller) return;
  const detached = detachChain(flow, targetPath, callerCtx ?? undefined);
  if (!detached) return;
  reseedUiIds(detached.chain);

  const segments: (string | number)[] = [];
  paramName.split('.').forEach((part) => {
    const regex = /([\w$]+)(\[(\d+)\])?/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(part)) !== null) {
      if (m[1]) segments.push(m[1]);
      if (m[3] !== undefined) segments.push(Number(m[3]));
    }
  });

  caller.parameters = caller.parameters ?? {};
  let cursor: any = caller.parameters;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const last = i === segments.length - 1;
    if (last) {
      if (typeof seg === 'number') {
        if (!Array.isArray(cursor)) cursor = [];
        cursor[seg] = detached.chain;
      } else {
        cursor[seg] = detached.chain;
      }
      break;
    }
    const nextSeg = segments[i + 1];
    if (typeof seg === 'number') {
      if (!Array.isArray(cursor)) {
        // reattach to parent if lost
        return;
      }
      cursor[seg] = cursor[seg] ?? (typeof nextSeg === 'number' ? [] : {});
      cursor = cursor[seg];
    } else {
      cursor[seg] = cursor[seg] ?? (typeof nextSeg === 'number' ? [] : {});
      cursor = cursor[seg];
    }
  }
}

function setStepParam(flow: FlowWithUi, path: string, key: string, value: any) {
  const step = getStep(flow, path);
  if (!step) return;
  step.parameters = { ...(step.parameters ?? {}), [key]: value };
}

function findFlowOrClosure(app: AppState, name: string): { kind: "flows" | "closures"; idx: number } | null {
  const fIdx = app.flows.findIndex((f) => f.name === name);
  if (fIdx >= 0) return { kind: "flows", idx: fIdx };
  const cIdx = app.closures.findIndex((f) => f.name === name);
  if (cIdx >= 0) return { kind: "closures", idx: cIdx };
  return null;
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
  addFlow: (name = "New Flow") =>
    set((state) => {
      const flows = [...state.app.flows, { name, steps: [], $ui: { id: nanoid(), x: 60, y: 120, disconnected: [] } }];
      return { app: { ...state.app, flows } };
    }),
  addClosure: (name = "New Closure") =>
    set((state) => {
      const closures = [...state.app.closures, { name, steps: [], $ui: { id: nanoid(), x: 60, y: 120, disconnected: [] } }];
      return { app: { ...state.app, closures } };
    }),
  renameFlow: (idx, name) =>
    set((state) => {
      const flows = state.app.flows.map((f, i) => (i === idx ? { ...f, name } : f));
      const oldName = state.app.flows[idx]?.name;
      const inputs = (state.app.inputs ?? []).map((inp) => ({
        ...inp,
        triggers: (inp.triggers ?? []).map((t: any) => (oldName && t.flow === oldName ? { ...t, flow: name } : t))
      }));
      return { app: { ...state.app, flows, inputs } };
    }),
  renameClosure: (idx, name) =>
    set((state) => {
      const closures = state.app.closures.map((f, i) => (i === idx ? { ...f, name } : f));
      return { app: { ...state.app, closures } };
    }),
  removeFlow: (idx) =>
    set((state) => {
      const flows = state.app.flows.filter((_, i) => i !== idx);
      return { app: { ...state.app, flows } };
    }),
  removeClosure: (idx) =>
    set((state) => {
      const closures = state.app.closures.filter((_, i) => i !== idx);
      return { app: { ...state.app, closures } };
    }),
  updateStepUi: (flowName, stepPath, ui) =>
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithUi, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithUi = JSON.parse(JSON.stringify(f));
        setStepUi(copy, stepPath, ui);
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    }),
  updateStepCallTarget: (flowName, stepPath, paramName, targetPath) =>
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithUi, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithUi = JSON.parse(JSON.stringify(f));
        setStepCall(copy, stepPath, paramName, targetPath);
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    }),
  attachCallChain: (flowName, stepPath, paramName, targetPath) =>
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithUi, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithUi = JSON.parse(JSON.stringify(f));
        attachCallChain(copy, stepPath, paramName, targetPath);
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    }),
  attachFlowStepsChain: (flowName, stepPath, paramName, targetPath) =>
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithUi, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithUi = JSON.parse(JSON.stringify(f));
        attachFlowStepsChain(copy, stepPath, paramName, targetPath);
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    }),
  moveStepChainAfter: (flowName, sourceStepPath, targetStepPath) =>
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithUi, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithUi = JSON.parse(JSON.stringify(f));
        moveChain(copy, sourceStepPath, targetStepPath);
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
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
        const where = findFlowOrClosure(state.app, flowName);
        if (!where) return state;
        const list = state.app[where.kind].map((f: FlowWithUi) => (f.name === flowName ? { ...f, $ui: { ...(f.$ui ?? {}), ...ui } } : f));
        return { app: { ...state.app, [where.kind]: list } as AppState };
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
  addClosureStep: (collection, flowIdx, closureName) =>
    set((state) => {
      const key = collection === "closures" ? "closures" : "flows";
      const list = state.app[key].map((f: any) => ({ ...f, steps: [...(f.steps ?? [])] }));
      const flow = list[flowIdx] ?? list[0];
      if (!flow) return state;
      flow.steps = [
        ...(flow.steps ?? []),
        { closure: closureName, parameters: {}, $ui: { id: nanoid(), x: 240, y: 200 + (flow.steps?.length ?? 0) * 120 } }
      ];
      list[flowIdx] = flow;
      return { app: { ...state.app, [key]: list } as AppState };
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
