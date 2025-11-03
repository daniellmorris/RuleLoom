import { useMemo } from 'react';
import ReactFlow, { Background, Controls, Node, Edge, MiniMap } from 'reactflow';

interface RunnerVisualizerProps {
  data: {
    id: string;
    routes: Array<{ method: string; path: string; flow: string }>;
    scheduler: {
      jobs: Array<{ name: string; interval?: string | number; cron?: string; timeout?: string | number | boolean; enabled?: boolean }>;
      states: Array<{ name: string; runs: number; lastRun?: string }>;
    };
  };
}

function formatSchedule(job: RunnerVisualizerProps['data']['scheduler']['jobs'][number]) {
  if (job.cron) return `cron: ${job.cron}`;
  if (job.interval) return `every ${job.interval}`;
  if (job.timeout) return `timeout ${job.timeout}`;
  return 'manual';
}

export default function RunnerVisualizer({ data }: RunnerVisualizerProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodes.push({ id: 'runner-root', position: { x: 0, y: 0 }, data: { label: `Runner ${data.id}` }, type: 'input' });

    data.routes.forEach((route, index) => {
      const nodeId = `route-${index}`;
      nodes.push({
        id: nodeId,
        position: { x: -200 + index * 200, y: 150 },
        data: { label: `${route.method.toUpperCase()} ${route.path}\nFlow: ${route.flow}` },
        style: { padding: 12, borderRadius: 12 },
      });
      edges.push({ id: `edge-root-route-${index}`, source: 'runner-root', target: nodeId });
    });

    data.scheduler.jobs.forEach((job, index) => {
      const nodeId = `job-${job.name}`;
      const state = data.scheduler.states.find((s) => s.name === job.name);
      nodes.push({
        id: nodeId,
        position: { x: -200 + index * 200, y: 320 },
        data: {
          label: `${job.name}\n${formatSchedule(job)}\nRuns: ${state?.runs ?? 0}`,
        },
        style: { padding: 12, borderRadius: 12, background: job.enabled === false ? '#555' : undefined },
      });
      edges.push({ id: `edge-root-job-${job.name}`, source: 'runner-root', target: nodeId, animated: true });
    });

    return { nodes, edges };
  }, [data]);

  return (
    <div style={{ height: 420 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={16} color="#444" />
      </ReactFlow>
    </div>
  );
}
