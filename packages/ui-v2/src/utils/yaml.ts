import yaml from "js-yaml";
import { Edge, Flow, Node, Connector } from "../types";
// Legacy helpers kept for reference; autoLayout is stubbed to a no-op that returns the input graph.
const autoLayout = (flow: any) => flow;
import coreManifestRaw from "rule-loom-core/ruleloom.manifest.yaml?raw";
const coreManifest = (yaml.load(coreManifestRaw as string) as any) ?? {};
import { nanoid } from "../utils/id";

const closureMetaMap: Record<string, any> = Object.fromEntries(
  (coreManifest as any).closures?.map((c: any) => [c.name, c]) ?? []
);
const inputMetaMap: Record<string, any> = Object.fromEntries(
  (coreManifest as any).inputs?.map((i: any) => [i.type, i]) ?? []
);

const isBranch = (node: Node) => node.kind === "branch";

function outgoing(edges: Edge[], from: string) {
  return edges.filter((e) => e.from === from);
}

function firstNext(edges: Edge[], from: string) {
  return outgoing(edges, from).find((e) => e.kind === "control");
}

function nodeStep(node: Node) {
  if (node.kind === "closure") {
    const params = { ...(node.data?.params ?? {}) };
    const step: any = { closure: node.data?.closureName ?? node.label };
    if (Object.keys(params).length) step.parameters = params;
    const meta = (node.data as any)?.ui ?? (node.data as any)?.meta;
    if (meta) step.$meta = meta;
    return step;
  }
  return null;
}

function traverse(node: Node, nodes: Node[], edges: Edge[], visited = new Set<string>()): any[] {
  // input nodes are entry; skip to next
  if (visited.has(node.id)) return [];
  visited.add(node.id);
  if (node.kind === "input") {
    const next = firstNext(edges, node.id);
    return next ? traverse(nodes.find((n) => n.id === next.to)!, nodes, edges, visited) : [];
  }

  if (isBranch(node)) {
    const branchEdges = outgoing(edges, node.id).filter((e) => e.kind === "branch");
    const controlNext = outgoing(edges, node.id).filter((e) => e.kind === "control");
    const rules = node.data?.branchRules ?? [];

    const cases = branchEdges.map((edge) => ({
      when: {
        closure: "core.condition",
        parameters: {
          expr: rules.find((r) => r.label === edge.label)?.condition ?? edge.label ?? "condition"
        }
      },
      steps: traverse(nodes.find((n) => n.id === edge.to)!, nodes, edges, new Set(visited))
    }));

    const otherwiseEdge = controlNext[0];
    const otherwise = otherwiseEdge ? traverse(nodes.find((n) => n.id === otherwiseEdge.to)!, nodes, edges, new Set(visited)) : [];

    return [{ cases, otherwise }];
  }

  const step = nodeStep(node);
  // attach param edges as parameters
  if (step) {
    const paramEdges = edges.filter((e) => e.kind === "param" && e.to === node.id);
    paramEdges.forEach((pe) => {
      const fromNode = nodes.find((n) => n.id === pe.from);
      if (fromNode) {
        const paramName = pe.label ?? "value";
        (step.parameters as any)[paramName] = `\${${fromNode.label}}`;
      }
    });
    // flowSteps parameters (dynamic connectors on closure), including nested array children
    const paramsMeta = closureMetaMap[node.data?.closureName ?? ""]?.signature?.parameters ?? [];
    const visitFlowParams = (pmeta: any, baseLabel: string, baseValSetter: (val: any) => void) => {
      if (pmeta.type === "flowSteps") {
        const edge = edges.find((e) => e.from === node.id && e.label === baseLabel);
        if (edge) {
          const target = nodes.find((n) => n.id === edge.to);
          if (target) {
            baseValSetter(traverse(target, nodes, edges, new Set(visited)));
          }
        }
        return;
      }
      if (pmeta.type === "array" && Array.isArray(pmeta.children)) {
        const items: any[] = [];
        pmeta.children.forEach((child: any) => {
          const matching = edges.filter((e) => e.from === node.id && (e.label ?? "").startsWith(`${baseLabel}[`));
          matching.forEach((edge) => {
            const label = edge.label ?? "";
            const m = label.match(/^.+\[(\d+)\]\.(.+)$/);
            const idx = m ? Number(m[1]) : 0;
            const childName = m ? m[2] : child.name;
            if (childName !== child.name) return;
            const target = nodes.find((n) => n.id === edge.to);
            if (!target) return;
            items[idx] = items[idx] ?? {};
            items[idx][child.name] = child.type === "flowSteps"
              ? traverse(target, nodes, edges, new Set(visited))
              : items[idx][child.name];
          });
        });
        if (items.length) baseValSetter(items);
      }
    };

    paramsMeta.forEach((p: any) => {
      visitFlowParams(p, p.name, (val) => {
        (step.parameters = step.parameters ?? {});
        (step.parameters as any)[p.name] = val;
      });
    });
    if (Object.keys(step.parameters ?? {}).length === 0) {
      delete (step as any).parameters;
    }
  }
  const restEdge = firstNext(edges, node.id);
  const rest = restEdge ? traverse(nodes.find((n) => n.id === restEdge.to)!, nodes, edges, visited) : [];
  return step ? [step, ...rest] : rest;
}

