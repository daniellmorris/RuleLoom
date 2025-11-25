import yaml from "js-yaml";
import { Edge, Flow, Node } from "../types";
import { autoLayout } from "../state/flowStore";

const isBranch = (node: Node) => node.kind === "branch";

function outgoing(edges: Edge[], from: string) {
  return edges.filter((e) => e.from === from);
}

function firstNext(edges: Edge[], from: string) {
  return outgoing(edges, from).find((e) => e.kind === "control");
}

function nodeStep(node: Node) {
  if (node.kind === "closure") {
    return { closure: node.data?.closureName ?? node.label, parameters: node.data?.params ?? {} };
  }
  return null;
}

function traverse(node: Node, nodes: Node[], edges: Edge[]): any[] {
  // input nodes are entry; skip to next
  if (node.kind === "input") {
    const next = firstNext(edges, node.id);
    return next ? traverse(nodes.find((n) => n.id === next.to)!, nodes, edges) : [];
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
      steps: traverse(nodes.find((n) => n.id === edge.to)!, nodes, edges)
    }));

    const otherwiseEdge = controlNext[0];
    const otherwise = otherwiseEdge ? traverse(nodes.find((n) => n.id === otherwiseEdge.to)!, nodes, edges) : [];

    return [{ cases, otherwise }];
  }

  const step = nodeStep(node);
  const restEdge = firstNext(edges, node.id);
  const rest = restEdge ? traverse(nodes.find((n) => n.id === restEdge.to)!, nodes, edges) : [];
  return step ? [step, ...rest] : rest;
}

export function exportFlowToYaml(flow: Flow): string {
  const entryNode = flow.nodes.find((n) => n.id === flow.entryId) ?? flow.nodes[0];
  const steps = traverse(entryNode, flow.nodes, flow.edges);

  const config = {
    version: 1,
    inputs: [
      {
        type: "http",
        routes: [{ method: "post", path: `/${flow.name ?? "flow"}`, flow: flow.name }]
      }
    ],
    closures: flow.nodes
      .filter((n) => n.kind === "closure")
      .map((n) => ({
        type: "flow",
        name: n.data?.closureName ?? n.label,
        steps: n.data?.params?.steps ?? []
      })),
    flows: [
      {
        name: flow.name,
        steps
      }
    ]
  };

  return yaml.dump(config, { lineWidth: 120 });
}

export function importFlowFromYaml(text: string): Flow {
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

  const build = (steps: any[], parent?: Node) => {
    for (const step of steps) {
      if (step.cases) {
        const branchNode = addNode({ kind: "branch", label: "Branch", connectors: [] });
        const branchConnectors = [{ id: "prev", label: "prev", direction: "prev" }];
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
      } else if (step.closure) {
        const name: string = step.closure;
        const isCall = name.startsWith("$call") || closureNames.has(name);
        const kind = isCall ? "call" : "plugin";
        const node = addNode({
          kind,
          label: isCall ? `$call: ${name}` : name,
          data: isCall
            ? { callTarget: name, params: step.parameters }
            : { pluginId: name, params: step.parameters }
        });
        if (parent) edges.push({ id: `e-${edges.length}`, from: parent.id, to: node.id, kind: "control" });
        parent = node;
      }
      x += 220;
    }
    return parent;
  };

  // entry input node
  const inputNode: Node = {
    id: "input-1",
    kind: "input",
    label: "Flow Input",
    x: 60,
    y: yBase,
    connectors: [
      { id: "next", label: "next", direction: "next" },
      { id: "schema", label: "schema", direction: "dynamic" }
    ],
    data: { schema: parsed?.inputs?.[0]?.schema ?? {} }
  };
  nodes.push(inputNode);

  const last = build(flowSpec?.steps ?? [], inputNode);
  if (!edges.find((e) => e.from === inputNode.id) && last) {
    edges.push({ id: "e-entry", from: inputNode.id, to: last.id, kind: "control" });
  }

  return autoLayout({
    id: "imported-flow",
    name: flowName,
    entryId: inputNode.id,
    nodes,
    edges
  });
}
