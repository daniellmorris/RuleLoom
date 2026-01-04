import { create } from "zustand";
import yaml from "js-yaml";
import { nanoid } from "../utils/id";
import { walkFlow, type StepVisit } from "./walk";

export type Meta = { x?: number; y?: number; w?: number; h?: number; color?: string; collapsed?: boolean; id?: string };
export type StepWithMeta = any & { $meta?: Meta };
export type FlowWithMeta = { name: string; steps: StepWithMeta[]; $meta?: { id?: string; x?: number; y?: number; disconnected?: { steps: StepWithMeta[] }[] } };

export type NodeIndexEntry = {
  id: string;
  path: string;
  kind: "start" | "step";
  arr?: StepWithMeta[];
  idx?: number;
  discIdx?: number;
};

export type NodeIndex = { byId: Record<string, NodeIndexEntry>; pathById: Record<string, string>; idByPath: Record<string, string> };

export type DashboardWidget = {
  type: string;
  title?: string;
  value?: number | string;
  size?: { w: number; h: number };
  position?: { col: number; row: number };
  props?: Record<string, unknown>;
};

export type DashboardEntry = {
  id: string;
  name: string;
  description?: string;
  layout: any; // stores Puck Data directly
};

export type DashboardsState = {
  config?: {
    defaultId?: string;
    currentId?: string;
    grid?: { cols?: number; rowHeight?: number; gap?: number };
  };
  list: DashboardEntry[];
};

