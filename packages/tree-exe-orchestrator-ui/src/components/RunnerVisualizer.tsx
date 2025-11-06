import { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, MiniMap, Node } from 'reactflow';

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

interface RunnerVisualizerProps {
  data: {
    id: string;
    routes: Array<{ method: string; path: string; flow: string }>;
    scheduler: {
      jobs: Array<{ name: string; flow?: string; interval?: string | number; cron?: string; timeout?: string | number | boolean; enabled?: boolean }>;
      states: Array<{ name: string; runs: number; lastRun?: string }>;
    };
    flows: FlowDefinition[];
  };
}

const FLOW_X_START = 220;
const FLOW_X_STEP = 220;
const FLOW_Y_STEP = 140;
const ROUTE_X = -320;
const JOB_X = -140;

function formatConditionClause(condition: FlowConditionClause): string {
  const prefix = condition.negate ? 'NOT ' : '';
  const params = condition.parameters ? Object.keys(condition.parameters) : [];
  const suffix = params.length ? ` (${params.join(', ')})` : '';
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
  const caseCount = step.cases.length;
  const otherwise = step.otherwise && step.otherwise.length > 0 ? ' + otherwise' : '';
  return `branch (${caseCount} case${caseCount === 1 ? '' : 's'}${otherwise})`;
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

export default function RunnerVisualizer({ data }: RunnerVisualizerProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    let nodeCounter = 0;
    let edgeCounter = 0;

    const createNode = (
      prefix: string,
      label: string,
      position: { x: number; y: number },
      extra: Partial<Node> = {},
    ) => {
      const id = `${prefix}-${nodeCounter++}`;
      const { data: extraData, draggable, ...rest } = extra;
      nodes.push({
        id,
        position,
        data: extraData ?? { label },
        draggable: draggable ?? false,
        ...rest,
      });
      return id;
    };

    const createEdge = (source: string, target: string, extra: Partial<Edge> = {}) => {
      const id = `edge-${edgeCounter++}`;
      edges.push({
        id,
        source,
        target,
        ...extra,
      });
      return id;
    };

    const flowRootIds = new Map<string, string>();
    const flowYPositions = new Map<string, number>();

    const rootId = createNode(
      'runner',
      `Runner ${data.id}`,
      { x: -40, y: -140 },
      {
        type: 'input',
        sourcePosition: 'left',
        style: { padding: 12, borderRadius: 12 },
      },
    );

    let nextFlowY = 0;

    const layoutSteps = (
      flowName: string,
      steps: FlowStep[],
      depth: number,
      startY: number,
      incoming: string[],
    ): { nextY: number; exits: string[] } => {
      let currentY = startY;
      let activeIncoming = incoming;
      let exits = incoming;

      steps.forEach((step) => {
        if (step.type === 'invoke') {
          const stepId = createNode(
            `${flowName}-step`,
            formatInvoke(step),
            { x: FLOW_X_START + depth * FLOW_X_STEP, y: currentY },
            {
              style: { padding: 12, borderRadius: 12, background: 'var(--mantine-color-dark-6)' },
              targetPosition: 'left',
              sourcePosition: 'right',
            },
          );
          activeIncoming.forEach((source) => createEdge(source, stepId, { animated: true }));
          activeIncoming = [stepId];
          exits = activeIncoming;
          currentY += FLOW_Y_STEP;
        } else {
          const branchId = createNode(
            `${flowName}-branch`,
            formatBranchSummary(step),
            { x: FLOW_X_START + depth * FLOW_X_STEP, y: currentY },
            {
              style: { padding: 12, borderRadius: 12, background: 'var(--mantine-color-dark-5)' },
              targetPosition: 'left',
              sourcePosition: 'right',
            },
          );
          activeIncoming.forEach((source) => createEdge(source, branchId, { animated: true }));
          let branchY = currentY + FLOW_Y_STEP;
          const branchExits: string[] = [];
          step.cases.forEach((caseStep, caseIndex) => {
            const caseId = createNode(
              `${flowName}-case`,
              formatCaseLabel(caseStep.when, caseIndex),
              { x: FLOW_X_START + (depth + 1) * FLOW_X_STEP, y: branchY },
              {
                style: { padding: 10, borderRadius: 12, background: 'var(--mantine-color-dark-7)' },
                targetPosition: 'left',
                sourcePosition: 'right',
              },
            );
            createEdge(branchId, caseId);
            const caseResult = layoutSteps(flowName, caseStep.steps, depth + 2, branchY + FLOW_Y_STEP, [caseId]);
            branchExits.push(...caseResult.exits);
            branchY = Math.max(branchY + FLOW_Y_STEP, caseResult.nextY);
          });
          if (step.otherwise && step.otherwise.length > 0) {
            const otherwiseId = createNode(
              `${flowName}-otherwise`,
              'otherwise',
              { x: FLOW_X_START + (depth + 1) * FLOW_X_STEP, y: branchY },
              {
                style: { padding: 10, borderRadius: 12, background: 'var(--mantine-color-dark-7)' },
                targetPosition: 'left',
                sourcePosition: 'right',
              },
            );
            createEdge(branchId, otherwiseId);
            const otherwiseResult = layoutSteps(flowName, step.otherwise, depth + 2, branchY + FLOW_Y_STEP, [otherwiseId]);
            branchExits.push(...otherwiseResult.exits);
            branchY = Math.max(branchY + FLOW_Y_STEP, otherwiseResult.nextY);
          }
          activeIncoming = branchExits.length ? branchExits : [branchId];
          exits = activeIncoming;
          currentY = branchY + FLOW_Y_STEP;
        }
      });

      return { nextY: currentY, exits };
    };

    data.flows.forEach((flow) => {
      const label = flow.description ? `Flow: ${flow.name}\n${flow.description}` : `Flow: ${flow.name}`;
      const flowId = createNode(
        `flow-${flow.name}`,
        label,
        { x: FLOW_X_START, y: nextFlowY },
        {
          style: { padding: 14, borderRadius: 12, background: 'var(--mantine-color-dark-5)' },
          targetPosition: 'left',
          sourcePosition: 'right',
        },
      );
      flowRootIds.set(flow.name, flowId);
      flowYPositions.set(flow.name, nextFlowY);
      const layoutResult = layoutSteps(flow.name, flow.steps, 1, nextFlowY + FLOW_Y_STEP, [flowId]);
      nextFlowY = Math.max(nextFlowY + FLOW_Y_STEP, layoutResult.nextY) + FLOW_Y_STEP;
    });

    const routeCountByFlow = new Map<string, number>();
    data.routes.forEach((route, index) => {
      const baseY = flowYPositions.get(route.flow) ?? index * FLOW_Y_STEP;
      const offsetIndex = routeCountByFlow.get(route.flow) ?? 0;
      const routeY = baseY + offsetIndex * (FLOW_Y_STEP / 2);
      routeCountByFlow.set(route.flow, offsetIndex + 1);
      const routeId = createNode(
        `route-${index}`,
        `${route.method.toUpperCase()} ${route.path}`,
        { x: ROUTE_X, y: routeY },
        {
          style: { padding: 12, borderRadius: 12, background: 'var(--mantine-color-dark-6)' },
          targetPosition: 'right',
          sourcePosition: 'right',
        },
      );
      createEdge(rootId, routeId);
      const flowTarget = flowRootIds.get(route.flow);
      if (flowTarget) {
        createEdge(routeId, flowTarget, { animated: true });
      }
    });

    const jobCountByFlow = new Map<string, number>();
    data.scheduler.jobs.forEach((job, index) => {
      const key = job.flow ?? `__${index}`;
      const baseY = job.flow ? flowYPositions.get(job.flow) ?? index * FLOW_Y_STEP : nextFlowY + index * FLOW_Y_STEP;
      const offsetIndex = jobCountByFlow.get(key) ?? 0;
      const jobY = baseY + offsetIndex * (FLOW_Y_STEP / 2);
      jobCountByFlow.set(key, offsetIndex + 1);
      const state = data.scheduler.states.find((s) => s.name === job.name);
      const lines = [
        `Job: ${job.name}`,
        job.flow ? `Flow: ${job.flow}` : undefined,
        formatSchedule(job),
        `Runs: ${state?.runs ?? 0}`,
      ].filter(Boolean);
      const jobId = createNode(
        `job-${job.name}`,
        lines.join('\n'),
        { x: JOB_X, y: jobY },
        {
          style: {
            padding: 12,
            borderRadius: 12,
            background: job.enabled === false ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-dark-6)',
            border: job.enabled === false ? '1px dashed var(--mantine-color-red-7)' : undefined,
          },
          targetPosition: 'right',
          sourcePosition: 'right',
        },
      );
      createEdge(rootId, jobId, { animated: true });
      if (job.flow) {
        const flowTarget = flowRootIds.get(job.flow);
        if (flowTarget) {
          createEdge(jobId, flowTarget, { animated: true });
        }
      }
    });

    if (data.routes.length === 0 && data.scheduler.jobs.length === 0) {
      flowRootIds.forEach((flowId) => {
        createEdge(rootId, flowId, { animated: true, style: { strokeDasharray: '4 2' } });
      });
    }

    return { nodes, edges };
  }, [data]);

  return (
    <div style={{ height: 460 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={16} color="#444" />
      </ReactFlow>
    </div>
  );
}
