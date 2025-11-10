import { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, MarkerType, MiniMap, Node, Position } from 'reactflow';
import type {
  FlowCondition,
  FlowConditionClause,
  FlowDefinition,
  FlowStep,
  FlowBranchStep,
  FlowInvokeStep,
  ClosureDefinition,
} from '../types/flow';

export interface RunnerVisualizerProps {
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
  showClosures?: boolean;
  showRunnerContext?: boolean;
}

const X_UNIT = 220;
const Y_UNIT = 140;
const FLOW_GAP = 140;
const INPUT_SPREAD = 120;
const RUNNER_Y = 0;
const INPUT_Y = RUNNER_Y + Y_UNIT;
const FLOW_Y = INPUT_Y + Y_UNIT;

type FunctionalParamDescriptor = {
  key: string;
  steps: FlowStep[];
  width: number;
};

function isFlowStep(value: unknown): value is FlowStep {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.type === 'branch') {
    return Array.isArray(candidate.cases);
  }
  return typeof candidate.closure === 'string';
}

function isFlowStepArray(value: unknown): value is FlowStep[] {
  return Array.isArray(value) && value.every((item) => isFlowStep(item));
}

function extractFunctionalParams(step: FlowStep): FunctionalParamDescriptor[] {
  if ((step as FlowBranchStep).type === 'branch') return [];
  const invokeStep = step as FlowInvokeStep;
  if (!invokeStep.parameters) return [];
  const descriptors: FunctionalParamDescriptor[] = [];

  const visitValue = (value: unknown, parts: string[]) => {
    if (!value) return;
    if (isFlowStepArray(value)) {
      const label = formatLabel(parts);
      descriptors.push({ key: label, steps: value, width: Math.max(1, measureSequence(value)) });
      return;
    }
    if (isFlowStep(value)) {
      const label = formatLabel(parts);
      const single = [value];
      descriptors.push({ key: label, steps: single, width: Math.max(1, measureSequence(single)) });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') {
          visitValue(item, [...parts, `[${index}]`]);
        }
      });
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
        visitValue(childValue, [...parts, childKey]);
      });
    }
  };

  Object.entries(invokeStep.parameters).forEach(([key, paramValue]) => {
    visitValue(paramValue, [key]);
  });

  return descriptors;
}

function formatLabel(parts: string[]): string {
  const normalized = parts.filter((part) => part && part.length > 0);
  if (normalized.length === 0) return 'steps';
  const deduped = normalized.filter((part, index) => index === 0 || part !== normalized[index - 1]);
  return deduped.join(' › ');
}

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
  const paramSummary = summarizeParameters(step.parameters);
  if (paramSummary) lines.push(paramSummary);
  if (step.when) lines.push(`when ${formatCondition(step.when)}`);
  return lines.join('\n');
}

function summarizeParameters(parameters?: Record<string, unknown>): string | null {
  if (!parameters) return null;
  const entries: string[] = [];
  for (const [key, value] of Object.entries(parameters)) {
    const isObjectLike = typeof value === 'object' && value !== null;
    if (isFlowStep(value) || isFlowStepArray(value) || Array.isArray(value) || isObjectLike) continue;
    entries.push(`${key}: ${formatPrimitive(value)}`);
    if (entries.length === 4) break;
  }
  if (!entries.length) return null;
  return entries.join('\n');
}

