import { useEffect, useMemo, useState } from 'react';
import { Badge, Box, Group, NavLink, Paper, ScrollArea, Stack, Text, Title } from '@mantine/core';
import RunnerVisualizer, { type RunnerVisualizerProps } from './RunnerVisualizer';
import type { ClosureDefinition, FlowDefinition } from '../types/flow';

interface ClosureInspectorProps {
  closures: ClosureDefinition[];
}

export default function ClosureInspector({ closures }: ClosureInspectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(closures.length ? 0 : -1);

  useEffect(() => {
    if (closures.length === 0) {
      setSelectedIndex(-1);
      return;
    }
    setSelectedIndex((current) => (current >= 0 && current < closures.length ? current : 0));
  }, [closures]);

  const selectedClosure = useMemo(() => {
    if (selectedIndex < 0) return undefined;
    return closures[selectedIndex];
  }, [closures, selectedIndex]);

  const flowVisualizerData = useMemo<RunnerVisualizerProps['data'] | null>(() => {
    if (!selectedClosure || selectedClosure.type !== 'flow' || !Array.isArray(selectedClosure.steps)) {
      return null;
    }
    const flow: FlowDefinition = {
      name: selectedClosure.name ?? 'Flow closure',
      description: selectedClosure.description,
      steps: selectedClosure.steps,
    };
    return {
      id: selectedClosure.name ?? 'flow-closure',
      routes: [],
      scheduler: { jobs: [], states: [] },
      flows: [flow],
      closures: [],
    } satisfies RunnerVisualizerProps['data'];
  }, [selectedClosure]);

  return (
    <Group align="flex-start" gap="md" wrap="nowrap">
      <Box w={260} maw={260}>
        <Text fw={500} style={{ marginBottom: 8 }}>Config closures</Text>
        <ScrollArea h={480} style={{ paddingRight: 'var(--mantine-spacing-xs)' }}>
          <Stack gap={4}>
            {closures.map((closure, index) => (
              <NavLink
                key={`${closure.type}-${closure.name ?? index}`}
                label={closure.name ?? `Closure ${index + 1}`}
                description={closure.type}
                active={selectedIndex === index}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </Stack>
        </ScrollArea>
      </Box>
      <Paper withBorder radius="md" p="lg" style={{ flex: 1, minHeight: 360 }}>
        {selectedClosure ? (
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Title order={5}>{selectedClosure.name ?? selectedClosure.type}</Title>
                {selectedClosure.description && (
                  <Text size="sm" c="dimmed">
                    {selectedClosure.description}
                  </Text>
                )}
              </Stack>
              <Group gap="xs">
                <Badge color="violet">{selectedClosure.type}</Badge>
                {selectedClosure.template && <Badge color="blue">template: {selectedClosure.template}</Badge>}
                {selectedClosure.module && <Badge color="cyan">module: {selectedClosure.module}</Badge>}
              </Group>
            </Group>
            {flowVisualizerData ? (
              <>
                <DividerSection label="Flow diagram" />
                <RunnerVisualizer
                  data={flowVisualizerData}
                  showClosures={false}
                  showRunnerContext={false}
                />
              </>
            ) : (
              <>
                <DividerSection label="Details" />
                <Text size="sm" c="dimmed">
                  {selectedClosure.type === 'flow'
                    ? 'This flow closure does not define inline steps, so nothing can be visualized.'
                    : 'Visualization is only available for closures declared with type "flow".'}
                </Text>
              </>
            )}
            <DividerSection label="Raw configuration" />
            <Box
              component="pre"
              p="md"
              style={{
                background: 'var(--mantine-color-dark-7)',
                borderRadius: 12,
                overflowX: 'auto',
                fontFamily: 'Menlo, Consolas, monospace',
                fontSize: '0.85rem',
              }}
            >
              {JSON.stringify(selectedClosure, null, 2)}
            </Box>
          </Stack>
        ) : (
          <Stack gap="xs" align="center" justify="center" style={{ minHeight: 320 }}>
            <Text c="dimmed">Select a closure on the left to inspect it.</Text>
          </Stack>
        )}
      </Paper>
    </Group>
  );
}

function DividerSection({ label }: { label: string }) {
  return (
    <Group gap="xs" align="center">
      <Box style={{ flex: 1, height: 1, background: 'var(--mantine-color-dark-4)' }} />
      <Text size="xs" c="dimmed" style={{ textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Box style={{ flex: 1, height: 1, background: 'var(--mantine-color-dark-4)' }} />
    </Group>
  );
}
