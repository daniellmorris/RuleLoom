import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import createHttpError from 'http-errors';
import { RunnerValidationError, validateConfig } from 'rule-loom-runner';
import { RunnerRegistry, type RunnerRecord } from '../../registry.js';
import { RunnerStore } from '../../persistence/runnerStore.js';

function serializeRoutes(record: ReturnType<RunnerRegistry['get']>): Array<{ method: string; path: string; flow: string }> {
  const httpInput = record?.instance.config.inputs.find((i: any) => i.type === 'http') as any;
  const triggers = httpInput?.triggers ?? [];
  return triggers.map((trigger: any) => ({
    method: trigger.method ?? 'post',
    path: trigger.path,
    flow: trigger.flow,
  }));
}

function serializeFlows(
  record: ReturnType<RunnerRegistry['get']>,
): Array<{ name: string; description?: string; steps: unknown[] }> {
  const flows = record?.instance.config.flows ?? [];
  return flows.map((flow: any) => ({
    name: flow.name,
    description: flow.description,
    steps: flow.steps,
  }));
}

function serializeClosures(
  record: ReturnType<RunnerRegistry['get']>,
): Array<{
  type: string;
  name?: string;
  description?: string;
  template?: string;
  module?: string;
  steps?: unknown[];
}> {
  const closures = record?.instance.config.closures ?? [];
  return closures.map((closure: any) => {
    const base = {
      type: closure.type as string,
      name: closure.name as string | undefined,
      description: closure.description as string | undefined,
    };
    if (closure.type === 'template') {
      return {
        ...base,
        template: closure.template as string | undefined,
      };
    }
    if (closure.type === 'module') {
      return {
        ...base,
        module: closure.module as string | undefined,
      };
    }
    if (closure.type === 'flow') {
      return {
        ...base,
        steps: closure.steps as unknown[] | undefined,
      };
    }
    return base;
  });
}

function serializeJobs(record: ReturnType<RunnerRegistry['get']>) {
  const schedulerConfig = record?.instance.config.inputs.find((i: any) => i.type === 'scheduler') as any;
  const triggers = schedulerConfig?.triggers ?? [];
  return triggers.map((job: any, idx: number) => ({
    name: job.name ?? job.id ?? `job-${idx + 1}`,
    flow: job.flow,
    interval: job.interval,
    cron: job.cron,
    timeout: job.timeout,
    enabled: job.enabled !== false,
  }));
}

