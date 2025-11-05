import { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, MarkerType, MiniMap, Node, Position } from 'reactflow';

type FlowConditionClause = {
  closure: string;
  parameters?: Record<string, unknown>;
  negate?: boolean;
};

type FlowCondition = FlowConditionClause | FlowConditionClause[];

interface FlowInvokeStep {
  type: 'invoke';
  closure: string;
  parameters?: Record<string, unknown>;
  assign?: string;
  mergeResult?: boolean;
  when?: FlowCondition;
}

interface FlowBranchCase {
  when: FlowCondition;
  steps: FlowStep[];
}

interface FlowBranchStep {
  type: 'branch';
  cases: FlowBranchCase[];
  otherwise?: FlowStep[];
}

type FlowStep = FlowInvokeStep | FlowBranchStep;

interface FlowDefinition {
  name: string;
  description?: string;
  steps: FlowStep[];
}

interface ClosureDefinition {
  type: string;
  name?: string;
  description?: string;
  template?: string;
  module?: string;
  preset?: string;
}

interface RunnerVisualizerProps {
  data: {
    id: string;
    routes: Array<{ method: string; path: string; flow: string }>;
    scheduler: {
      jobs: Array<{ name: string; flow?: string; interval?: string | number; cron?: string; timeout?: string | number | boolean; enabled?: boolean }>;
      states: Array<{ name: string; runs: number; lastRun?: string }>;
    };
    flows: FlowDefinition[];
    closures: ClosureDefinition[];
  };
}

const X_UNIT = 220;
const Y_UNIT = 140;
const FLOW_GAP = 140;
const INPUT_SPREAD = 120;
const RUNNER_Y = 0;
const INPUT_Y = RUNNER_Y + Y_UNIT;
const FLOW_Y = INPUT_Y + Y_UNIT;

function formatConditionClause(condition: FlowConditionClause): string {
  const prefix = condition.negate ? 'NOT ' : '';
  const parameters = condition.parameters ? Object.keys(condition.parameters) : [];
  const suffix = parameters.length ? ` (${parameters.join(', ')})` : '';
  return `${prefix}${condition.closure}${suffix}`;
}

function formatCondition(condition: FlowCondition): string {
  if (Array.isArray(condition)) {
    return condition.map(formatConditionClause).join(' AND ');
  }
  return formatConditionClause(condition);
}

function formatInvoke(step: FlowInvokeStep): string {
  const lines = [`invoke ${step.closure}`];
  if (step.assign) lines.push(`→ ${step.assign}`);
  if (step.when) lines.push(`when ${formatCondition(step.when)}`);
  return lines.join('\n');
}

function formatBranchSummary(step: FlowBranchStep): string {
  const caseCount = step.cases.length + (step.otherwise ? 1 : 0);
  return `branch (${caseCount} option${caseCount === 1 ? '' : 's'})`;
}

function formatCaseLabel(condition: FlowCondition, index: number): string {
  return `case ${index + 1}\n${formatCondition(condition)}`;
}

function formatSchedule(job: RunnerVisualizerProps['data']['scheduler']['jobs'][number]): string {
  if (job.cron) return `cron ${job.cron}`;
  if (job.interval) return `every ${job.interval}`;
  if (job.timeout) return `timeout ${job.timeout}`;
  return 'manual';
}

function measureSequence(steps: FlowStep[] | undefined): number {
  if (!steps || steps.length === 0) return 1;
  let width = 1;
  for (const step of steps) {
    const stepWidth = measureStep(step);
    width = Math.max(width, stepWidth);
  }
  return width;
}

function measureStep(step: FlowStep): number {
  if (step.type === 'branch') {
    const childWidths = step.cases.map((caseStep) => measureSequence(caseStep.steps));
    if (step.otherwise) childWidths.push(measureSequence(step.otherwise));
    if (childWidths.length === 0) {
      return 1;
    }
    const combined = childWidths.reduce((sum, value) => sum + value, 0);
    const maxChild = childWidths.reduce((max, value) => Math.max(max, value), 1);
    return Math.max(1, combined, maxChild);
  }
  return 1;
}