const defaultDashboards: DashboardsState = {
  config: { defaultId: "main", currentId: "main", grid: { cols: 12, rowHeight: 120, gap: 12 } },
  list: [
    {
      id: "main",
      name: "Main Dashboard",
      layout: {
        content: [
          {
            type: "FlexColumn",
            props: {
              gap: 12,
              children: [
                {
                  type: "Panel",
                  props: {
                    title: "Recent Runs",
                    children: [
                      {
                        type: "TableWidget",
                        props: {
                          title: "Recent Runs",
                          data:
                            '{"columns":["flow","status","duration"],"rows":[{"flow":"orders","status":"ok","duration":"1200ms"},{"flow":"billing","status":"ok","duration":"980ms"},{"flow":"shipping","status":"warn","duration":"2400ms"}]}'
                        }
                      }
                    ]
                  }
                },
                {
                  type: "FlexRow",
                  props: {
                    gap: 12,
                    children: [
                      {
                        type: "MetricWidget",
                        props: { title: "Errors", value: "12" }
                      },
                      {
                        type: "MetricWidget",
                        props: { title: "Throughput", value: "1.2k/s" }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
};

export interface AppState {
  version: number;
  plugins: any[];
  inputs: any[];
  closures: FlowWithMeta[];
  flows: FlowWithMeta[];
  dashboards?: DashboardsState;
  view?: 'builder' | 'dashboards';
}

function normalizeApp(app: Partial<AppState>): AppState {
  return {
    version: app.version ?? 1,
    plugins: Array.isArray(app.plugins) ? app.plugins : [],
    inputs: Array.isArray(app.inputs) ? app.inputs : [],
    closures: Array.isArray(app.closures) ? app.closures : [],
    flows: Array.isArray(app.flows) ? app.flows : [],
    dashboards: app.dashboards ?? defaultDashboards
  };
}

interface AppStore {
  app: AppState;
  loadYaml: (text: string) => void;
  toYaml: () => string;
  setPlugins: (plugins: any[]) => void;
  addPlugin: (plugin: any) => void;
  setFlows: (flows: FlowWithMeta[]) => void;
  addFlow: (name?: string) => void;
  addClosure: (name?: string) => void;
  renameFlow: (idx: number, name: string) => void;
  renameClosure: (idx: number, name: string) => void;
  removeFlow: (idx: number) => void;
  removeClosure: (idx: number) => void;
  setView: (view: 'builder' | 'dashboards') => void;
  setCurrentDashboard: (id: string) => void;
  addDashboard: (name?: string, layout?: any) => void;
  updateDashboardLayout: (id: string, layout: any) => void;
  attachCallChain: (flowName: string, fromId: string, paramName: string, targetId: string) => OperationResult;
  attachFlowStepsChain: (flowName: string, fromId: string, paramName: string, targetId: string) => OperationResult;
  moveStepChainAfter: (flowName: string, sourceId: string, targetId: string) => OperationResult;
  removeConnection: (flowName: string, fromId: string, toId: string, label?: string) => OperationResult;
  deleteNode: (flowName: string, nodeId: string) => OperationResult;
  updateNodeUi: (flowName: string, nodeId: string, ui: Meta) => void;
  addDisconnected: (flowName: string, steps: StepWithMeta[]) => void;
  addTrigger: (type: string, flowName: string) => void;
  addClosureStep: (collection: "flows" | "closures", idx: number, closureName: string) => void;
  updateStepParam: (flowName: string, nodeId: string, key: string, value: any) => void;
  updateTriggerField: (triggerId: string, key: string, value: any) => void;
  updateInputConfig: (inputIdx: number, key: string, value: any) => void;
}

type OperationResult = { ok: true } | { ok: false; error: string };

const defaultState: AppState = {
  version: 1,
  plugins: [],
  inputs: [],
  closures: [],
  flows: [
    {
      name: "Flow 1",
      steps: [],
      $meta: { id: nanoid(), x: 1000, y: 1000, disconnected: [] }
    }
  ],
  dashboards: defaultDashboards,
  view: "builder"
};

function ensureFlowMeta(flow: FlowWithMeta) {
  flow.$meta = flow.$meta ?? { id: nanoid(), x: 1000, y: 1000, disconnected: [] };
  flow.$meta.id = flow.$meta.id ?? nanoid();
  flow.$meta.x = flow.$meta.x ?? 1000;
  flow.$meta.y = flow.$meta.y ?? 1000;
  flow.$meta.disconnected = flow.$meta.disconnected ?? [];
}

function ensureStepMeta(step: StepWithMeta) {
  step.$meta = step.$meta ?? {};
  step.$meta.id = step.$meta.id ?? nanoid();
}

export function buildNodeIndex(flow: FlowWithMeta): NodeIndex {
  ensureFlowMeta(flow);
  const meta = flow.$meta as NonNullable<FlowWithMeta["$meta"]>;
  const index: NodeIndex = { byId: {}, pathById: {}, idByPath: {} };
  const record = (id: string, path: string, entry: NodeIndexEntry) => {
    index.byId[id] = entry;
    index.pathById[id] = path;
    index.idByPath[path] = id;
  };

  record(meta.id as string, "start", { id: meta.id as string, path: "start", kind: "start", arr: flow.steps, idx: -1 });

  const visits: StepVisit[] = walkFlow(flow).steps;
  visits.forEach((v) => {
    ensureStepMeta(v.step);
    record(v.step.$meta?.id as string, v.path, {
      id: v.step.$meta?.id as string,
      path: v.path,
      kind: "step",
      arr: v.arr,
      idx: v.idx,
      discIdx: v.discIdx
    });
  });

  return index;
}

function parse(text: string): AppState {
  const obj = yaml.load(text) as any;
  const seedIds = (steps: StepWithMeta[]) => {
    steps.forEach((s) => {
      ensureStepMeta(s);
      if (Array.isArray(s.cases)) s.cases.forEach((c: any) => seedIds(c.steps ?? []));
      if (Array.isArray((s as any).otherwise)) seedIds((s as any).otherwise as any);
      Object.values(s.parameters ?? {}).forEach((p: any) => {
        if (p?.steps) seedIds(p.steps);
        if (p?.$call?.steps) seedIds(p.$call.steps);
      });
    });
  };
  const seedFlow = (f: any) => {
    ensureFlowMeta(f);
    seedIds(f.steps ?? []);
    (f?.$meta?.disconnected ?? []).forEach((d: any) => seedIds(d.steps ?? []));
  };
  (obj?.flows ?? []).forEach(seedFlow);
  (obj?.closures ?? []).forEach(seedFlow);
  (obj?.inputs ?? []).forEach((inp: any) => {
    inp.triggers = inp.triggers ?? [];
    inp.triggers.forEach((t: any, idx: number) => {
      t.$meta = t.$meta ?? {};
      t.$meta.id = t.$meta.id ?? nanoid();
      t.$meta.x = t.$meta.x ?? 40;
      t.$meta.y = t.$meta.y ?? 160 + idx * 90;
    });
  });

  return {
    version: obj?.version ?? 1,
    plugins: obj?.plugins ?? [],
    inputs: obj?.inputs ?? [],
    closures: obj?.closures ?? [],
    flows: obj?.flows ?? [],
    dashboards: obj?.dashboards ?? defaultDashboards
  };
}

function dump(app: AppState): string {
  return yaml.dump(app, { lineWidth: 120 });
}

function getStep(flow: FlowWithMeta, path: string): any {
  if (path === "start") return flow;
  const visit = walkFlow(flow).steps.find((v) => v.path === path);
  return visit?.step ?? null;
}

function setStepMeta(flow: FlowWithMeta, path: string, ui: Meta) {
  const step = getStep(flow, path);
  if (!step) return;
  step.$meta = { ...(step.$meta ?? {}), ...ui };
}

function setStepCall(flow: FlowWithMeta, path: string, paramName: string, targetPath: string | null) {
  const step = getStep(flow, path);
  if (!step) return;
  if (!step.parameters) step.parameters = {};
  if (targetPath) step.parameters[paramName] = { $call: targetPath };
  else delete step.parameters[paramName];
}

function resolveStepArray(flow: FlowWithMeta, path: string): { arr: StepWithMeta[]; idx: number; discIdx?: number } | null {
  if (path === "start") return { arr: flow.steps, idx: -1 };
  const visit = walkFlow(flow).steps.find((v) => v.path === path);
  if (!visit) return null;
  return { arr: visit.arr, idx: visit.idx, discIdx: visit.discIdx };
}

function clearPathValue(root: any, path: string) {
  const parts = path.split('.').filter(Boolean);
  let cursor = root as any;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const keyIdx = part.match(/^([\w$]+)\[(\d+)\]$/);
    const last = i === parts.length - 1;
    if (keyIdx) {
      const [, key, idxStr] = keyIdx;
      const idx = Number(idxStr);
      if (!cursor || typeof cursor !== "object" || !(key in cursor) || !Array.isArray(cursor[key])) return;
      if (last) {
        cursor[key].splice(idx, 1);
        if (cursor[key].length === 0) delete cursor[key];
      } else {
        cursor = cursor[key][idx];
      }
      continue;
    }
    if (Array.isArray(cursor) && part.match(/^\d+$/)) {
      const idx = Number(part);
      if (last) {
        cursor.splice(idx, 1);
      } else {
        cursor = cursor[idx];
      }
      continue;
    }
    if (last) {
      delete cursor?.[part];
    } else {
      cursor = cursor?.[part];
    }
  }
}

function detachChain(
  flow: FlowWithMeta,
  targetPath: string,
  callerCtx?: { arr: StepWithMeta[]; idx: number }
): { chain: StepWithMeta[]; flow: FlowWithMeta } | null {
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
    ensureFlowMeta(flow);
    const disc = flow.$meta!.disconnected ?? [];
    disc.splice(tgt.discIdx, 1);
    flow.$meta = { ...(flow.$meta ?? {}), disconnected: disc };
  }
  return { chain, flow };
}

function reseedMetaIds(steps: StepWithMeta[]) {
  steps.forEach((s) => {
    s.$meta = s.$meta ?? {};
    s.$meta.id = nanoid();
    // ensure embedded steps keep closure/type if present
    if (!s.closure && s.type) s.closure = s.type;
    if (Array.isArray(s.cases)) s.cases.forEach((c: any) => reseedMetaIds(c.steps ?? []));
    if (Array.isArray((s as any).otherwise)) reseedMetaIds((s as any).otherwise as any);
    Object.values(s.parameters ?? {}).forEach((p: any) => {
      if (p?.steps) reseedMetaIds(p.steps);
      if (p?.$call?.steps) reseedMetaIds(p.$call.steps);
    });
  });
}

function moveChain(flow: FlowWithMeta, sourcePath: string, targetPath: string): boolean {
  ensureFlowMeta(flow);
  const meta = flow.$meta!;
  const src = resolveStepArray(flow, sourcePath);
  const tgt = resolveStepArray(flow, targetPath);
  if (!src || !tgt || !flow.steps) return false;
  // prevent ancestor/descendant cycles
  const isBoundaryPrefix = (a: string, b: string) => b === a || b.startsWith(a + ".");
  if (isBoundaryPrefix(sourcePath, targetPath) || isBoundaryPrefix(targetPath, sourcePath)) return false;

  const isSrcMain = src.arr === flow.steps;
  const isTgtMain = tgt.arr === flow.steps;

  // Case 1: source and target both in main (start treated as idx -1); target must be after source
  if (isSrcMain && isTgtMain) {
    const sIdx = src.idx;
    const tIdx = tgt.idx;
    if (tIdx <= sIdx) return false;
    const steps = flow.steps;
    const head = sIdx === -1 ? [] : steps.slice(0, sIdx + 1);
    const orphan = steps.slice(sIdx + 1, tIdx);
    const tail = steps.slice(tIdx);
    flow.steps = [...head, ...tail];
    if (orphan.length) {
      const disc = meta.disconnected ?? [];
      disc.push({ steps: orphan });
      flow.$meta = { ...(meta ?? {}), disconnected: disc };
    }
    return true;
  }

  // Case 2: source in disconnected, target in main -> splice chain before target
  if (!isSrcMain && isTgtMain && src.arr && tgt.arr) {
    const chain = src.arr.slice(src.idx);
    src.arr.splice(src.idx, chain.length);
    if (typeof src.discIdx === "number" && src.arr.length === 0) {
      const discList = meta.disconnected ?? [];
      discList.splice(src.discIdx, 1);
      flow.$meta = { ...(meta ?? {}), disconnected: discList };
    }
    const tIdx = tgt.idx;
    const steps = flow.steps;
    const before = steps.slice(0, tIdx);
    const after = steps.slice(tIdx);
    flow.steps = [...before, ...chain, ...after];
    return true;
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
      const discList = meta.disconnected ?? [];
      discList.splice(tgt.discIdx, 1);
      flow.$meta = { ...(meta ?? {}), disconnected: discList };
    }
    flow.steps = [...head, ...attach];
    if (orphan.length) {
      const disc = meta.disconnected ?? [];
      disc.push({ steps: orphan });
      flow.$meta = { ...(meta ?? {}), disconnected: disc };
    }
    return true;
  }

  // Case 4: both disconnected -> splice source chain after target in target array
  if (!isSrcMain && !isTgtMain && src.arr && tgt.arr) {
    // Same fragment: reorder similar to main flow
    if (src.arr === tgt.arr) {
      const sIdx = src.idx;
      const tIdx = tgt.idx;
      if (tIdx <= sIdx) return false;
      const head = src.arr.slice(0, sIdx + 1);
      const orphan = src.arr.slice(sIdx + 1, tIdx);
      const tail = src.arr.slice(tIdx);
      src.arr.length = 0;
      src.arr.push(...head, ...tail);
      if (orphan.length) {
        const disc = meta.disconnected ?? [];
        disc.push({ steps: orphan });
        flow.$meta = { ...(meta ?? {}), disconnected: disc };
      }
      return true;
    }

    // Different fragments: splice source chain before target in target fragment
    const chain = src.arr.slice(src.idx);
    src.arr.splice(src.idx, chain.length);
    if (typeof src.discIdx === "number" && src.arr.length === 0) {
      const discList = meta.disconnected ?? [];
      discList.splice(src.discIdx, 1);
      flow.$meta = { ...(meta ?? {}), disconnected: discList };
    }
    const insertPos = Math.max(0, Math.min(tgt.idx, tgt.arr.length));
    tgt.arr.splice(insertPos, 0, ...chain);
    return true;
  }

  return false;
}

function attachCallChainByPath(flow: FlowWithMeta, callerPath: string, paramName: string, targetPath: string) {
  const isBoundaryPrefix = (a: string, b: string) => b === a || b.startsWith(a + ".") || a === b;
  if (isBoundaryPrefix(callerPath, targetPath) || isBoundaryPrefix(targetPath, callerPath)) return;
  const caller = getStep(flow, callerPath);
  const callerCtx = resolveStepArray(flow, callerPath);
  if (!caller) return;
  const detached = detachChain(flow, targetPath, callerCtx ?? undefined);
  if (!detached) return;
  reseedMetaIds(detached.chain);
  caller.parameters = caller.parameters ?? {};
  caller.parameters[paramName] = { $call: { steps: detached.chain } };
}

function attachFlowStepsChainByPath(flow: FlowWithMeta, callerPath: string, paramName: string, targetPath: string) {
  const isBoundaryPrefix = (a: string, b: string) => b === a || b.startsWith(a + ".") || a === b;
  if (isBoundaryPrefix(callerPath, targetPath) || isBoundaryPrefix(targetPath, callerPath)) return;
  const caller = getStep(flow, callerPath);
  const callerCtx = resolveStepArray(flow, callerPath);
  if (!caller) return;
  const detached = detachChain(flow, targetPath, callerCtx ?? undefined);
  if (!detached) return;
  reseedMetaIds(detached.chain);

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

function setStepParam(flow: FlowWithMeta, path: string, key: string, value: any) {
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

function findTriggerById(inputs: any[], triggerId: string): { inputIdx: number; triggerIdx: number } | null {
  for (let i = 0; i < inputs.length; i++) {
    const triggers = inputs[i]?.triggers ?? [];
    for (let t = 0; t < triggers.length; t++) {
      const meta = triggers[t]?.$meta;
      if (meta?.id === triggerId) {
        return { inputIdx: i, triggerIdx: t };
      }
    }
  }
  return null;
}

function findStepById(flow: FlowWithMeta, id: string): { step: StepWithMeta | null; path: string | null } {
  const visit = walkFlow(flow).steps.find((v) => v.step?.$meta?.id === id);
  return visit ? { step: visit.step, path: visit.path } : { step: null, path: null };
}

function disconnectedGuard(loc?: NodeIndexEntry): string | null {
  if (!loc) return "Node not found";
  if (typeof loc.discIdx === "number" && (loc.idx ?? 0) > 0) {
    return "Node must be the first step in a disconnected chain before connecting.";
  }
  return null;
}

export const useAppStore = create<AppStore>((set, get) => ({
  app: defaultState,
  loadYaml: (text) => set({ app: normalizeApp(parse(text)) }),
  toYaml: () => dump(normalizeApp(get().app)),
  setView: (view) => set((state) => ({ app: { ...state.app, view } })),
  setPlugins: (plugins) =>
    set((state) => ({
      app: { ...state.app, plugins: Array.isArray(plugins) ? plugins : [] },
    })),
  addPlugin: (plugin) =>
    set((state) => ({
      app: { ...state.app, plugins: upsertPlugin(state.app.plugins, plugin) },
    })),
  setFlows: (flows) => set((state) => ({ app: { ...state.app, flows } })),
  addFlow: (name = "New Flow") =>
    set((state) => {
      const flows = [...state.app.flows, { name, steps: [], $meta: { id: nanoid(), x: 60, y: 120, disconnected: [] } }];
      return { app: { ...state.app, flows } };
    }),
  addClosure: (name = "New Closure") =>
    set((state) => {
      const closures = [...state.app.closures, { name, steps: [], $meta: { id: nanoid(), x: 60, y: 120, disconnected: [] } }];
      return { app: { ...state.app, closures } };
    }),
  setCurrentDashboard: (id) =>
    set((state) => {
      const dashboards = state.app.dashboards ?? defaultDashboards;
      return { app: { ...state.app, dashboards: { ...dashboards, config: { ...dashboards.config, currentId: id } } } };
    }),
  addDashboard: (name = "New Dashboard", layout) =>
    set((state) => {
      const dashboards = state.app.dashboards ?? defaultDashboards;
      const id = nanoid();
      const nextDash = {
        id,
        name,
        layout:
          layout ??
          {
            version: 1,
            regions: [
              {
                id: "canvas",
                blocks: [{ name: "DashboardGrid", props: { widgets: [] } }]
              }
            ]
          }
      };
      return {
        app: {
          ...state.app,
          dashboards: {
            ...dashboards,
            config: { ...dashboards.config, currentId: id },
            list: [...(dashboards.list ?? []), nextDash]
          }
        }
      };
    }),
  updateDashboardLayout: (id, layout) =>
    set((state) => {
      const dashboards = state.app.dashboards ?? defaultDashboards;
      const list = (dashboards.list ?? []).map((d) => (d.id === id ? { ...d, layout } : d));
      return { app: { ...state.app, dashboards: { ...dashboards, list } } };
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
  attachCallChain: (flowName, fromId, paramName, targetId) => {
    let outcome: OperationResult = { ok: false, error: "Node not found" };
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithMeta, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithMeta = JSON.parse(JSON.stringify(f));
        const index = buildNodeIndex(copy);
        const fromLoc = index.byId[fromId];
        const tgtLoc = index.byId[targetId];
        const guard = disconnectedGuard(tgtLoc);
        if (!fromLoc || !tgtLoc || guard) {
          outcome = { ok: false, error: guard ?? "Node not found" };
          return f;
        }
        const fromStep = getStep(copy, fromLoc.path);
        const existing = fromStep?.parameters?.[paramName];
        if (existing && ((Array.isArray(existing.steps) && existing.steps.length) || (existing.$call && (typeof existing.$call === "string" || Array.isArray(existing.$call?.steps))))) {
          outcome = { ok: false, error: "Remove existing connection first." };
          return f;
        }
        attachCallChainByPath(copy, fromLoc.path, paramName, tgtLoc.path);
        outcome = { ok: true };
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    });
    return outcome;
  },
  attachFlowStepsChain: (flowName, fromId, paramName, targetId) => {
    let outcome: OperationResult = { ok: false, error: "Node not found" };
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithMeta, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithMeta = JSON.parse(JSON.stringify(f));
        const index = buildNodeIndex(copy);
        const fromLoc = index.byId[fromId];
        const tgtLoc = index.byId[targetId];
        const guard = disconnectedGuard(tgtLoc);
        if (!fromLoc || !tgtLoc || guard) {
          outcome = { ok: false, error: guard ?? "Node not found" };
          return f;
        }
        const fromStep = getStep(copy, fromLoc.path);
        const existing = fromStep?.parameters?.[paramName];
        if (existing && ((Array.isArray(existing) && existing.length) || (Array.isArray(existing?.steps) && existing.steps.length))) {
          outcome = { ok: false, error: "Remove existing connection first." };
          return f;
        }
        attachFlowStepsChainByPath(copy, fromLoc.path, paramName, tgtLoc.path);
        outcome = { ok: true };
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    });
    return outcome;
  },
  moveStepChainAfter: (flowName, sourceId, targetId) => {
    let outcome: OperationResult = { ok: false, error: "Node not found" };
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithMeta, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithMeta = JSON.parse(JSON.stringify(f));
        const index = buildNodeIndex(copy);
        const srcLoc = index.byId[sourceId];
        const tgtLoc = index.byId[targetId];
        const guard = disconnectedGuard(tgtLoc);
        if (!srcLoc || !tgtLoc || guard) {
          outcome = { ok: false, error: guard ?? "Node not found" };
          return f;
        }
        // prevent overriding existing "next" without removal
        const walk = walkFlow(copy);
        const arrMeta = walk.arrays.find((a) => a.stepPaths.includes(srcLoc.path));
        const nextPath = arrMeta?.stepPaths[arrMeta.stepPaths.indexOf(srcLoc.path) + 1];
        if (nextPath && nextPath !== tgtLoc.path) {
          outcome = { ok: false, error: "Remove existing next connection first." };
          return f;
        }
        const moved = moveChain(copy, srcLoc.path, tgtLoc.path);
        outcome = moved ? { ok: true } : { ok: false, error: "Unable to move chain" };
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    });
    return outcome;
  },
  removeConnection: (flowName, fromId, toId, label) => {
    let outcome: OperationResult = { ok: false, error: "Connection not found" };
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithMeta, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithMeta = JSON.parse(JSON.stringify(f));
        ensureFlowMeta(copy);
        const index = buildNodeIndex(copy);
        const walk = walkFlow(copy);
        const fromPath = index.pathById[fromId];
        const toPath = index.pathById[toId];
        const fromVisit = walk.steps.find((v) => v.path === fromPath);
        const toVisit = walk.steps.find((v) => v.path === toPath);
        // special case start -> first
        if (fromPath === "start" && toVisit) {
          const main = copy.steps ?? [];
          const tail = main.splice(toVisit.idx);
          if (tail.length) {
            const meta = copy.$meta ?? {};
            copy.$meta = { ...meta, disconnected: [...(meta.disconnected ?? []), { steps: tail }] };
            outcome = { ok: true };
            return copy;
          }
        }
        if (!fromVisit || !toVisit) {
          outcome = { ok: false, error: "Connection not found" };
          return f;
        }

        // find array meta containing the target
        const arrMeta = walk.arrays.find((a) => a.stepPaths.includes(toPath));
        if (arrMeta?.parentStepPath) {
          // parameter flowSteps: detach entire array, clear param slot, push to disconnected
          const parent = getStep(copy, arrMeta.parentStepPath);
          if (!parent) {
            outcome = { ok: false, error: "Parent not found" };
            return f;
          }
          const detached = arrMeta.steps.splice(0, arrMeta.steps.length);
          const meta = copy.$meta ?? {};
          copy.$meta = { ...meta, disconnected: [...(meta.disconnected ?? []), { steps: detached }] };
          clearPathValue(parent, arrMeta.pathPrefix.replace(`${arrMeta.parentStepPath}.`, "").replace(/\.$/, ""));
          outcome = { ok: true };
          return copy;
        }

        // main flow: if consecutive in same array, detach tail starting at target into disconnected
        if (fromVisit.arr === toVisit.arr && toVisit.idx === fromVisit.idx + 1) {
          const tail = fromVisit.arr.splice(toVisit.idx);
          if (tail.length) {
            const meta = copy.$meta ?? {};
            copy.$meta = { ...meta, disconnected: [...(meta.disconnected ?? []), { steps: tail }] };
            outcome = { ok: true };
            return copy;
          }
        }

        // fallback: detach target chain into disconnected
        const chainCtx = detachChain(copy, toPath, { arr: fromVisit.arr, idx: fromVisit.idx });
        if (chainCtx?.chain?.length) {
          const meta = copy.$meta ?? {};
          copy.$meta = { ...meta, disconnected: [...(meta.disconnected ?? []), { steps: chainCtx.chain }] };
          outcome = { ok: true };
          return copy;
        }

        outcome = { ok: false, error: "Unable to remove connection" };
        return f;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    });
    return outcome;
  },
  deleteNode: (flowName, nodeId) => {
    let outcome: OperationResult = { ok: false, error: "Node not found" };
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithMeta, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithMeta = JSON.parse(JSON.stringify(f));
        const removed = removeStepById(copy, nodeId);
        outcome = removed ? { ok: true } : { ok: false, error: "Cannot delete this node" };
        return removed ? copy : f;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    });
    return outcome;
  },
  updateNodeUi: (flowName, nodeId, ui) =>
    set((state) => {
      const inputs = JSON.parse(JSON.stringify(state.app.inputs ?? []));
      const triggerLoc = findTriggerById(inputs, nodeId);
      if (triggerLoc) {
        const triggers = inputs[triggerLoc.inputIdx].triggers ?? [];
        const current = triggers[triggerLoc.triggerIdx] ?? {};
        const meta = current.$meta ?? {};
        triggers[triggerLoc.triggerIdx] = { ...current, $meta: { ...meta, ...ui } };
        inputs[triggerLoc.inputIdx] = { ...inputs[triggerLoc.inputIdx], triggers: [...triggers] };
        return { app: { ...state.app, inputs } };
      }

      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithMeta, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithMeta = JSON.parse(JSON.stringify(f));
        const index = buildNodeIndex(copy);
        const path = index.pathById[nodeId];
        if (!path) {
          const fallback = findStepById(copy, nodeId);
          if (!fallback.path) return f;
          setStepMeta(copy, fallback.path, ui);
          return copy;
        }
        if (path === "start") {
          const meta = copy.$meta ?? {};
          copy.$meta = { ...meta, ...ui };
        } else {
          setStepMeta(copy, path, ui);
        }
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    }),
  addDisconnected: (flowName, steps) =>
    set((state) => {
      const flows = state.app.flows.map((f) => {
        if (f.name !== flowName) return f;
        ensureFlowMeta(f as FlowWithMeta);
        const meta = f.$meta ?? {};
        const disc = meta.disconnected ?? [];
        return { ...f, $meta: { ...meta, disconnected: [...(meta.disconnected ?? []), { steps }] } } as FlowWithMeta;
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
      target.triggers = [
        ...(target.triggers ?? []),
        { flow: flowName, $meta: { id: nanoid(), x: 40, y: 160 + (target.triggers?.length ?? 0) * 90 } }
      ];
      return { app: { ...state.app, inputs } };
    }),
  addClosureStep: (collection, flowIdx, closureName) =>
    set((state) => {
      const key = collection === "closures" ? "closures" : "flows";
      const list = state.app[key].map((f: any) => JSON.parse(JSON.stringify(f)) as FlowWithMeta);
      const flow = list[flowIdx] ?? list[0];
      if (!flow) return state;
      ensureFlowMeta(flow);
      const disc = flow.$meta?.disconnected ?? [];
      const { x, y } = findOpenSlot(flow);
      const step: StepWithMeta = {
        closure: closureName,
        parameters: {},
        $meta: { id: nanoid(), x, y }
      };
      disc.push({ steps: [step] });
      flow.$meta = { ...(flow.$meta ?? {}), disconnected: disc };
      list[flowIdx] = flow;
      return { app: { ...state.app, [key]: list } as AppState };
  }),
  updateStepParam: (flowName, nodeId, key, value) =>
    set((state) => {
      const where = findFlowOrClosure(state.app, flowName);
      if (!where) return state;
      const list = state.app[where.kind].map((f: FlowWithMeta, i: number) => {
        if (i !== where.idx) return f;
        const copy: FlowWithMeta = JSON.parse(JSON.stringify(f));
        const index = buildNodeIndex(copy);
        const path = index.pathById[nodeId];
        if (!path) return f;
        setStepParam(copy, path, key, value);
        return copy;
      });
      return { app: { ...state.app, [where.kind]: list } as AppState };
    }),
  updateTriggerField: (triggerId, key, value) =>
    set((state) => {
      const inputs = JSON.parse(JSON.stringify(state.app.inputs ?? []));
      const loc = findTriggerById(inputs, triggerId);
      if (!loc) return state;
      const trig = { ...(inputs[loc.inputIdx].triggers?.[loc.triggerIdx] ?? {}) };
      trig[key] = value;
      inputs[loc.inputIdx].triggers[loc.triggerIdx] = trig;
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

const SLOT_X = 240;
const SLOT_Y = 160;
const MIN_COORD = 20;

function findOpenSlot(flow: FlowWithMeta): { x: number; y: number } {
  ensureFlowMeta(flow);
  const occupied = collectPositions(flow);
  const baseX = flow.$meta?.x ?? 1000;
  const baseY = flow.$meta?.y ?? 1000;

  for (let radius = 0; radius < 12; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // perimeter positions first
        const x = Math.max(MIN_COORD, baseX + dx * SLOT_X);
        const y = Math.max(MIN_COORD, baseY + dy * SLOT_Y);
        const collides = occupied.some((p) => Math.abs(p.x - x) < SLOT_X * 0.6 && Math.abs(p.y - y) < SLOT_Y * 0.6);
        if (!collides) return { x, y };
      }
    }
  }

  return { x: baseX + SLOT_X, y: baseY + SLOT_Y };
}

function collectPositions(flow: FlowWithMeta): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  if (flow.$meta?.x != null && flow.$meta?.y != null) positions.push({ x: flow.$meta.x, y: flow.$meta.y });

  const addFromSteps = (steps?: StepWithMeta[]) => {
    (steps ?? []).forEach((s) => {
      ensureStepMeta(s);
      const meta = s.$meta;
      if (meta?.x != null && meta?.y != null) positions.push({ x: meta.x, y: meta.y });
      if (Array.isArray((s as any).cases)) (s as any).cases.forEach((c: any) => addFromSteps(c.steps));
      if (Array.isArray((s as any).otherwise)) addFromSteps((s as any).otherwise as any);
      Object.values(s.parameters ?? {}).forEach((p: any) => {
        if (p?.steps) addFromSteps(p.steps);
        if (p?.$call?.steps) addFromSteps(p.$call.steps);
      });
    });
  };

  addFromSteps(flow.steps);
  (flow.$meta?.disconnected ?? []).forEach((d) => addFromSteps(d.steps));
  return positions;
}

function removeStepById(flow: FlowWithMeta, nodeId: string): boolean {
  let removed = false;

  const removeFromArray = (arr: StepWithMeta[] | undefined): StepWithMeta[] | undefined => {
    if (!Array.isArray(arr)) return arr;
    const next = arr.filter((s) => {
      ensureStepMeta(s);
      return s.$meta?.id !== nodeId;
    });
    if (next.length !== arr.length) removed = true;

    next.forEach((s) => {
      if (Array.isArray((s as any).cases)) (s as any).cases.forEach((c: any) => c.steps = removeFromArray(c.steps) ?? []);
      if (Array.isArray((s as any).otherwise)) (s as any).otherwise = removeFromArray((s as any).otherwise) ?? [];
      Object.entries(s.parameters ?? {}).forEach(([key, val]: [string, any]) => {
        if (val?.steps) val.steps = removeFromArray(val.steps) ?? [];
        if (val?.$call?.steps) val.$call.steps = removeFromArray(val.$call.steps) ?? [];
        if (Array.isArray(val)) {
          val.forEach((item: any) => {
            if (item?.steps) item.steps = removeFromArray(item.steps) ?? [];
            if (item?.$call?.steps) item.$call.steps = removeFromArray(item.$call.steps) ?? [];
          });
        }
      });
    });

    return next;
  };

  flow.steps = removeFromArray(flow.steps) ?? [];

  const disc = (flow.$meta?.disconnected ?? []).map((frag) => ({ ...frag, steps: removeFromArray(frag.steps) ?? [] }))
    .filter((frag) => frag.steps.length > 0);
  if (flow.$meta) flow.$meta.disconnected = disc;

  return removed;
}

function upsertPlugin(list: any[], plugin: any): any[] {
  const key = plugin?.id ?? plugin?.manifestUrl;
  if (!key) return list;
  const idx = list.findIndex((p) => (p?.id ?? p?.manifestUrl) === key);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...plugin };
    return next;
  }
  return [...list, plugin];
}
