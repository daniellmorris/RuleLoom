import { nanoid } from "../utils/id";
import { Node, Edge } from "../types";
import type { FlowWithUi, StepWithUi, UiMeta } from "../state/appStore";
import { useCatalogStore } from "../state/catalogStore";

export interface GraphBuild {
  nodes: Node[];
  edges: Edge[];
  pathById: Record<string, string>;
}

function makeId(path: string, uiId?: string) {
  return path; // path-anchored ids to keep drag/selection consistent even when ui ids reuse
}

export function buildGraph(flow: FlowWithUi, inputs: any[] = []): GraphBuild {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const pathById: Record<string, string> = {};

  const startId = makeId(`start`, flow.$ui?.id);
  pathById[startId] = "start";
  nodes.push({
    id: startId,
    kind: "start",
    label: "START",
    x: flow.$ui?.x ?? 60,
    y: flow.$ui?.y ?? 120,
    connectors: [{ id: "next", label: "next", direction: "next" }]
  });

  const walk = (steps: StepWithUi[], prefix: string, parentId: string | null) => {
    let prevId = parentId;
    steps.forEach((step, idx) => {
      const path = `${prefix}steps[${idx}]`;
      const id = makeId(path, step.$ui?.id);
      pathById[id] = path;
      const node: Node = {
        id,
        kind: "closure",
        label: step.closure ?? step.type ?? `step-${idx + 1}`,
        x: step.$ui?.x ?? 200 + idx * 200,
        y: step.$ui?.y ?? 200,
        connectors: [{ id: "next", label: "next", direction: "next" }],
        data: { closureName: step.closure, params: step.parameters ?? {}, ui: step.$ui }
      };
      nodes.push(node);
      if (prevId) {
        edges.push({ id: nanoid(), from: prevId, to: id, kind: "control", label: "next" });
      }
      prevId = id;

      const paramsMeta = useCatalogStore.getState().closuresMeta[step.closure ?? ""]?.signature?.parameters ?? [];
      const visitParam = (pmeta: any, pval: any, basePath: string, label: string) => {
        if (!pmeta) return;
        if (pmeta.type === "flowSteps" && Array.isArray(pval)) {
          if (pval.length) {
            const targetPath = `${basePath}[0]`;
            const tid = makeId(targetPath, pval[0].$ui?.id);
            pathById[tid] = targetPath;
            edges.push({ id: nanoid(), from: id, to: tid, kind: "control", label });
            walk(pval, `${basePath}.`, null);
          }
          return;
        }
        if (pmeta.type === "array" && Array.isArray(pval) && Array.isArray(pmeta.children)) {
          pval.forEach((item: any, idx: number) => {
            pmeta.children.forEach((child: any) => {
              visitParam(child, item?.[child.name], `${basePath}[${idx}].${child.name}`, `${label}[${idx}].${child.name}`);
            });
          });
        }
      };

      paramsMeta.forEach((pm: any) => {
        const val = (step.parameters ?? {})[pm.name];
        visitParam(pm, val, `${path}.parameters.${pm.name}`, pm.name);
      });

      // $call params: string target or embedded steps
      Object.entries(step.parameters ?? {})
        .filter(([_, v]) => typeof v === "object" && v !== null && "$call" in (v as any))
        .forEach(([pname, v]) => {
          const callVal = (v as any).$call;
          if (typeof callVal === "string") {
            const tid = makeId(callVal);
            edges.push({ id: nanoid(), from: id, to: tid, kind: "control", label: pname });
          } else if (callVal?.steps?.length) {
            const subSteps = callVal.steps as StepWithUi[];
            const targetPath = `${path}.parameters.${pname}.$call.steps[0]`;
            const tid = makeId(targetPath, subSteps[0].$ui?.id);
            pathById[tid] = targetPath;
            edges.push({ id: nanoid(), from: id, to: tid, kind: "control", label: pname });
            walk(subSteps, `${path}.parameters.${pname}.$call.`, null);
          }
        });
      if (step.cases) {
        step.cases.forEach((c: any, ci: number) => {
          const targetId = walk(c.then ?? [], `${path}.cases[${ci}].`, id) || id;
          edges.push({ id: nanoid(), from: id, to: targetId, kind: "branch", label: `case-${ci + 1}` });
        });
        if (step.otherwise) {
          const targetId = walk(step.otherwise, `${path}.otherwise.`, id) || id;
          edges.push({ id: nanoid(), from: id, to: targetId, kind: "control", label: "otherwise" });
        }
      }
    });
    return steps.length ? makeId(`${prefix}steps[${steps.length - 1}]`) : prevId;
  };

  const firstId = walk(flow.steps ?? [], "", startId);
  if (startId && firstId && startId !== firstId && !edges.find((e) => e.from === startId && e.to === firstId)) {
    // already connected via walk
  }

  // inputs/triggers for this flow
  inputs.forEach((inp: any, ii: number) => {
    (inp.triggers ?? []).forEach((tr: any, ti: number) => {
      if (tr.flow !== flow.name) return;
      const path = `inputs[${ii}].triggers[${ti}]`;
      const id = makeId(path);
      pathById[id] = path;
      nodes.push({
        id,
        kind: "input",
        label: inp.type,
        x: tr.$ui?.x ?? 40,
        y: tr.$ui?.y ?? 160 + ti * 80,
        connectors: [{ id: "next", label: "next", direction: "next" }],
        data: { config: inp.config ?? {}, trigger: tr, ui: tr.$ui }
      });
      edges.push({ id: nanoid(), from: id, to: startId, kind: "control", label: "next" });
    });
  });

  // disconnected
  const disc = flow.$ui?.disconnected ?? [];
  disc.forEach((frag, di) => {
    walk(frag.steps ?? [], `$ui.disconnected[${di}].`, null);
  });

  return { nodes, edges, pathById };
}
