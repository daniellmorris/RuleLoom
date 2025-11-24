import { Badge, Box, Button, Divider, Group, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { IconPlus, IconPlayerPlay, IconGitBranch } from '@tabler/icons-react';
import type { DragEvent } from 'react';
import type { ClosureDefinition } from '../../types/flow';
import type { FlowBuilderFlowState, PaletteItem } from './FlowBuilder';

interface FlowSidebarProps {
  flows: FlowBuilderFlowState[];
  activeFlowId: string;
  closures: ClosureDefinition[];
  onSelectFlow: (id: string) => void;
  onCreateFlow: () => void;
  onAddNode: (item: PaletteItem) => void;
}

export default function FlowSidebar({
  flows,
  activeFlowId,
  closures,
  onSelectFlow,
  onCreateFlow,
  onAddNode,
}: FlowSidebarProps) {
  const handleDragStart = (event: DragEvent<HTMLDivElement>, item: PaletteItem) => {
    event.dataTransfer.setData('application/ruleloom-node', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Box w={320} p="md" style={{ border: '1px solid var(--mantine-color-dark-5)', borderRadius: 12 }}>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={6} size="sm">
            Flows
          </Title>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={onCreateFlow} variant="light">
            New flow
          </Button>
        </Group>
        <ScrollArea h={160} type="auto">
          <Stack gap={4} pr="xs">
            {flows.map((flow) => (
              <Box
                key={flow.id}
                p="sm"
                style={{
                  border: `1px solid ${activeFlowId === flow.id ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-dark-4)'}`,
                  borderRadius: 8,
                  background: activeFlowId === flow.id ? 'var(--mantine-color-blue-1)' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => onSelectFlow(flow.id)}
              >
                <Group justify="space-between" align="center">
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text fw={600} size="sm">
                      {flow.name}
                    </Text>
                    {flow.description && (
                      <Text size="xs" c="dimmed">
                        {flow.description}
                      </Text>
                    )}
                  </Stack>
                  <Badge color={flow.nodes.length > 0 ? 'blue' : 'gray'} variant="light">
                    {flow.nodes.length} node{flow.nodes.length === 1 ? '' : 's'}
                  </Badge>
                </Group>
              </Box>
            ))}
            {flows.length === 0 && (
              <Text size="sm" c="dimmed" ta="center">
                No flows yet. Create one to start designing.
              </Text>
            )}
          </Stack>
        </ScrollArea>

        <Divider my="xs" label="Palette" labelPosition="center" />

        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={600} size="sm">
              Quick actions
            </Text>
          </Group>
          <Button
            leftSection={<IconPlayerPlay size={16} />}
            variant="subtle"
            size="sm"
            onClick={() => onAddNode({ type: 'invoke', label: 'Invoke closure' })}
          >
            Add invoke node
          </Button>
          <Button
            leftSection={<IconGitBranch size={16} />}
            variant="subtle"
            size="sm"
            onClick={() => onAddNode({ type: 'branch', label: 'Branch' })}
          >
            Add branch
          </Button>
        </Stack>

        <Divider label="Closures" labelPosition="center" />

        <ScrollArea h={220} type="auto">
          <Stack gap={6} pr="xs">
            {closures.map((closure, index) => {
              const label = closure.name ?? closure.type ?? `closure-${index}`;
              const description = closure.description ?? closure.template ?? closure.module;
              return (
                <Box
                  key={label + index}
                  p="sm"
                  style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 8, cursor: 'grab' }}
                  draggable
                  onDragStart={(event) => handleDragStart(event, { type: 'invoke', label, closure: label })}
                  onDoubleClick={() => onAddNode({ type: 'invoke', label, closure: label })}
                >
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text fw={600} size="sm">
                        {label}
                      </Text>
                      {description && (
                        <Text size="xs" c="dimmed">
                          {description}
                        </Text>
                      )}
                    </Stack>
                    {closure.template && <Badge color="violet">template</Badge>}
                  </Group>
                </Box>
              );
            })}
            {closures.length === 0 && (
              <Text size="sm" c="dimmed" ta="center">
                No closures found for this runner.
              </Text>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Box>
  );
}
