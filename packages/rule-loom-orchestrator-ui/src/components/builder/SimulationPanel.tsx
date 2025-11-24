import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Divider, Group, ScrollArea, Stack, Text, Textarea, Timeline } from '@mantine/core';
import { IconPlayerPlay, IconRotateClockwise2, IconStepInto, IconChecks } from '@tabler/icons-react';
import type { Node } from 'reactflow';
import type { BuilderNodeData } from './FlowBuilder';

interface SimulationPanelProps {
  flowName?: string;
  nodes: Node<BuilderNodeData>[];
}

type SimulationState = 'idle' | 'running' | 'done';

export default function SimulationPanel({ flowName, nodes }: SimulationPanelProps) {
  const [input, setInput] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [state, setState] = useState<SimulationState>('idle');
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  const totalSteps = nodes.length;

  useEffect(() => {
    setInput('');
    setLog([]);
    setState('idle');
    setCurrentIndex(-1);
  }, [flowName, nodes]);

  const statusBadge = useMemo(() => {
    if (state === 'done') return <Badge color="green">Complete</Badge>;
    if (state === 'running') return <Badge color="blue">Running</Badge>;
    return <Badge color="gray">Idle</Badge>;
  }, [state]);

  const handleStart = () => {
    setLog([
      `Starting simulation for ${flowName ?? 'flow'} (${totalSteps} nodes)`,
      input.trim() ? `Input: ${input.trim()}` : 'Input: (none provided)',
    ]);
    setState(totalSteps === 0 ? 'done' : 'running');
    setCurrentIndex(totalSteps === 0 ? -1 : 0);
  };

  const handleStep = () => {
    if (state !== 'running' || currentIndex < 0 || currentIndex >= totalSteps) return;
    const node = nodes[currentIndex];
    const label = node.data.label || `Node ${currentIndex + 1}`;
    const closurePart = node.data.closure ? ` • ${node.data.closure}` : '';
    const whenPart = node.data.when ? ` (when: ${node.data.when})` : '';
    setLog((entries) => [...entries, `Step ${currentIndex + 1}: ${label}${closurePart}${whenPart}`]);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalSteps) {
      setState('done');
      setCurrentIndex(-1);
      setLog((entries) => [...entries, 'Simulation complete']);
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const handleReset = () => {
    setInput('');
    setLog([]);
    setState('idle');
    setCurrentIndex(-1);
  };

  return (
    <Stack gap="sm" mt="sm">
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Text fw={600} size="sm">
            Simulation mode
          </Text>
          <Text size="xs" c="dimmed">
            Provide sample input and walk through the current flow step-by-step.
          </Text>
        </Stack>
        {statusBadge}
      </Group>

      <Textarea
        label="Sample input"
        placeholder="JSON, query, or event payload to visualize"
        minRows={3}
        autosize
        value={input}
        onChange={(event) => setInput(event.currentTarget.value)}
      />

      <Group gap="xs" grow>
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          onClick={handleStart}
          disabled={state === 'running'}
          variant="light"
        >
          Start simulation
        </Button>
        <Button
          leftSection={<IconStepInto size={16} />}
          onClick={handleStep}
          disabled={state !== 'running'}
          variant="default"
        >
          Next step
        </Button>
      </Group>

      <Group gap="xs">
        <Button
          leftSection={<IconRotateClockwise2 size={16} />}
          onClick={handleReset}
          variant="subtle"
          color="gray"
        >
          Reset
        </Button>
        <Text size="sm" c="dimmed">
          Steps: {totalSteps}
        </Text>
      </Group>

      <Divider label="Timeline" labelPosition="center" />
      <ScrollArea h={260} type="auto">
        {log.length === 0 ? (
          <Text size="sm" c="dimmed">
            Start a simulation to see step-by-step output.
          </Text>
        ) : (
          <Timeline active={log.length} bulletSize={16} lineWidth={2} color="blue">
            {log.map((entry, index) => (
              <Timeline.Item
                key={index}
                bullet={index === log.length - 1 && state === 'done' ? <IconChecks size={12} /> : undefined}
              >
                <Text size="sm">{entry}</Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </ScrollArea>
    </Stack>
  );
}
