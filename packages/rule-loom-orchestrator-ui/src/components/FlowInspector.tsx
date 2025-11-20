import { useEffect, useMemo, useState } from 'react';
import { Box, Group, NavLink, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import RunnerVisualizer, { type RunnerVisualizerProps } from './RunnerVisualizer';

interface FlowInspectorProps {
  data: RunnerVisualizerProps['data'];
}

export default function FlowInspector({ data }: FlowInspectorProps) {
  const [selectedFlowName, setSelectedFlowName] = useState<string>(data.flows[0]?.name ?? '');

  useEffect(() => {
    if (!data.flows.length) {
      setSelectedFlowName('');
      return;
    }
    setSelectedFlowName((current) => (data.flows.some((flow) => flow.name === current) ? current : data.flows[0].name));
  }, [data.flows]);

  const selectedFlow = data.flows.find((flow) => flow.name === selectedFlowName);

  const singleFlowData = useMemo<RunnerVisualizerProps['data']>(() => {
    if (!selectedFlow) {
      return { ...data, flows: [] };
    }
    return {
      ...data,
      flows: [selectedFlow],
    };
  }, [data, selectedFlow]);

  const configText = useMemo(() => {
    if (!selectedFlow) return 'Select a flow to view its configuration.';
    return JSON.stringify(selectedFlow, null, 2);
  }, [selectedFlow]);

  return (
    <Group align="flex-start" gap="md" wrap="nowrap">
      <Paper withBorder radius="md" p="md" style={{ width: 360, flexShrink: 0 }}>
        <Stack gap="sm">
          <Box>
            <Text fw={500} size="sm" mb={4}>Flows</Text>
            <ScrollArea h={140}>
              <Stack gap={2}>
                {data.flows.map((flow) => (
                  <NavLink
                    key={flow.name}
                    label={flow.name}
                    description={flow.description}
                    active={flow.name === selectedFlowName}
                    onClick={() => setSelectedFlowName(flow.name)}
                  />
                ))}
                {data.flows.length === 0 && <Text size="sm" c="dimmed">No flows available.</Text>}
              </Stack>
            </ScrollArea>
          </Box>
          <Stack gap={4}>
            <Text fw={500} size="sm">Flow configuration (JSON)</Text>
            <Box
              component="pre"
              p="md"
              style={{
                background: 'var(--mantine-color-dark-7)',
                borderRadius: 12,
                minHeight: 200,
                maxHeight: 360,
                overflow: 'auto',
                fontFamily: 'Menlo, Consolas, monospace',
                fontSize: '0.82rem',
              }}
            >
              {configText}
            </Box>
          </Stack>
        </Stack>
      </Paper>
      <Paper withBorder radius="md" p="md" style={{ flex: 1 }}>
        {selectedFlow ? (
          <RunnerVisualizer data={singleFlowData} showClosures={false} />
        ) : (
          <Stack align="center" justify="center" style={{ minHeight: 320 }}>
            <Text c="dimmed">Select a flow to visualize it.</Text>
          </Stack>
        )}
      </Paper>
    </Group>
  );
}