function serializeJobStates(record: ReturnType<RunnerRegistry['get']>) {
  const states = (record?.instance.services as any)?.scheduler?.jobStates ?? new Map<string, any>();
  const entries = Array.from(states.entries()) as Array<[string, any]>;
  return entries.map(([name, state]) => ({
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
    closures: serializeClosures(record),
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

function buildPersistencePayload(record: RunnerRecord, inlineContent?: string | null) {
  return {
    id: record.id,
    basePath: record.basePath,
    configPath: record.configSource === 'path' ? record.configPath : null,
    configContent: record.configSource === 'inline' ? inlineContent ?? null : null,
  };
}

async function readInlineConfig(registry: RunnerRegistry, record?: RunnerRecord): Promise<string | undefined> {
  if (!record || record.configSource !== 'inline') {
    return undefined;
  }
    const snapshot = await registry.getRunnerConfig(record.id);
    return snapshot.content;
  }

export function createRunnerController(registry: RunnerRegistry, store: RunnerStore) {
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
    let record: RunnerRecord;
    try {
      record = await registry.addRunner({
        id,
        configPath: configPath?.trim(),
        configContent,
        basePath: basePath?.trim(),
      });
    } catch (error: unknown) {
      if (error instanceof RunnerValidationError) {
        throw createHttpError(400, error.message, { errors: error.result.issues });
      }
      throw error;
    }

    try {
      await store.create(buildPersistencePayload(record, configContent));
    } catch (error: unknown) {
      await registry.removeRunner(record.id).catch(() => undefined);
      throw createHttpError(500, 'Failed to persist runner', { cause: error });
    }

    res.status(201).json(summarize(record));
  };
}

export function updateRunnerController(registry: RunnerRegistry, store: RunnerStore) {
  return async (req: Request, res: Response) => {
    const { configPath, configContent, basePath } = req.body as {
      configPath?: string;
      configContent?: string;
      basePath?: string;
    };
    if (!configPath && !configContent && basePath === undefined) {
      throw createHttpError(400, 'configPath, configContent, or basePath is required');
    }
    const existing = registry.get(req.params.id);
    if (!existing) {
      throw createHttpError(404, 'Runner not found');
    }
    const previousInline = await readInlineConfig(registry, existing);

    let record: RunnerRecord;
    try {
      record = await registry.updateRunner(req.params.id, {
        configPath: configPath?.trim(),
        configContent,
        basePath: basePath?.trim(),
      });
    } catch (error: unknown) {
      if (error instanceof RunnerValidationError) {
        throw createHttpError(400, error.message, { errors: error.result.issues });
      }
      if (error instanceof Error) {
        throw createHttpError(500, error.message, { cause: error });
      }
      throw createHttpError(500, 'Unknown error while updating runner');
    }

    try {
      const inlineContent =
        record.configSource === 'inline'
          ? configContent ?? (await readInlineConfig(registry, record)) ?? null
          : null;
      await store.update(record.id, buildPersistencePayload(record, inlineContent));
    } catch (error: unknown) {
      await registry.removeRunner(record.id).catch(() => undefined);
      await registry
        .addRunner({
          id: existing.id,
          configPath: existing.configSource === 'path' ? existing.configPath : undefined,
          configContent: previousInline,
          basePath: existing.basePath,
        })
        .catch(() => undefined);
      if (error instanceof Error) {
        throw createHttpError(500, error.message, { cause: error });
      }
      throw createHttpError(500, 'Failed to persist runner update');
    }

    res.json(summarize(record));
  };
}

export function deleteRunner(registry: RunnerRegistry, store: RunnerStore) {
  return async (req: Request, res: Response) => {
    const existing = registry.get(req.params.id);
    if (!existing) {
      throw createHttpError(404, 'Runner not found');
    }
    const inlineContent = await readInlineConfig(registry, existing);

    await registry.removeRunner(req.params.id);

    try {
      await store.delete(req.params.id);
    } catch (error: unknown) {
      await registry
        .addRunner({
          id: existing.id,
          configPath: existing.configSource === 'path' ? existing.configPath : undefined,
          configContent: inlineContent,
          basePath: existing.basePath,
        })
        .catch(() => undefined);
      if (error instanceof Error) {
        throw createHttpError(500, error.message, { cause: error });
      }
      throw createHttpError(500, 'Failed to delete runner from persistence');
    }

    res.status(204).end();
  };
}

export function getRunnerConfigController(registry: RunnerRegistry) {
  return async (req: Request, res: Response) => {
    const result = await registry.getRunnerConfig(req.params.id);
    res.json({ id: req.params.id, source: result.source, config: result.content });
  };
}

export function validateRunnerConfigController() {
  return async (req: Request, res: Response) => {
    const { configPath, configContent } = req.body as { configPath?: string; configContent?: string };
    const artifact = await materializeConfigSource({ configPath: configPath?.trim(), configContent });
    try {
      const result = await validateConfig(artifact.path);
      res.json(result);
    } finally {
      await artifact.cleanup();
    }
  };
}

async function materializeConfigSource(options: { configPath?: string | null; configContent?: string | null }) {
  if (options.configContent) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruleloom-validate-'));
    const filePath = path.join(dir, 'runner.yaml');
    await fs.writeFile(filePath, options.configContent, 'utf8');
    return {
      path: filePath,
      cleanup: () => fs.rm(dir, { recursive: true, force: true }).catch(() => undefined),
    };
  }
  if (options.configPath) {
    const resolvedPath = path.isAbsolute(options.configPath) ? options.configPath : path.resolve(options.configPath);
    return {
      path: resolvedPath,
      cleanup: () => Promise.resolve(),
    };
  }
  throw createHttpError(400, 'configPath or configContent is required');
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
