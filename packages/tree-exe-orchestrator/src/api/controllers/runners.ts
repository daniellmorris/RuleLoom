import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import { RunnerRegistry } from '../../registry.js';

function serializeRoutes(record: ReturnType<RunnerRegistry['get']>): Array<{ method: string; path: string; flow: string }> {
  const routes = record?.instance.config.server.http.routes ?? [];
  return routes.map((route) => ({
    method: route.method ?? 'post',
    path: route.path,
    flow: route.flow,
  }));
}

function serializeFlows(
  record: ReturnType<RunnerRegistry['get']>,
): Array<{ name: string; description?: string; steps: unknown[] }> {
  const flows = record?.instance.config.flows ?? [];
  return flows.map((flow) => ({
    name: flow.name,
    description: flow.description,
    steps: flow.steps,
  }));
}

function serializeJobs(record: ReturnType<RunnerRegistry['get']>) {
  const jobs = record?.instance.config.scheduler?.jobs ?? [];
  return jobs.map((job) => ({
    name: job.name,
    flow: job.flow,
    interval: job.interval,
    cron: job.cron,
    timeout: job.timeout,
    enabled: job.enabled !== false,
  }));
}

function serializeJobStates(record: ReturnType<RunnerRegistry['get']>) {
  const states = record?.instance.scheduler?.jobStates ?? new Map();
  return Array.from(states.entries()).map(([name, state]) => ({
    name,
    runs: state.runs,
    lastRun: state.lastRun?.toISOString(),
    lastResult: state.lastResult?.state,
    lastError: state.lastError ? String(state.lastError) : undefined,
  }));
}

function summarize(record: ReturnType<RunnerRegistry['get']>) {
  if (!record) return undefined;
  return {
    id: record.id,
    basePath: record.basePath,
    configPath: record.configPath,
    configSource: record.configSource,
    createdAt: record.createdAt.toISOString(),
    flows: serializeFlows(record),
    routes: serializeRoutes(record),
    scheduler: {
      jobs: serializeJobs(record),
      states: serializeJobStates(record),
    },
  };
}

export function listRunners(registry: RunnerRegistry) {
  return (_req: Request, res: Response) => {
    const results = registry.list().map((record) => summarize(record)!);
    res.json(results);
  };
}

export function getRunner(registry: RunnerRegistry) {
  return (req: Request, res: Response) => {
    const record = registry.get(req.params.id);
    if (!record) throw createHttpError(404, 'Runner not found');
    res.json(summarize(record));
  };
}

export function createRunnerController(registry: RunnerRegistry) {
  return async (req: Request, res: Response) => {
    const { configPath, configContent, basePath, id } = req.body as {
      configPath?: string;
      configContent?: string;
      basePath?: string;
      id?: string;
    };
    if (!configPath && !configContent) {
      throw createHttpError(400, 'configPath or configContent is required');
    }
    const record = await registry.addRunner({
      id,
      configPath: configPath?.trim(),
      configContent,
      basePath: basePath?.trim(),
    });
    res.status(201).json(summarize(record));
  };
}

export function updateRunnerController(registry: RunnerRegistry) {
  return async (req: Request, res: Response) => {
    const { configPath, configContent, basePath } = req.body as {
      configPath?: string;
      configContent?: string;
      basePath?: string;
    };
    if (!configPath && !configContent && basePath === undefined) {
      throw createHttpError(400, 'configPath, configContent, or basePath is required');
    }
    const record = await registry.updateRunner(req.params.id, {
      configPath: configPath?.trim(),
      configContent,
      basePath: basePath?.trim(),
    });
    res.json(summarize(record));
  };
}

export function deleteRunner(registry: RunnerRegistry) {
  return async (req: Request, res: Response) => {
    await registry.removeRunner(req.params.id);
    res.status(204).end();
  };
}

export function getRunnerConfigController(registry: RunnerRegistry) {
  return async (req: Request, res: Response) => {
    const result = await registry.getRunnerConfig(req.params.id);
    res.json({ id: req.params.id, source: result.source, config: result.content });
  };
}

export function getRunnerRoutes(registry: RunnerRegistry) {
  return (req: Request, res: Response) => {
    const record = registry.get(req.params.id);
    if (!record) throw createHttpError(404, 'Runner not found');
    res.json({ basePath: record.basePath, routes: serializeRoutes(record) });
  };
}

export function getRunnerJobs(registry: RunnerRegistry) {
  return (req: Request, res: Response) => {
    const record = registry.get(req.params.id);
    if (!record) throw createHttpError(404, 'Runner not found');
    res.json({ jobs: serializeJobs(record), states: serializeJobStates(record) });
  };
}

export function getRunnerHealth(registry: RunnerRegistry) {
  return (req: Request, res: Response) => {
    const record = registry.get(req.params.id);
    if (!record) throw createHttpError(404, 'Runner not found');
    const states = serializeJobStates(record);
    res.json({
      status: 'up',
      scheduler: {
        jobCount: states.length,
        jobs: states,
      },
    });
  };
}