function collectClosuresFromSteps(steps: FlowStep[] | undefined, accumulator: Set<string>) {
  if (!steps) return;
  for (const step of steps) {
    if (step.type === 'branch') {
      step.cases.forEach((caseStep) => collectClosuresFromSteps(caseStep.steps, accumulator));
      if (step.otherwise) collectClosuresFromSteps(step.otherwise, accumulator);
    } else {
      if (step.closure) {
        accumulator.add(step.closure);
      }
    }
  }
}

function formatClosureLabel(closure: ClosureDefinition): string {
  const lines: string[] = [];
  if (closure.name) {
    lines.push(`Closure ${closure.name}`);
  } else {
    lines.push(`Closure (${closure.type})`);
  }
  lines.push(`type: ${closure.type}`);
  if (closure.template) lines.push(`template: ${closure.template}`);
  if (closure.module) lines.push(`module: ${closure.module}`);
  if (closure.preset) lines.push(`preset: ${closure.preset}`);
  if (closure.description) lines.push(closure.description);
  return lines.join('\n');
}

export default function RunnerVisualizer({ data }: RunnerVisualizerProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let nodeCounter = 0;
    let edgeCounter = 0;

    const createNode = (
      label: string,
      position: { x: number; y: number },
      options?: Partial<Node> & { handles?: { source?: Position; target?: Position } },
    ) => {
      const id = options?.id ?? `node-${nodeCounter++}`;
      const { data: customData, draggable, sourcePosition, targetPosition, handles, ...rest } = options ?? {};
      nodes.push({
        id,
        position,
        data: customData ?? { label },
        draggable: draggable ?? false,
        sourcePosition: handles?.source ?? sourcePosition ?? Position.Bottom,
        targetPosition: handles?.target ?? targetPosition ?? Position.Top,
        ...rest,
      });
      return id;
    };

    const createEdge = (source: string, target: string, options?: Partial<Edge>) => {
      const id = options?.id ?? `edge-${edgeCounter++}`;
      edges.push({
        id,
        source,
        target,
        type: 'smoothstep',
        animated: options?.animated ?? true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        ...options,
      });
    };

    const flowWidths = data.flows.map((flow) => Math.max(1, measureSequence(flow.steps)));
    let currentX = 0;
    const flowCenters = new Map<string, number>();
    const flowNodeIds = new Map<string, string>();
    const flowClosureUsage = new Map<string, Set<string>>();

    data.flows.forEach((flow, index) => {
      const widthPx = flowWidths[index] * X_UNIT;
      const center = currentX + widthPx / 2;
      flowCenters.set(flow.name, center);
      currentX += widthPx + FLOW_GAP;
    });

    const totalWidth = currentX > 0 ? currentX - FLOW_GAP : X_UNIT;
    const centerShift = totalWidth / 2;

    const runnerId = createNode(`Runner ${data.id}`, { x: 0, y: RUNNER_Y }, {
      type: 'input',
      sourcePosition: Position.Bottom,
      targetPosition: undefined,
    });

    const routesByFlow = new Map<string, typeof data.routes>();
    data.routes.forEach((route) => {
      const collection = routesByFlow.get(route.flow);
      if (collection) {
        collection.push(route);
      } else {
        routesByFlow.set(route.flow, [route]);
      }
    });

    const jobsByFlow = new Map<string, typeof data.scheduler.jobs>();
    data.scheduler.jobs.forEach((job) => {
      if (!job.flow) return;
      const collection = jobsByFlow.get(job.flow);
      if (collection) {
        collection.push(job);
      } else {
        jobsByFlow.set(job.flow, [job]);
      }
    });

    const flowStepStartY = FLOW_Y + Y_UNIT;
    let maxFlowDepth = flowStepStartY;

    const layoutSequence = (
      steps: FlowStep[] | undefined,
      centerX: number,
      startY: number,
      entryIds: string[],
    ): { exits: string[]; nextY: number; width: number } => {
      if (!steps || steps.length === 0) {
        return { exits: entryIds, nextY: startY, width: 1 };
      }

      let currentEntries = entryIds;
      let currentY = startY;
      let maxWidth = 1;

      steps.forEach((step, index) => {
        if (step.type === 'branch') {
          const branchId = createNode(formatBranchSummary(step), { x: centerX, y: currentY }, {
            style: { padding: 12, borderRadius: 12, background: 'var(--mantine-color-dark-5)' },
          });
          currentEntries.forEach((source) => createEdge(source, branchId));

          const childDescriptors: Array<{ label: string; steps: FlowStep[]; width: number }> = [];
          step.cases.forEach((caseStep, caseIndex) => {
            childDescriptors.push({
              label: formatCaseLabel(caseStep.when, caseIndex),
              steps: caseStep.steps ?? [],
              width: Math.max(1, measureSequence(caseStep.steps)),
            });
          });
          if (step.otherwise) {
            childDescriptors.push({
              label: 'otherwise',
              steps: step.otherwise,
              width: Math.max(1, measureSequence(step.otherwise)),
            });
          }

          if (childDescriptors.length === 0) {
            currentEntries = [branchId];
            currentY += Y_UNIT;
            return;
          }

          const totalChildWidthUnits = childDescriptors.reduce((sum, child) => sum + child.width, 0);
          maxWidth = Math.max(maxWidth, totalChildWidthUnits);

          let offsetUnits = -(totalChildWidthUnits - 1) / 2;
          const childExits: string[] = [];
          let deepestY = currentY + Y_UNIT;

          childDescriptors.forEach((child) => {
            const childCenter = centerX + (offsetUnits + (child.width - 1) / 2) * X_UNIT;
            const caseNodeId = createNode(child.label, { x: childCenter, y: currentY + Y_UNIT }, {
              style: { padding: 10, borderRadius: 12, background: 'var(--mantine-color-dark-6)' },
            });
            createEdge(branchId, caseNodeId);

            const result = layoutSequence(child.steps, childCenter, currentY + 2 * Y_UNIT, [caseNodeId]);
            childExits.push(...result.exits);
            deepestY = Math.max(deepestY, result.nextY);
            maxWidth = Math.max(maxWidth, result.width);

            offsetUnits += child.width;
          });

          currentEntries = childExits.length ? childExits : [branchId];
          currentY = Math.max(deepestY, currentY + 2 * Y_UNIT);
        } else {
          const invokeId = createNode(formatInvoke(step), { x: centerX, y: currentY }, {
            style: { padding: 12, borderRadius: 12, background: 'var(--mantine-color-dark-6)' },
          });
          currentEntries.forEach((source) => createEdge(source, invokeId));
          currentEntries = [invokeId];
          currentY += Y_UNIT;
        }
      });

      return { exits: currentEntries, nextY: currentY, width: maxWidth };
    };

    data.flows.forEach((flow, index) => {
      const centerX = (flowCenters.get(flow.name) ?? index * (X_UNIT + FLOW_GAP)) - centerShift;
      const closuresUsed = new Set<string>();
      collectClosuresFromSteps(flow.steps, closuresUsed);
      flowClosureUsage.set(flow.name, closuresUsed);
      const flowNodeId = createNode(
        flow.description ? `Flow ${flow.name}\n${flow.description}` : `Flow ${flow.name}`,
        { x: centerX, y: FLOW_Y },
        { style: { padding: 14, borderRadius: 12, background: 'var(--mantine-color-dark-4)' }, handles: { target: Position.Top, source: Position.Bottom } },
      );
      flowNodeIds.set(flow.name, flowNodeId);

      const routes = routesByFlow.get(flow.name) ?? [];
      const jobs = jobsByFlow.get(flow.name) ?? [];
      const totalInputs = routes.length + jobs.length;
      let inputIndex = 0;

      const attachInput = (label: string, x: number, style?: Node['style']) => {
        const inputId = createNode(label, { x, y: INPUT_Y }, {
          style: style ?? { padding: 10, borderRadius: 12, background: 'var(--mantine-color-dark-6)' },
          handles: { source: Position.Bottom, target: Position.Top },
        });
        createEdge(runnerId, inputId, { animated: true });
        createEdge(inputId, flowNodeId, { animated: true });
      };

      if (totalInputs > 0) {
        const startOffset = -(totalInputs - 1) / 2;
        routes.forEach((route) => {
          const offsetIndex = startOffset + inputIndex;
          const inputX = centerX + offsetIndex * INPUT_SPREAD;
          attachInput(`Route ${route.method.toUpperCase()} ${route.path}`, inputX);
          inputIndex += 1;
        });

        jobs.forEach((job) => {
          const offsetIndex = startOffset + inputIndex;
          const inputX = centerX + offsetIndex * INPUT_SPREAD;
          const jobLabel = [`Job ${job.name}`, formatSchedule(job)].join('\n');
          const style = {
            padding: 10,
            borderRadius: 12,
            background: job.enabled === false ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-dark-6)',
            border: job.enabled === false ? '1px dashed var(--mantine-color-red-7)' : undefined,
          };
          attachInput(jobLabel, inputX, style);
          inputIndex += 1;
        });
      } else {
        const directId = createNode('Direct', { x: centerX, y: INPUT_Y }, {
          style: { padding: 10, borderRadius: 12, background: 'var(--mantine-color-dark-7)', border: '1px dashed var(--mantine-color-dark-3)' },
          handles: { source: Position.Bottom, target: Position.Top },
        });
        createEdge(runnerId, directId, { animated: true, style: { strokeDasharray: '6 3' } });
        createEdge(directId, flowNodeId, { animated: true, style: { strokeDasharray: '6 3' } });
      }

      const result = layoutSequence(flow.steps, centerX, flowStepStartY, [flowNodeId]);
      maxFlowDepth = Math.max(maxFlowDepth, result.nextY);
    });

    const closureY = maxFlowDepth + Y_UNIT;
    const closureFlowCenters = new Map<string, number[]>();
    flowClosureUsage.forEach((closures, flowName) => {
      const center = flowCenters.get(flowName);
      if (center === undefined) return;
      closures.forEach((closureName) => {
        const list = closureFlowCenters.get(closureName);
        if (list) list.push(center);
        else closureFlowCenters.set(closureName, [center]);
      });
    });

    const closureNodeIds = new Map<string, string>();
    const seenEdges = new Set<string>();

    data.closures.forEach((closure, index) => {
      const key = closure.name ?? `__unnamed_${closure.type}_${index}`;
      const centers = closure.name ? closureFlowCenters.get(closure.name) : undefined;
      const fallbackCenter = totalWidth * ((index + 1) / (data.closures.length + 1));
      const centerValue = centers && centers.length
        ? centers.reduce((sum, value) => sum + value, 0) / centers.length
        : fallbackCenter;
      const closureX = centerValue - centerShift;
      const closureNodeId = createNode(formatClosureLabel(closure), { x: closureX, y: closureY }, {
        style: { padding: 12, borderRadius: 12, background: 'var(--mantine-color-dark-4)' },
        handles: { target: Position.Top },
      });
      closureNodeIds.set(key, closureNodeId);
    });

    flowClosureUsage.forEach((closures, flowName) => {
      const flowNodeId = flowNodeIds.get(flowName);
      if (!flowNodeId) return;
      closures.forEach((closureName) => {
        const closureNodeId = closureNodeIds.get(closureName);
        if (!closureNodeId) return;
        const edgeKey = `${flowNodeId}->${closureNodeId}`;
        if (seenEdges.has(edgeKey)) return;
        seenEdges.add(edgeKey);
        createEdge(flowNodeId, closureNodeId, { animated: false, style: { strokeDasharray: '6 3' } });
      });
    });

    return { nodes, edges };
  }, [data]);

  return (
    <div style={{ height: 520 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={16} color="#444" />
      </ReactFlow>
    </div>
  );
}
