import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import createHttpError from 'http-errors';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRunner, type RunnerInstance } from 'tree-exe-runner';
import type { TreeExeLogger } from 'tree-exe-lib';
import { Counter, Histogram, MetricsRegistry } from './metrics.js';

interface RunnerRecord {
  id: string;
  basePath: string;
  configPath: string;
  configSource: 'path' | 'inline';
  instance: RunnerInstance;
  createdAt: Date;
  tempDir?: string;
  cleanup?: () => void;
}

function sanitizeBasePath(basePath?: string, fallback?: string): string {
  const provided = basePath ?? fallback ?? '/';
  if (!provided || provided === '/') return '/';
  let sanitized = provided.startsWith('/') ? provided : `/${provided}`;
  if (sanitized.length > 1 && sanitized.endsWith('/')) {
    sanitized = sanitized.slice(0, -1);
  }
  return sanitized;
}

export class RunnerRegistry {
  private records = new Map<string, RunnerRecord>();
  private readonly metricsRegistry = new MetricsRegistry();
  private readonly jobRunsCounter = new Counter(this.metricsRegistry, 'treeexe_scheduler_job_runs_total', 'Total scheduler job runs', ['runner', 'job', 'status']);
  private readonly jobDurationHistogram = new Histogram(
    this.metricsRegistry,
    'treeexe_scheduler_job_duration_seconds',
    'Scheduler job execution duration in seconds',
    ['runner', 'job', 'status'],
    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
  );
  private readonly httpRequestHistogram = new Histogram(
    this.metricsRegistry,
    'treeexe_runner_request_duration_seconds',
    'Duration of proxied runner HTTP requests in seconds',
    ['runner', 'method', 'status'],
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  );

  constructor(private readonly logger: TreeExeLogger) {}

  list(): RunnerRecord[] {
    return Array.from(this.records.values());
  }

  get(id: string): RunnerRecord | undefined {
    return this.records.get(id);
  }

  findByBasePath(basePath: string): RunnerRecord | undefined {
    return this.list().find((record) => record.basePath === basePath);
  }

  async addRunner(options: { id?: string; configPath?: string; configContent?: string; basePath?: string }): Promise<RunnerRecord> {
    const id = options.id ?? uuidv4();
    if (this.records.has(id)) {
      throw createHttpError(409, `Runner with id "${id}" already exists.`);
    }

    const { configPath, tempDir, configSource } = await this.resolveConfig(options);

    let instance: RunnerInstance;
    try {
      instance = await createRunner(configPath);
    } catch (error) {
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
      throw error;
    }
    const basePath = sanitizeBasePath(options.basePath, instance.config.server.http.basePath);

    if (this.findByBasePath(basePath)) {
      await instance.close().catch(() => undefined);
      if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
      throw createHttpError(409, `A runner is already mounted at basePath "${basePath}".`);
    }

    this.attachLoggerMirrors(id, instance.logger);
    const cleanup = this.attachMetrics(id, instance);

    const record: RunnerRecord = {
      id,
      basePath,
      configPath,
      configSource,
      tempDir,
      instance,
      createdAt: new Date(),
      cleanup,
    };

    this.records.set(id, record);
    this.logger.info?.(`Runner ${id} mounted at ${basePath}`);
    return record;
  }

