import { nanoid } from "../utils/id";
import { Node, Edge } from "../types";
import type { FlowWithMeta } from "../state/appStore";
import { buildNodeIndex } from "../state/appStore";
import { walkFlow } from "../state/walk";

export interface GraphBuild {
  nodes: Node[];
  edges: Edge[];
  pathById: Record<string, string>;
}

export function buildGraph(flow: FlowWithMeta, inputs: any[] = []): GraphBuild {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const index = buildNodeIndex(flow);
  const pathById: Record<string, string> = { ...index.pathById };
  const walk = walkFlow(flow);

  const flowMeta = flow.$meta ?? {};
  const startId = index.idByPath["start"] ?? flowMeta.id ?? "start";
  nodes.push({
    id: startId,
    kind: "start",
    label: "START",
    x: flowMeta.x ?? 60,
    y: flowMeta.y ?? 120,
    connectors: [{ id: "next", label: "next", direction: "next" }]
  });

  const nodesMeta = walk.steps;
  nodesMeta.forEach(({ step, path }) => {
    const id = index.idByPath[path] ?? path;
    pathById[id] = path;
    nodes.push({
      id,
      kind: "closure",
      label: step.closure ?? step.type ?? path,
      x: (step as any).$meta?.x ?? 200,
      y: (step as any).$meta?.y ?? 200,
      connectors: [{ id: "next", label: "next", direction: "next" }],
      data: { closureName: step.closure, params: step.parameters ?? {}, ui: (step as any).$meta }
    });
  });

  // edges for $call string targets (embedded steps handled via walkFlow arrays)
  nodesMeta.forEach(({ step, path }) => {
    Object.entries(step.parameters ?? {})
      .filter(([_, v]) => typeof v === "object" && v !== null && "$call" in (v as any) && typeof (v as any).$call === "string")
      .forEach(([pname, v]) => {
        const targetPath = (v as any).$call as string;
        const fromId = index.idByPath[path];
        const toId = index.idByPath[targetPath];
        if (fromId && toId) {
          edges.push({ id: nanoid(), from: fromId, to: toId, kind: "control", label: pname });
        }
      });
  });

  // edges: intra-array sequencing + parent->first child for parameter flowSteps
  walk.arrays.forEach((arrMeta) => {
    const ids = arrMeta.stepPaths.map((p) => index.idByPath[p] ?? p);
    for (let i = 1; i < ids.length; i++) {
      edges.push({ id: nanoid(), from: ids[i - 1], to: ids[i], kind: "control", label: "next" });
    }
    if (arrMeta.parentStepPath && ids[0]) {
      const parentId = index.idByPath[arrMeta.parentStepPath];
      if (parentId) {
        edges.push({ id: nanoid(), from: parentId, to: ids[0], kind: "control", label: arrMeta.parentEdgeLabel ?? "next" });
      }
    } else if (!arrMeta.parentStepPath && arrMeta.pathPrefix === "" && ids[0]) {
      edges.push({ id: nanoid(), from: startId, to: ids[0], kind: "control", label: "next" });
    }
  });

  // inputs/triggers for this flow
  inputs.forEach((inp: any, ii: number) => {
    (inp.triggers ?? []).forEach((tr: any, ti: number) => {
      if (tr.flow !== flow.name) return;
      const path = `inputs[${ii}].triggers[${ti}]`;
      const trigMeta = tr.$meta ?? {};
      const id = trigMeta.id ?? path;
      pathById[id] = path;
      nodes.push({
        id,
        kind: "input",
        label: inp.type,
        x: trigMeta.x ?? 40,
        y: trigMeta.y ?? 160 + ti * 80,
        connectors: [{ id: "next", label: "next", direction: "next" }],
        data: { config: inp.config ?? {}, trigger: tr, ui: trigMeta }
      });
      edges.push({ id: nanoid(), from: id, to: startId, kind: "control", label: "next" });
    });
  });

  // disconnected
  const disc = flowMeta.disconnected ?? [];
  disc.forEach((frag, di) => {
    // already handled via walkFlow arrays
    return frag;
  });

  return { nodes, edges, pathById };
}