function formatPrimitive(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 32 ? `${value.slice(0, 29)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
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
  const functionalParams = extractFunctionalParams(step);
  if (functionalParams.length === 0) return 1;
  const functionalWidth = functionalParams.reduce((sum, descriptor) => sum + descriptor.width, 0);
  return Math.max(1, 1 + functionalWidth);
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
      extractFunctionalParams(step).forEach((descriptor) => collectClosuresFromSteps(descriptor.steps, accumulator));
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

export default function RunnerVisualizer({ data, showClosures = true, showRunnerContext = true }: RunnerVisualizerProps) {
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

    const runnerId = showRunnerContext
      ? createNode(`Runner ${data.id}`, { x: 0, y: RUNNER_Y }, {
        type: 'input',
        sourcePosition: Position.Bottom,
        targetPosition: undefined,
        style: {
          padding: 16,
          borderRadius: 18,
          background: 'var(--mantine-color-dark-8)',
          color: 'var(--mantine-color-gray-0)',
          fontWeight: 700,
        },
      })
      : undefined;

    const routesByFlow = new Map<string, typeof data.routes>();
    if (showRunnerContext) {
      data.routes.forEach((route) => {
        const collection = routesByFlow.get(route.flow);
        if (collection) {
          collection.push(route);
        } else {
          routesByFlow.set(route.flow, [route]);
        }
      });
    }

    const jobsByFlow = new Map<string, typeof data.scheduler.jobs>();
    if (showRunnerContext) {
      data.scheduler.jobs.forEach((job) => {
        if (!job.flow) return;
        const collection = jobsByFlow.get(job.flow);
        if (collection) {
          collection.push(job);
        } else {
          jobsByFlow.set(job.flow, [job]);
        }
      });
    }

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
            style: {
              padding: 14,
              borderRadius: 16,
              background: 'var(--mantine-color-purple-8)',
              color: 'var(--mantine-color-gray-0)',
              fontWeight: 600,
            },
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
              style: {
                padding: 10,
                borderRadius: 12,
                background: 'var(--mantine-color-purple-1)',
                color: 'var(--mantine-color-purple-9)',
                border: '1px solid var(--mantine-color-purple-4)',
              },
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
          const invokeY = currentY;
          const invokeId = createNode(formatInvoke(step), { x: centerX, y: invokeY }, {
            style: {
              padding: 14,
              borderRadius: 16,
              background: 'var(--mantine-color-indigo-8)',
              color: 'var(--mantine-color-gray-0)',
              boxShadow: '0 0 0 1px var(--mantine-color-indigo-5) inset',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.35,
            },
          });
          currentEntries.forEach((source) => createEdge(source, invokeId));
          currentEntries = [invokeId];
          currentY += Y_UNIT;

          const functionalParams = extractFunctionalParams(step);
          if (functionalParams.length > 0) {
            let offsetUnits = 1;
            functionalParams.forEach((descriptor) => {
              const paramCenter = centerX + offsetUnits * X_UNIT;
              const labelId = createNode(descriptor.key, { x: paramCenter, y: invokeY + Y_UNIT / 2 }, {
                style: {
                  padding: 10,
                  borderRadius: 12,
                  background: 'var(--mantine-color-yellow-2)',
                  color: 'var(--mantine-color-yellow-9)',
                  border: '1px dashed var(--mantine-color-yellow-6)',
                  fontWeight: 600,
                },
              });
              createEdge(invokeId, labelId, { animated: false, style: { strokeDasharray: '4 4', stroke: 'var(--mantine-color-yellow-8)' } });
              const nested = layoutSequence(descriptor.steps, paramCenter, invokeY + Y_UNIT, [labelId]);
              maxWidth = Math.max(maxWidth, offsetUnits + descriptor.width);
              maxFlowDepth = Math.max(maxFlowDepth, nested.nextY);
              offsetUnits += descriptor.width + 0.5;
            });
          }
        }
      });

      return { exits: currentEntries, nextY: currentY, width: maxWidth };
    };

    data.flows.forEach((flow, index) => {
      const centerX = (flowCenters.get(flow.name) ?? index * (X_UNIT + FLOW_GAP)) - centerShift;
      if (showClosures) {
        const closuresUsed = new Set<string>();
        collectClosuresFromSteps(flow.steps, closuresUsed);
        flowClosureUsage.set(flow.name, closuresUsed);
      }
      const flowNodeId = createNode(
        flow.description ? `Flow ${flow.name}\n${flow.description}` : `Flow ${flow.name}`,
        { x: centerX, y: FLOW_Y },
        {
          style: {
            padding: 16,
            borderRadius: 16,
            background: 'var(--mantine-color-blue-8)',
            color: 'var(--mantine-color-gray-0)',
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          },
          handles: { target: Position.Top, source: Position.Bottom },
        },
      );
      flowNodeIds.set(flow.name, flowNodeId);

      if (showRunnerContext && runnerId) {
        const routes = routesByFlow.get(flow.name) ?? [];
        const jobs = jobsByFlow.get(flow.name) ?? [];
        const totalInputs = routes.length + jobs.length;
        let inputIndex = 0;

        const attachInput = (label: string, x: number, style?: Node['style']) => {
          const inputId = createNode(label, { x, y: INPUT_Y }, {
            style:
              style
              ?? {
                padding: 10,
                borderRadius: 12,
                background: 'var(--mantine-color-cyan-8)',
                color: 'var(--mantine-color-gray-0)',
                boxShadow: '0 0 0 1px var(--mantine-color-cyan-4) inset',
              },
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
              background: job.enabled === false ? 'var(--mantine-color-gray-7)' : 'var(--mantine-color-teal-8)',
              color: 'var(--mantine-color-gray-0)',
              border: job.enabled === false ? '1px dashed var(--mantine-color-red-5)' : '1px solid var(--mantine-color-teal-4)',
            };
            attachInput(jobLabel, inputX, style);
            inputIndex += 1;
          });
        } else {
          const directId = createNode('Direct', { x: centerX, y: INPUT_Y }, {
            style: {
              padding: 10,
              borderRadius: 12,
              background: 'var(--mantine-color-gray-8)',
              color: 'var(--mantine-color-gray-0)',
              border: '1px dashed var(--mantine-color-gray-4)',
            },
            handles: { source: Position.Bottom, target: Position.Top },
          });
          createEdge(runnerId, directId, { animated: true, style: { strokeDasharray: '6 3' } });
          createEdge(directId, flowNodeId, { animated: true, style: { strokeDasharray: '6 3' } });
        }
      }

      const result = layoutSequence(flow.steps, centerX, flowStepStartY, [flowNodeId]);
      maxFlowDepth = Math.max(maxFlowDepth, result.nextY);
    });

    if (showClosures && data.closures.length > 0) {
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
          style: {
            padding: 12,
            borderRadius: 12,
            background: 'var(--mantine-color-orange-8)',
            color: 'var(--mantine-color-gray-0)',
            boxShadow: '0 0 0 1px var(--mantine-color-orange-5) inset',
          },
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
    }

    return { nodes, edges };
  }, [data, showClosures, showRunnerContext]);

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
        <Background gap={16} color="#2a2d34" />
      </ReactFlow>
    </div>
  );
}