export function validateFlow(flow: Flow): string[] {
  const errors: string[] = [];
  flow.nodes.forEach((n) => {
    const inbound = flow.edges.filter((e) => (e.kind === "control" || e.kind === "branch" || e.kind === "param") && e.to === n.id);
    const outbound = flow.edges.filter((e) => (e.kind === "control" || e.kind === "branch") && e.from === n.id);
    // required params check
    if (n.kind === "closure" && n.data?.parametersMeta) {
      n.data.parametersMeta.forEach((p: any) => {
        if (!p.required) return;
        if (p.type === "flowSteps") {
          const hasFlow = flow.edges.some((e) => e.from === n.id && e.label === p.name);
          if (!hasFlow) errors.push(`Node ${n.label}: missing flowSteps for ${p.name}`);
          return;
        }
        const hasEdge = flow.edges.some((e) => e.kind === "param" && e.to === n.id && e.label === p.name);
        const hasValue = n.data?.params && Object.prototype.hasOwnProperty.call(n.data.params, p.name);
        if (!hasEdge && !hasValue) {
          errors.push(`Node ${n.label}: missing required parameter ${p.name}`);
        }
      });
    }
    if (n.kind === "input") {
      if (!outbound.length) errors.push(`Input ${n.label} has no outgoing connection.`);
    } else {
      if (!inbound.length) errors.push(`Node ${n.label} has no incoming connection.`);
    }
  });
  return errors;
}

export function exportFlowToYaml(flow: Flow): string {
  const entryNode = flow.nodes.find((n) => n.id === flow.entryId) ?? flow.nodes[0];
  const steps = traverse(entryNode, flow.nodes, flow.edges);
  // attach $meta positions from node coordinates where missing
  const attachMeta = (stepsArr: any[], parentNode?: Node) => {
    stepsArr?.forEach((s, idx) => {
      const node = flow.nodes.find((n) => (n.data as any)?.closureName === s.closure) ?? flow.nodes[idx];
      if (node) {
        s.$meta = s.$meta ?? { x: node.x, y: node.y, w: 180, h: 80 };
      }
      if (s.cases) {
        s.cases.forEach((c: any) => attachMeta(c.steps, node));
      }
      if (s.otherwise) attachMeta(s.otherwise, node);
      Object.entries(s.parameters ?? {}).forEach(([key, val]) => {
        if (Array.isArray(val)) attachMeta(val as any[], node);
      });
    });
  };
  attachMeta(steps);

  const inputNodes = flow.nodes.filter((n) => n.kind === "input");
  const grouped: Record<string, { config: any; triggers: any[] }> = {};
  inputNodes.forEach((n) => {
    const type = n.label;
    const config = (n.data as any)?.config ?? {};
    const trigger = { ...(n.data as any)?.trigger, flow: flow.name };
    if (!grouped[type]) grouped[type] = { config, triggers: [] };
    grouped[type].triggers.push(trigger);
    // prefer first seen config
    if (Object.keys(grouped[type].config).length === 0) grouped[type].config = config;
  });
  const inputs = Object.entries(grouped).map(([type, obj]) => ({
    type,
    config: obj.config,
    triggers: obj.triggers
  }));

  const closuresFromMeta = (flow as any)._closures;
  let closures;
  if (closuresFromMeta) {
    closures = closuresFromMeta;
  } else {
    const manifestClosureNames = new Set((coreManifest as any).closures?.map((c: any) => c.name));
    const uniq = new Map<string, any>();
    flow.nodes
      .filter((n) => n.kind === "closure")
      .forEach((n) => {
        const name = n.data?.closureName ?? n.label;
        if (manifestClosureNames.has(name)) return;
        if (!uniq.has(name))
          uniq.set(name, {
            type: "flow",
            name,
            steps: n.data?.params?.steps ?? []
          });
      });
    closures = Array.from(uniq.values());
  }

  const config = {
    version: 1,
    inputs,
    closures,
    flows: [
      {
        name: flow.name,
        steps,
        ...(flow as any)._uiDisconnected ? { $meta: { disconnected: (flow as any)._uiDisconnected } } : {}
      }
    ]
  };

  return yaml.dump(config, { lineWidth: 120 });
}

