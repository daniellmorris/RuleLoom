import { useMemo, useState, useEffect } from 'react';
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
  SegmentedControl,
  Textarea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconRefresh, IconTrash, IconEdit } from '@tabler/icons-react';
import RunnerVisualizer from './components/RunnerVisualizer';
import ClosureInspector from './components/ClosureInspector';
import FlowInspector from './components/FlowInspector';
import FlowBuilder from './components/builder/FlowBuilder';
import type { FlowDefinition, ClosureDefinition } from './types/flow';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

interface RunnerSummary {
  id: string;
  basePath: string;
  configPath: string;
  configSource: 'path' | 'inline';
  createdAt: string;
  routes: Array<{ method: string; path: string; flow: string }>;
  scheduler: {
    jobs: Array<{ name: string; flow?: string; interval?: string | number; cron?: string; timeout?: string | number | boolean; enabled?: boolean }>;
    states: Array<{ name: string; runs: number; lastRun?: string; lastResult?: unknown; lastError?: string }>;
  };
  flows: FlowDefinition[];
  closures: ClosureDefinition[];
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

function useRunnerConfig(id?: string, enabled?: boolean) {
  return useQuery<{ id: string; config: string; source: 'path' | 'inline' }>({
    queryKey: ['runner-config', id],
    queryFn: () => fetchJSON(`${API_BASE}/runners/${id}/config`),
    enabled: Boolean(id) && Boolean(enabled),
  });
}

export default function App() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure();
  const [configPath, setConfigPath] = useState('');
  const [configContent, setConfigContent] = useState('');
  const [createMode, setCreateMode] = useState<'path' | 'inline'>('inline');
  const [basePath, setBasePath] = useState('');
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | undefined>(undefined);
  const [editOpened, setEditOpened] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editBasePath, setEditBasePath] = useState('');
  const [editMode, setEditMode] = useState<'path' | 'inline'>('inline');
  const [editConfigPath, setEditConfigPath] = useState('');
  const [visualMode, setVisualMode] = useState<'flow' | 'closures'>('flow');
  const queryClient = useQueryClient();

  const { data: runners, isLoading: runnersLoading } = useRunners();
  const { data: runnerDetail, isLoading: detailLoading } = useRunnerDetail(selectedRunnerId);
  const runnerConfigQuery = useRunnerConfig(selectedRunnerId, editOpened);

  const handleOpenCreate = () => {
    setConfigPath('');
    setConfigContent('');
    setBasePath('');
    setCreateMode('inline');
    openCreate();
  };

  const handleOpenEdit = () => {
    if (!runnerDetail) return;
    setEditContent('');
    setEditConfigPath(runnerDetail.configPath ?? '');
    setEditBasePath(runnerDetail.basePath ?? '');
    setEditMode(runnerDetail.configSource);
    setEditOpened(true);
  };

  const createRunnerMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      if (basePath.trim()) payload.basePath = basePath.trim();
      if (createMode === 'inline') {
        if (!configContent.trim()) throw new Error('Configuration content is required');
        payload.configContent = configContent;
      } else {
        if (!configPath.trim()) throw new Error('Config path is required');
        payload.configPath = configPath.trim();
      }
      return fetchJSON(`${API_BASE}/runners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data: RunnerSummary) => {
      notifications.show({ title: 'Runner created', message: `Runner ${data.id} mounted at ${data.basePath}`, color: 'green' });
      setConfigPath('');
      setConfigContent('');
      setBasePath('');
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      setSelectedRunnerId(data.id);
      closeCreate();
    },
    onError: (error: unknown) => {
      notifications.show({ title: 'Failed to create runner', message: String(error), color: 'red' });
    },
  });

  const editRunnerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRunnerId) throw new Error('No runner selected');
      const payload: Record<string, unknown> = {};
      if (editBasePath.trim()) payload.basePath = editBasePath.trim();
      if (editMode === 'inline') {
        if (!editContent.trim()) throw new Error('Configuration content is required');
        payload.configContent = editContent;
      } else {
        if (!editConfigPath.trim()) throw new Error('Config path is required');
        payload.configPath = editConfigPath.trim();
      }
      return fetchJSON<RunnerSummary>(`${API_BASE}/runners/${selectedRunnerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      notifications.show({ title: 'Runner updated', message: `Runner ${data.id} updated`, color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['runners'] });
      queryClient.invalidateQueries({ queryKey: ['runner', selectedRunnerId] });
      setSelectedRunnerId(data.id);
      setEditOpened(false);
    },
    onError: (error: unknown) => {
      notifications.show({ title: 'Failed to update runner', message: String(error), color: 'red' });
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
      flows: runnerDetail.flows,
      closures: runnerDetail.closures,
    };
  }, [runnerDetail]);

  useEffect(() => {
    if (runnerDetail) {
      setEditBasePath(runnerDetail.basePath);
      setEditConfigPath(runnerDetail.configPath);
      setEditMode(runnerDetail.configSource);
    } else {
      setEditBasePath('');
      setEditConfigPath('');
      setEditMode('inline');
    }
  }, [runnerDetail]);

  useEffect(() => {
    setVisualMode('flow');
  }, [selectedRunnerId]);

  useEffect(() => {
    if (runnerConfigQuery.data) {
      setEditContent(runnerConfigQuery.data.config);
    }
  }, [runnerConfigQuery.data]);

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
            <Title order={3}>RuleLoom Orchestrator</Title>
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
            <Button leftSection={<IconPlus size={18} />} onClick={handleOpenCreate}>
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
                description={
                  runner.configSource === 'inline' ? 'Inline configuration' : runner.configPath
                }
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
              <Group justify="space-between" align="flex-start">
                <Stack gap="xs">
                  <Title order={4}>{runnerDetail.id}</Title>
                  <Text c="dimmed">Mounted at {runnerDetail.basePath}</Text>
                  <Text size="sm">
                    {runnerDetail.configSource === 'inline'
                      ? 'Configuration stored inline on the orchestrator'
                      : `Server config path: ${runnerDetail.configPath}`}
                  </Text>
                  {runnerDetail.configSource === 'path' && (
                    <Text size="xs" c="dimmed">
                      Paths are resolved relative to the orchestrator host.
                    </Text>
                  )}
                </Stack>
                <Group gap="xs">
                  <Badge variant="light" color={runnerDetail.configSource === 'inline' ? 'blue' : 'gray'}>
                    {runnerDetail.configSource === 'inline' ? 'Inline config' : 'Server path'}
                  </Badge>
                  <Badge>{new Date(runnerDetail.createdAt).toLocaleString()}</Badge>
                  <Badge color={runnerDetail.scheduler.jobs.length > 0 ? 'green' : 'gray'}>
                    {runnerDetail.scheduler.jobs.length} jobs
                  </Badge>
                  <Badge color={runnerDetail.closures.length > 0 ? 'indigo' : 'gray'}>
                    {runnerDetail.closures.length} closures
                  </Badge>
                  <Button
                    size="sm"
                    leftSection={<IconEdit size={16} />}
                    variant="light"
                    onClick={handleOpenEdit}
                  >
                    Edit
                  </Button>
                </Group>
              </Group>
              <Divider />
              <Tabs defaultValue="routes">
                <Tabs.List>
                  <Tabs.Tab value="routes">Routes</Tabs.Tab>
                  <Tabs.Tab value="scheduler">Scheduler</Tabs.Tab>
                  <Tabs.Tab value="closures">Closures</Tabs.Tab>
                  <Tabs.Tab value="visual">Visualizer</Tabs.Tab>
                  <Tabs.Tab value="builder">Builder (beta)</Tabs.Tab>
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

                <Tabs.Panel value="closures">
                  <Stack my="md">
                    {runnerDetail.closures.length === 0 && <Text c="dimmed">No closures defined.</Text>}
                    {runnerDetail.closures.map((closure, index) => {
                      const key = `${closure.type}-${closure.name ?? index}`;
                      return (
                        <Box key={key} p="sm" radius="md" style={{ border: '1px solid var(--mantine-color-dark-5)' }}>
                          <Group justify="space-between" align="flex-start">
                            <Stack gap={2}>
                              <Group gap="xs">
                                <Badge color="violet" variant="light">
                                  {closure.type}
                                </Badge>
                                {closure.name && <Text fw={600}>{closure.name}</Text>}
                              </Group>
                              {closure.description && (
                                <Text size="sm" c="dimmed">
                                  {closure.description}
                                </Text>
                              )}
                            </Stack>
                            <Stack gap={0} align="flex-end">
                              {closure.template && <Badge color="blue">template: {closure.template}</Badge>}
                              {closure.module && <Badge color="cyan">module: {closure.module}</Badge>}
                            </Stack>
                          </Group>
                        </Box>
                      );
                    })}
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="visual">
                  <Stack my="md" gap="md">
                    <Group justify="space-between" align="center" wrap="wrap">
                      <SegmentedControl
                        value={visualMode}
                        onChange={(value) => setVisualMode(value as 'flow' | 'closures')}
                        data={[
                          { label: 'Main flows', value: 'flow' },
                          { label: 'Config closures', value: 'closures' },
                        ]}
                      />
                      <Text size="sm" c="dimmed">
                        {visualMode === 'flow'
                          ? 'Visualizes runner, routes, jobs, and flow steps only.'
                          : 'Browse closures defined in the runner configuration.'}
                      </Text>
                    </Group>
                    {visualMode === 'flow' ? (
                      visualizerData ? (
                        <FlowInspector data={visualizerData} />
                      ) : (
                        <Text c="dimmed">No flow data available.</Text>
                      )
                    ) : runnerDetail.closures.length > 0 ? (
                      <ClosureInspector closures={runnerDetail.closures} />
                    ) : (
                      <Text c="dimmed">No closures defined in configuration.</Text>
                    )}
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="builder">
                  <Stack my="md">
                    <FlowBuilder
                      key={runnerDetail.id}
                      flows={runnerDetail.flows}
                      closures={runnerDetail.closures}
                    />
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Stack>
          )}
        </Stack>
      </AppShell.Main>

      <Modal opened={editOpened} onClose={() => setEditOpened(false)} title="Edit Runner" centered size="lg">
        <Stack>
          <SegmentedControl
            value={editMode}
            onChange={(value) => setEditMode(value as 'path' | 'inline')}
            data={[
              { label: 'Inline YAML', value: 'inline' },
              { label: 'Server Path', value: 'path' },
            ]}
          />
          {editMode === 'path' ? (
            <TextInput
              label="Config Path"
              placeholder="/absolute/path/to/config.yaml"
              value={editConfigPath}
              onChange={(event) => setEditConfigPath(event.currentTarget.value)}
              required
              description="This path is resolved on the orchestrator server."
            />
          ) : (
            <Stack gap="xs">
              {runnerConfigQuery.isFetching && (
                <Group gap="xs">
                  <Loader size="sm" />
                  <Text size="sm">Loading configuration...</Text>
                </Group>
              )}
              <Textarea
                label="Configuration YAML"
                placeholder="Update runner configuration YAML"
                value={editContent}
                onChange={(event) => setEditContent(event.currentTarget.value)}
                minRows={14}
                autosize
                disabled={runnerConfigQuery.isFetching}
                required
              />
            </Stack>
          )}
          <TextInput
            label="Base Path"
            placeholder="/my-runner"
            value={editBasePath}
            onChange={(event) => setEditBasePath(event.currentTarget.value)}
            description="Leave empty to keep the current base path."
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditOpened(false)} disabled={editRunnerMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => editRunnerMutation.mutate()}
              loading={editRunnerMutation.isPending}
              disabled={editMode === 'inline' ? !editContent.trim() : !editConfigPath.trim()}
            >
              Save changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={createOpened} onClose={closeCreate} title="Create Runner" centered>
        <Stack>
          <SegmentedControl
            value={createMode}
            onChange={(value) => setCreateMode(value as 'path' | 'inline')}
            data={[
              { label: 'Inline YAML', value: 'inline' },
              { label: 'Server Path', value: 'path' },
            ]}
          />
          {createMode === 'path' ? (
            <TextInput
              label="Config Path"
              placeholder="/absolute/path/to/config.yaml"
              value={configPath}
              onChange={(event) => setConfigPath(event.currentTarget.value)}
              required
            />
          ) : (
            <Textarea
              label="Configuration YAML"
              placeholder="Paste runner configuration YAML"
              value={configContent}
              onChange={(event) => setConfigContent(event.currentTarget.value)}
              minRows={12}
              autosize
              required
            />
          )}
          <TextInput
            label="Base Path"
            placeholder="/my-runner"
            value={basePath}
            onChange={(event) => setBasePath(event.currentTarget.value)}
          />
          <Button
            onClick={() => createRunnerMutation.mutate()}
            loading={createRunnerMutation.isPending}
            disabled={
              createMode === 'inline' ? !configContent.trim() : !configPath.trim()
            }
          >
            Create
          </Button>
        </Stack>
      </Modal>
    </AppShell>
  );
}