  async removeRunner(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) {
      throw createHttpError(404, `Runner "${id}" not found.`);
    }
    record.cleanup?.();
    await record.instance.close().catch(() => undefined);
    this.records.delete(id);
    this.logger.info?.(`Runner ${id} removed`);
    if (record.tempDir) {
      await fs.rm(record.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async closeAll(): Promise<void> {
    const tasks = Array.from(this.records.values()).map((record) =>
      record.instance.close().catch(() => undefined),
    );
    for (const record of this.records.values()) {
      record.cleanup?.();
      if (record.tempDir) {
        await fs.rm(record.tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
    await Promise.all(tasks);
    this.records.clear();
  }

  async updateRunner(id: string, options: { configPath?: string; configContent?: string; basePath?: string }): Promise<RunnerRecord> {
    const existing = this.records.get(id);
    if (!existing) {
      throw createHttpError(404, `Runner "${id}" not found.`);
    }

    const newBasePath = sanitizeBasePath(options.basePath, existing.basePath);
    if (newBasePath !== existing.basePath && this.findByBasePath(newBasePath)) {
      throw createHttpError(409, `A runner is already mounted at basePath "${newBasePath}".`);
    }

    let inheritedInlineContent: string | undefined;
    if (!options.configPath && !options.configContent && existing.configSource === 'inline') {
      inheritedInlineContent = await fs.readFile(existing.configPath, 'utf8');
    }

    existing.cleanup?.();
    await existing.instance.close().catch(() => undefined);
    if (existing.tempDir) {
      await fs.rm(existing.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
    this.records.delete(id);

    const configPath = options.configPath ?? (existing.configSource === 'path' ? existing.configPath : undefined);
    const configContent = options.configContent ?? inheritedInlineContent;

    return this.addRunner({ id, configPath, configContent, basePath: newBasePath });
  }

  async getRunnerConfig(id: string): Promise<{ content: string; source: 'path' | 'inline' }> {
    const record = this.records.get(id);
    if (!record) {
      throw createHttpError(404, `Runner "${id}" not found.`);
    }
    const content = await fs.readFile(record.configPath, 'utf8');
    return { content, source: record.configSource };
  }

  getMetricsRegistry(): MetricsRegistry {
    return this.metricsRegistry;
  }

  private async resolveConfig(options: { configPath?: string; configContent?: string }): Promise<{ configPath: string; tempDir?: string; configSource: 'path' | 'inline' }> {
    if (options.configContent) {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'treeexe-runner-'));
      const configPath = path.join(tempDir, 'runner.yaml');
      await fs.writeFile(configPath, options.configContent, 'utf8');
      return { configPath, tempDir, configSource: 'inline' };
    }
    if (options.configPath) {
      const resolvedPath = path.isAbsolute(options.configPath)
        ? options.configPath
        : path.resolve(options.configPath);
      return { configPath: resolvedPath, configSource: 'path' };
    }
    throw createHttpError(400, 'configPath or configContent is required');
  }

  private attachLoggerMirrors(id: string, logger: TreeExeLogger): void {
    const prefix = `[runner:${id}]`;
    const orchestratorLogger = this.logger;
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
    for (const level of levels) {
      const original = logger[level];
      const orchestratorFn = orchestratorLogger[level];
      logger[level] = ((...args: unknown[]) => {
        original(...args);
        orchestratorFn(prefix, ...args);
      }) as typeof original;
    }
  }

  private attachMetrics(id: string, instance: RunnerInstance): () => void {
    const events = instance.events;
    if (!events || typeof events.on !== 'function') {
      return () => {};
    }

    const onStarted = (payload: { job: string }) => {
      this.jobRunsCounter.inc({ runner: id, job: payload.job, status: 'started' });
    };

    const onCompleted = (payload: { job: string; durationSeconds?: number }) => {
      this.jobRunsCounter.inc({ runner: id, job: payload.job, status: 'completed' });
      if (typeof payload.durationSeconds === 'number') {
        this.jobDurationHistogram.observe({ runner: id, job: payload.job, status: 'completed' }, payload.durationSeconds);
      }
    };

    const onFailed = (payload: { job: string; durationSeconds?: number }) => {
      this.jobRunsCounter.inc({ runner: id, job: payload.job, status: 'failed' });
      if (typeof payload.durationSeconds === 'number') {
        this.jobDurationHistogram.observe({ runner: id, job: payload.job, status: 'failed' }, payload.durationSeconds);
      }
    };

    events.on('scheduler:job:started', onStarted);
    events.on('scheduler:job:completed', onCompleted);
    events.on('scheduler:job:failed', onFailed);

    return () => {
      const off = (event: string, handler: (...args: any[]) => void) => {
        if (typeof (events as any).off === 'function') {
          (events as any).off(event, handler);
        } else {
          (events as any).removeListener(event, handler);
        }
      };
      off('scheduler:job:started', onStarted);
      off('scheduler:job:completed', onCompleted);
      off('scheduler:job:failed', onFailed);
    };
  }

  createDispatcher(apiPrefix = '/api'): express.RequestHandler {
    return (req, res, next) => {
      for (const record of this.records.values()) {
        const basePath = record.basePath;
        const originalUrl = req.url;

        if (basePath !== '/' && !originalUrl.startsWith(basePath)) {
          continue;
        }
        if (basePath === '/' && originalUrl.startsWith(apiPrefix)) {
          continue;
        }

        if (basePath === '/' || originalUrl === basePath || originalUrl.startsWith(`${basePath}/`)) {
          const stripped = basePath === '/' ? originalUrl : originalUrl.slice(basePath.length) || '/';
          req.url = stripped;
          const restore = () => {
            req.url = originalUrl;
          };
          res.on('finish', restore);
          res.on('close', restore);
          const method = req.method ?? 'GET';
          const start = process.hrtime.bigint();
          let finished = false;
          const finalize = () => {
            if (finished) return;
            finished = true;
            const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
            this.httpRequestHistogram.observe(
              { runner: record.id, method: method.toUpperCase(), status: String(res.statusCode) },
              durationSeconds,
            );
            res.off('finish', finalize);
            res.off('close', finalize);
          };
          res.on('finish', finalize);
          res.on('close', finalize);
          record.instance.app(req, res, (err?: any) => {
            finalize();
            restore();
            res.off('finish', restore);
            res.off('close', restore);
            if (err) return next(err);
            return next();
          });
          return;
        }
      }

      next();
    };
  }
}

export type { RunnerRecord };