export function importFlowFromYaml(text: string, pkgInputs?: any[], asClosure = false): Flow {
  const parsed = yaml.load(text) as any;
  const flowSpec = parsed?.flows?.[0];
  const flowName = flowSpec?.name ?? "Imported Flow";
  const closuresSpec: any[] = Array.isArray(parsed?.closures) ? parsed.closures : [];
  const closureNames = new Set<string>(closuresSpec.map((c: any) => c.name).filter(Boolean));

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let x = 140;
  const yBase = 160;

  const addNode = (partial: Partial<Node> & { kind: Node["kind"]; label: string }) => {
    const id = `${partial.kind}-${nodes.length + 1}`;
    const meta = partial.kind === "closure" ? closureMetaMap[partial.label] : partial.kind === "input" ? inputMetaMap[partial.label] : undefined;
    const parametersMeta = meta?.signature?.parameters;
    const closureParameters =
      parametersMeta?.filter((p: any) => p.type === "flowSteps").map((p: any) => p.name) ??
      (partial.kind === "closure" ? (partial as any).closureParameters : undefined);
    const node: Node = {
      id,
      x,
      y: yBase + nodes.length * 40,
      connectors: [
        { id: "prev", label: "prev", direction: "prev" },
        { id: "next", label: "next", direction: "next" }
      ],
      ...partial
    };
    if (parametersMeta) {
      node.data = { ...node.data, parametersMeta, closureParameters };
    }
    if (partial.kind === "input" && meta?.schema) {
      node.data = { ...node.data, schema: meta.schema };
    }
    nodes.push(node);
    return node;
  };

  // materialize closure definitions as standalone nodes
  closuresSpec.forEach((c, idx) => {
    addNode({
      kind: "closure",
      label: c.name ?? `closure-${idx + 1}`,
      x: 800,
      y: yBase + idx * 120,
      connectors: [
        { id: "prev", label: "prev", direction: "prev" },
        { id: "next", label: "next", direction: "next" },
        { id: "closureParam", label: "closureParameter", direction: "dynamic" }
      ],
      data: { closureName: c.name, params: { steps: c.steps ?? [] } }
    });
  });

  const build = (steps: any[], parent?: Node): Node | undefined => {
    let firstCreated: Node | undefined;
    for (const step of steps) {
    const ui = step?.$meta ?? {};
      if (step.cases) {
        const branchNode = addNode({ kind: "branch", label: "Branch", connectors: [] });
        const branchConnectors: Connector[] = [{ id: "prev", label: "prev", direction: "prev" }];
        const branchRules = (step.cases as any[]).map((c, i) => ({
          label: c.when?.parameters?.expr ?? c.when?.closure ?? `case-${i + 1}`,
          condition: c.when?.parameters?.expr ?? ""
        }));
        branchRules.forEach((r) => branchConnectors.push({ id: r.label, label: r.label, direction: "dynamic" }));
        branchConnectors.push({ id: "default", label: "default", direction: "next" });
        branchNode.connectors = branchConnectors;
        branchNode.data = { ...(branchNode.data ?? {}), branchRules };
        if (parent) edges.push({ id: `e-${edges.length}`, from: parent.id, to: branchNode.id, kind: "control" });
        // handle cases
        step.cases.forEach((c: any) => {
          const targetNode = build(c.steps, branchNode);
          if (targetNode)
            edges.push({
              id: `e-${edges.length}`,
              from: branchNode.id,
              to: targetNode.id,
              kind: "branch",
              label: c.when?.parameters?.expr ?? c.when?.closure ?? "case"
            });
        });
        if (step.otherwise && step.otherwise.length) {
          const otherStart = build(step.otherwise, branchNode);
          if (otherStart)
            edges.push({ id: `e-${edges.length}`, from: branchNode.id, to: otherStart.id, kind: "control", label: "default" });
          parent = otherStart ?? branchNode;
        } else {
          parent = branchNode;
        }
        if (!firstCreated) firstCreated = branchNode;
      } else if (step.closure) {
        const name: string = step.closure;
        const isCall = name.startsWith("$call");
        const kind = "closure";
        const node = addNode({
          kind,
          label: isCall ? name.replace(/^\$call[:\s]*/, "") : name,
          data: isCall
            ? { callTarget: name.replace(/^\$call[:\s]*/, ""), params: step.parameters }
            : { closureName: name, params: step.parameters }
        });
        if (ui.x !== undefined) node.x = ui.x;
        if (ui.y !== undefined) node.y = ui.y;
        if (parent) edges.push({ id: `e-${edges.length}`, from: parent.id, to: node.id, kind: "control" });
        // handle flowSteps inside parameters
        Object.entries(step.parameters ?? {}).forEach(([param, val]) => {
          if (Array.isArray(val)) {
            const subStart = build(val, node);
            if (subStart) edges.push({ id: `e-${edges.length}`, from: node.id, to: subStart.id, kind: "control", label: param });
          }
        });
        parent = node;
        if (!firstCreated) firstCreated = node;
      }
      x += 220;
    }
    return firstCreated;
  };

  // create start node
  const startId = `start-${nanoid()}`;
  nodes.push({
    id: startId,
    kind: "start",
    label: "START",
    x: 60,
    y: yBase,
    connectors: [{ id: "next", label: "next", direction: "next" }]
  });

  // create input trigger nodes
  const inputsArr = pkgInputs ?? parsed?.inputs ?? [];
  inputsArr.forEach((inp: any, idx: number) => {
    const trigList = inp.triggers ?? [];
    trigList.forEach((tr: any, tIdx: number) => {
      const meta = inputMetaMap[inp.type ?? ""];
    const ui = tr?.$meta ?? {};
      nodes.push({
        id: `input-${idx + 1}-${tIdx + 1}`,
        kind: "input",
        label: inp.type ?? `input-${idx + 1}`,
        x: ui.x ?? 40,
        y: ui.y ?? yBase + (idx * 140) + tIdx * 80,
        connectors: [{ id: "next", label: "next", direction: "next" }],
        data: {
          ...(inp.config ? { config: inp.config } : {}),
          trigger: tr,
          configParameters: meta?.configParameters ?? [],
          triggerParameters: meta?.triggerParameters ?? []
        }
      });
      edges.push({ id: nanoid(), from: `input-${idx + 1}-${tIdx + 1}`, to: startId, kind: "control", label: "next" });
    });
  });

  const last = build(flowSpec?.steps ?? [], undefined);
  if (last) {
    edges.push({ id: nanoid(), from: startId, to: last.id, kind: "control", label: "next" });
  }

  // disconnected UI steps: render as loose subgraphs
  const disconnected = parsed?.flows?.[0]?.$meta?.disconnected ?? [];
  disconnected.forEach((disc: any, di: number) => {
    const sub = build(disc.steps ?? [], undefined);
    if (sub) {
      // ensure position honored if provided
      // no edges connect to start; keep isolated
    }
  });

  const flow = autoLayout({
    id: "imported-flow",
    name: flowName,
    entryId: startId,
    nodes,
    edges
  });
  (flow as any)._closures = closuresSpec;
  (flow as any)._inputs = parsed?.inputs;
  (flow as any)._uiDisconnected = disconnected;
  return flow;
}
