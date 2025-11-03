import { useMemo, useState } from 'react';
import {
  AppShell,
  Burger,
  Button,
  Group,
  Modal,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  Tabs,
  Badge,
  ActionIcon,
  Divider,
  Tooltip,
  Loader,
  Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import RunnerVisualizer from './components/RunnerVisualizer';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

interface RunnerSummary {
  id: string;
  basePath: string;
  configPath: string;
  createdAt: string;
  routes: Array<{ method: string; path: string; flow: string }>;
  scheduler: {
    jobs: Array<{ name: string; interval?: string | number; cron?: string; timeout?: string | number | boolean; enabled?: boolean }>;
    states: Array<{ name: string; runs: number; lastRun?: string; lastResult?: unknown; lastError?: string }>;
  };
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

function useRunners() {
  return useQuery<RunnerSummary[]>({
    queryKey: ['runners'],
    queryFn: () => fetchJSON(`${API_BASE}/runners`),
  });
}

function useRunnerDetail(id?: string) {
  return useQuery<RunnerSummary>({
    queryKey: ['runner', id],
    queryFn: () => fetchJSON(`${API_BASE}/runners/${id}`),
    enabled: Boolean(id),
  });
}

export default function App() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure();
  const [configPath, setConfigPath] = useState('');
  const [basePath, setBasePath] = useState('');
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data: runners, isLoading: runnersLoading } = useRunners();
  const { data: runnerDetail, isLoading: detailLoading } = useRunnerDetail(selectedRunnerId);

  const createRunnerMutation = useMutation({
    mutationFn: async () => {
      return fetchJSON(`${API_BASE}/runners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configPath: configPath.trim(), basePath: basePath.trim() || undefined }),
      });
    },
    onSuccess: (data: RunnerSummary) => {
      notifications.show({ title: 'Runner created', message: `Runner ${data.id} mounted at ${data.basePath}`, color: 'green' });
      setConfigPath('');
      setBasePath('');
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      setSelectedRunnerId(data.id);
      closeCreate();
    },
    onError: (error: unknown) => {
      notifications.show({ title: 'Failed to create runner', message: String(error), color: 'red' });
    },
  });

  const deleteRunnerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/runners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      return id;
    },
    onSuccess: (id) => {
      notifications.show({ title: 'Runner removed', message: `Runner ${id} deleted`, color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      if (selectedRunnerId === id) setSelectedRunnerId(undefined);
    },
    onError: (error: unknown) => {
      notifications.show({ title: 'Failed to delete runner', message: String(error), color: 'red' });
    },
  });

  const visualizerData = useMemo(() => {
    if (!runnerDetail) return null;
    return {
      id: runnerDetail.id,
      routes: runnerDetail.routes,
      scheduler: runnerDetail.scheduler,
    };
  }, [runnerDetail]);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <Title order={3}>TreeExe Orchestrator</Title>
          </Group>
          <Group>
            <Tooltip label="Refresh runners">
              <ActionIcon
                onClick={() => queryClient.invalidateQueries({ queryKey: ['runners'] })}
                variant="light"
                size="lg"
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
              Add Runner
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <AppShell.Section grow component={ScrollArea} px="xs">
          <Stack>
            {runnersLoading && <Loader size="sm" />}
            {runners?.map((runner) => (
              <NavLink
                key={runner.id}
                label={
                  <Group justify="space-between">
                    <Text fw={500}>{runner.id}</Text>
                    <Badge>{runner.basePath}</Badge>
                  </Group>
                }
                description={runner.configPath}
                active={selectedRunnerId === runner.id}
                onClick={() => setSelectedRunnerId(runner.id)}
                rightSection={
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteRunnerMutation.mutate(runner.id);
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                }
              />
            ))}
            {!runnersLoading && runners && runners.length === 0 && (
              <Text c="dimmed" ta="center">
                No runners configured yet.
              </Text>
            )}
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Stack>
          {detailLoading && selectedRunnerId && <Loader />}
          {!selectedRunnerId && <Text>Select a runner to view details.</Text>}
          {runnerDetail && (
            <Stack>
              <Group justify="space-between">
                <div>
                  <Title order={4}>{runnerDetail.id}</Title>
                  <Text c="dimmed">Mounted at {runnerDetail.basePath}</Text>
                  <Text size="sm">Config: {runnerDetail.configPath}</Text>
                </div>
                <Group>
                  <Badge>{new Date(runnerDetail.createdAt).toLocaleString()}</Badge>
                  <Badge color={runnerDetail.scheduler.jobs.length > 0 ? 'green' : 'gray'}>
                    {runnerDetail.scheduler.jobs.length} jobs
                  </Badge>
                </Group>
              </Group>
              <Divider />
              <Tabs defaultValue="routes">
                <Tabs.List>
                  <Tabs.Tab value="routes">Routes</Tabs.Tab>
                  <Tabs.Tab value="scheduler">Scheduler</Tabs.Tab>
                  <Tabs.Tab value="visual">Visualizer</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="routes">
                  <Stack my="md">
                    {runnerDetail.routes.length === 0 && <Text c="dimmed">No routes configured.</Text>}
                    {runnerDetail.routes.map((route) => (
                      <Group key={`${route.method}-${route.path}`} justify="space-between" className="route-item">
                        <Group>
                          <Badge color="blue" variant="light">
                            {route.method.toUpperCase()}
                          </Badge>
                          <Text fw={500}>{route.path}</Text>
                        </Group>
                        <Text size="sm" c="dimmed">
                          Flow: {route.flow}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="scheduler">
                  <Stack my="md">
                    {runnerDetail.scheduler.jobs.length === 0 && <Text c="dimmed">No scheduled jobs.</Text>}
                    {runnerDetail.scheduler.jobs.map((job) => (
                      <Box key={job.name} p="sm" radius="md" style={{ border: '1px solid var(--mantine-color-dark-5)' }}>
                        <Group justify="space-between">
                          <Text fw={600}>{job.name}</Text>
                          <Badge color={job.enabled === false ? 'gray' : 'green'}>{job.enabled === false ? 'disabled' : 'active'}</Badge>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {job.cron ? `Cron: ${job.cron}` : job.interval ? `Interval: ${job.interval}` : job.timeout ? `Timeout: ${job.timeout}` : ''}
                        </Text>
                        <Text size="sm">
                          Runs:{' '}
                          {runnerDetail.scheduler.states.find((state) => state.name === job.name)?.runs ?? 0}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="visual">
                  {visualizerData ? (
                    <RunnerVisualizer data={visualizerData} />
                  ) : (
                    <Text c="dimmed">No visual data available.</Text>
                  )}
                </Tabs.Panel>
              </Tabs>
            </Stack>
          )}
        </Stack>
      </AppShell.Main>

      <Modal opened={createOpened} onClose={closeCreate} title="Create Runner" centered>
        <Stack>
          <TextInput
            label="Config Path"
            placeholder="/absolute/path/to/config.yaml"
            value={configPath}
            onChange={(event) => setConfigPath(event.currentTarget.value)}
            required
          />
          <TextInput
            label="Base Path"
            placeholder="/my-runner"
            value={basePath}
            onChange={(event) => setBasePath(event.currentTarget.value)}
          />
          <Button
            onClick={() => createRunnerMutation.mutate()}
            loading={createRunnerMutation.isPending}
            disabled={!configPath.trim()}
          >
            Create
          </Button>
        </Stack>
      </Modal>
    </AppShell>
  );
}
