import yaml from "js-yaml";
import { Edge, Flow, Node, Connector } from "../types";
import { autoLayout } from "../state/flowStore";
import coreManifest from "../data/coreManifest.json";
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
    return { closure: node.data?.closureName ?? node.label, parameters: params };
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
    // flowSteps parameters (dynamic connectors on closure)
    const flowParams =
      (node.data as any)?.closureParameters ??
      ((closureMetaMap[node.data?.closureName ?? ""]?.signature?.parameters ?? [])
        .filter((p: any) => p.type === "flowSteps")
        .map((p: any) => p.name) as string[]) ??
      [];
    flowParams.forEach((p: string) => {
      const edge = edges.find((e) => e.from === node.id && e.label === p);
      if (edge) {
        const target = nodes.find((n) => n.id === edge.to);
        if (target) {
          (step.parameters as any)[p] = traverse(target, nodes, edges, new Set(visited));
        }
      }
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

  const inputs = (flow as any)._inputs ?? [
    {
      type: "http",
      config: {},
      triggers: [{ type: "httpRoute", method: "post", path: `/${flow.name ?? "flow"}`, flow: flow.name }]
    }
  ];

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
        steps
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

  // inputs are now represented as triggers; we don't draw them as nodes on the canvas.

  const last = build(flowSpec?.steps ?? [], undefined);
  if (last) {
    edges.push({ id: nanoid(), from: startId, to: last.id, kind: "control", label: "next" });
  }

  const flow = autoLayout({
    id: "imported-flow",
    name: flowName,
    entryId: startId,
    nodes,
    edges
  });
  (flow as any)._closures = closuresSpec;
  (flow as any)._inputs = parsed?.inputs;
  return flow;
}
