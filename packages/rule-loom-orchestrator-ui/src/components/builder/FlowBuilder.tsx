import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconDeviceFloppy, IconPlus } from '@tabler/icons-react';
import ReactFlow, {
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { ClosureDefinition, FlowDefinition } from '../../types/flow';
import FlowSidebar from './FlowSidebar';
import NodeInspector from './NodeInspector';
import SimulationPanel from './SimulationPanel';

export type PaletteItem = { type: 'invoke' | 'branch'; label: string; closure?: string };

export type FlowBuilderFlowState = {
  id: string;
  name: string;
  description?: string;
  nodes: Node<BuilderNodeData>[];
  edges: Edge[];
};

export type BuilderNodeData = {
  label: string;
  closure?: string;
  assign?: string;
  when?: string;
  parameters?: string;
  typeLabel: string;
};

interface FlowBuilderProps {
  flows: FlowDefinition[];
  closures: ClosureDefinition[];
}

function formatConditionSummary(condition: unknown): string {
  try {
    if (!condition) return '';
    if (typeof condition === 'string') return condition;
    if (Array.isArray(condition)) return condition.map(formatConditionSummary).join(' AND ');
    if (typeof condition === 'object') {
      const clause = condition as { closure?: string; negate?: boolean };
      const prefix = clause.negate ? 'NOT ' : '';
      return `${prefix}${clause.closure ?? 'condition'}`;
    }
    return String(condition);
  } catch {
    return '';
  }
}

function createNodeFromStep(step: FlowDefinition['steps'][number], index: number): Node<BuilderNodeData> {
  const isBranch = step.type === 'branch';
  const label = isBranch
    ? `Branch (${step.cases.length + (step.otherwise ? 1 : 0)} paths)`
    : `Invoke ${step.closure}`;
  return {
    id: `step-${index}`,
    position: { x: index * 220, y: 120 },
    data: {
      label,
      closure: isBranch ? undefined : step.closure,
      assign: isBranch ? undefined : step.assign,
      when: step.when ? formatConditionSummary(step.when) : undefined,
      parameters: step.type === 'branch' ? undefined : JSON.stringify(step.parameters ?? {}, null, 2),
      typeLabel: isBranch ? 'branch' : 'invoke',
    },
    style: {
      border: `1px solid ${isBranch ? 'var(--mantine-color-purple-5)' : 'var(--mantine-color-indigo-5)'}`,
      borderRadius: 12,
      padding: 12,
      background: isBranch ? 'var(--mantine-color-purple-0)' : 'var(--mantine-color-indigo-0)',
      minWidth: 180,
    },
  };
}

function flowToState(flow: FlowDefinition, index: number): FlowBuilderFlowState {
  const nodes = (flow.steps ?? []).map((step, stepIndex) => createNodeFromStep(step, stepIndex));
  const edges: Edge[] = [];
  nodes.forEach((node, nodeIndex) => {
    const prev = nodes[nodeIndex - 1];
    if (prev) {
      edges.push({ id: `edge-${prev.id}-${node.id}`, source: prev.id, target: node.id });
    }
  });
  return {
    id: flow.name ?? `flow-${index + 1}`,
    name: flow.name ?? `Flow ${index + 1}`,
    description: flow.description,
    nodes,
    edges,
  };
}

function createBlankFlow(seed: number): FlowBuilderFlowState {
  return {
    id: `draft-${seed}`,
    name: `Draft flow ${seed}`,
    description: 'New canvas for experimenting with steps and closures.',
    nodes: [],
    edges: [],
  };
}

type FlowStateMap = Record<string, FlowBuilderFlowState>;

function FlowBuilderCanvas({ flows, closures }: FlowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const { project } = useReactFlow();
  const initialMap: FlowStateMap = useMemo(() => {
    if (flows.length) return Object.fromEntries(flows.map((flow, idx) => [flow.name ?? `flow-${idx + 1}`, flowToState(flow, idx)]));
    const blank = createBlankFlow(1);
    return { [blank.id]: blank };
  }, []);

  const [flowStateMap, setFlowStateMap] = useState<FlowStateMap>(initialMap);
  const initialActive = Object.keys(initialMap)[0] ?? 'draft-1';
  const [activeFlowId, setActiveFlowId] = useState<string>(initialActive);

  const activeFlow = flowStateMap[activeFlowId] ?? flowStateMap[initialActive];

  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNodeData>(activeFlow?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeFlow?.edges ?? []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<string>('inspect');

  const flowsHash = useMemo(() => JSON.stringify(flows ?? []), [flows]);

  useEffect(() => {
    setFlowStateMap((current) => {
      if (!flows.length) {
        const blank = createBlankFlow(1);
        setActiveFlowId(blank.id);
        return { [blank.id]: blank };
      }
      const nextEntries = flows.map((flow, idx) => {
        const existing = current[flow.name ?? `flow-${idx + 1}`];
        return [flow.name ?? `flow-${idx + 1}`, existing ?? flowToState(flow, idx)];
      });
      const nextMap = Object.fromEntries(nextEntries);
      setActiveFlowId((currentId) => (nextMap[currentId] ? currentId : nextEntries[0]?.[0] ?? 'draft-1'));
      return nextMap;
    });
  }, [flowsHash]);

  useEffect(() => {
    if (!activeFlow) return;
    setNodes(activeFlow.nodes ?? []);
    setEdges(activeFlow.edges ?? []);
    setSelectedNodeId(null);
  }, [activeFlowId, activeFlow, setNodes, setEdges]);

  useEffect(() => {
    if (!activeFlow) return;
    setFlowStateMap((current) => ({
      ...current,
      [activeFlowId]: { ...activeFlow, nodes: [...nodes], edges: [...edges] },
    }));
  }, [activeFlowId, nodes, edges]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  const addNode = useCallback(
    (item: PaletteItem, position?: { x: number; y: number }) => {
      const index = nodes.length;
      const basePosition = position ?? { x: 120 + index * 120, y: 160 };
      const nodeId = `builder-${Date.now()}-${index}`;
      const newNode: Node<BuilderNodeData> = {
        id: nodeId,
        position: basePosition,
        data: {
          label: item.label,
          closure: item.closure,
          typeLabel: item.type,
          parameters: item.type === 'invoke' ? '' : undefined,
        },
        style: {
          border: `1px dashed ${item.type === 'branch' ? 'var(--mantine-color-purple-5)' : 'var(--mantine-color-indigo-5)'}`,
          borderRadius: 12,
          padding: 12,
          background: 'var(--mantine-color-dark-7)',
          color: 'var(--mantine-color-gray-0)',
          minWidth: 200,
        },
      };

      setNodes((current) => {
        const updated = [...current, newNode];
        setEdges((edgeState) => {
          if (current.length === 0) return edgeState;
          const previousId = current[current.length - 1].id;
          return [...edgeState, { id: `edge-${previousId}-${nodeId}`, source: previousId, target: nodeId }];
        });
        return updated;
      });
      setSelectedNodeId(nodeId);
    },
    [nodes.length],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const payload = event.dataTransfer.getData('application/ruleloom-node');
      if (!payload) return;
      const item = JSON.parse(payload) as PaletteItem;
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = project({
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0),
      });
      addNode(item, position);
    },
    [addNode, project],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleConnect = useCallback(
    (connection: Edge | Connection) => setEdges((eds) => addEdge(connection, eds)),
    [],
  );

  const handleUpdateNode = useCallback(
    (id: string, data: Partial<BuilderNodeData>) => {
      setNodes((current) => current.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...data } } : node)));
    },
    [],
  );

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    setSelectedNodeId(null);
  }, []);

  const handleCreateFlow = () => {
    setFlowStates((current) => {
      const draftCount = current.filter((flow) => flow.id.startsWith('draft')).length;
      const newFlow = createBlankFlow(draftCount + 1);
      setActiveFlowId(newFlow.id);
      return [...current, newFlow];
    });
  };

  const handleChangeFlowMeta = (patch: Partial<Pick<FlowBuilderFlowState, 'name' | 'description'>>) => {
    if (!activeFlow) return;
    setFlowStates((current) =>
      current.map((flow) => (flow.id === activeFlow.id ? { ...flow, ...patch } : flow)),
    );
  };

  return (
    <Group align="flex-start" gap="md" wrap="nowrap">
      <FlowSidebar
        flows={flowStates}
        activeFlowId={activeFlowId}
        closures={closures}
        onSelectFlow={(id) => setActiveFlowId(id)}
        onCreateFlow={handleCreateFlow}
        onAddNode={addNode}
      />

      <Box style={{ flex: 1 }}>
        <Stack gap="sm" style={{ height: '100%' }}>
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Title order={5}>Canvas</Title>
              <Text size="sm" c="dimmed">
                Drag closures from the palette, wire steps together, and edit properties in the inspector.
              </Text>
            </Stack>
            <Group gap="xs">
              <Button variant="light" leftSection={<IconDeviceFloppy size={16} />}>
                Save draft locally
              </Button>
              <ActionIcon variant="subtle" color="red" aria-label="Clear flow" onClick={() => handleCreateFlow()}>
                <IconPlus size={16} />
              </ActionIcon>
            </Group>
          </Group>

          <Group align="flex-start" gap="md" wrap="nowrap" style={{ height: 620 }}>
            <Box
              ref={reactFlowWrapper}
              style={{ flex: 1, height: '100%', border: '1px solid var(--mantine-color-dark-5)', borderRadius: 12 }}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                fitView
                panOnScroll
                snapToGrid
                snapGrid={[16, 16]}
              >
                <MiniMap pannable zoomable />
                <Controls />
                <Background gap={16} color="#2a2d34" />
              </ReactFlow>
            </Box>

            <Box w={320} p="md" style={{ border: '1px solid var(--mantine-color-dark-5)', borderRadius: 12 }}>
              <Tabs value={rightPanelTab} onChange={(value) => setRightPanelTab(value ?? 'inspect')}>
                <Tabs.List grow>
                  <Tabs.Tab value="inspect">Inspector</Tabs.Tab>
                  <Tabs.Tab value="simulate">Simulation</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="inspect">
                  <Stack gap="sm" mt="sm" style={{ height: '100%' }}>
                    <Group justify="space-between" align="center">
                      <Title order={6} size="sm">
                        Inspector
                      </Title>
                      <Badge color="gray" variant="light">
                        {nodes.length} node{nodes.length === 1 ? '' : 's'}
                      </Badge>
                    </Group>
                    <Stack gap="xs">
                      <TextInput
                        label="Flow name"
                        value={activeFlow?.name ?? ''}
                        onChange={(event) => handleChangeFlowMeta({ name: event.currentTarget.value })}
                      />
                      <TextInput
                        label="Description"
                        value={activeFlow?.description ?? ''}
                        onChange={(event) => handleChangeFlowMeta({ description: event.currentTarget.value })}
                      />
                    </Stack>
                    <Divider label="Node details" labelPosition="center" />
                    <ScrollArea h={380} type="auto">
                      <NodeInspector
                        node={selectedNode}
                        closures={closures}
                        onUpdate={handleUpdateNode}
                        onDelete={handleDeleteNode}
                      />
                    </ScrollArea>
                    {!selectedNode && (
                      <Text size="sm" c="dimmed">
                        Select or drop a node to edit its configuration.
                      </Text>
                    )}
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel value="simulate">
                  <SimulationPanel flowName={activeFlow?.name} nodes={nodes} />
                </Tabs.Panel>
              </Tabs>
            </Box>
          </Group>
        </Stack>
      </Box>
    </Group>
  );
}

export default function FlowBuilder(props: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderCanvas {...props} />
    </ReactFlowProvider>
  );
}
