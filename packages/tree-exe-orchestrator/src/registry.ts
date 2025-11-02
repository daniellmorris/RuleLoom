import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import createHttpError from 'http-errors';
import { createRunner, type RunnerInstance } from 'tree-exe-runner';
import type { TreeExeLogger } from 'tree-exe-lib';

interface RunnerRecord {
  id: string;
  basePath: string;
  configPath: string;
  instance: RunnerInstance;
  createdAt: Date;
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

  async addRunner(options: { id?: string; configPath: string; basePath?: string }): Promise<RunnerRecord> {
    const id = options.id ?? uuidv4();
    if (this.records.has(id)) {
      throw createHttpError(409, `Runner with id "${id}" already exists.`);
    }

    const instance = await createRunner(options.configPath);
    const basePath = sanitizeBasePath(options.basePath, instance.config.server.http.basePath);

    if (this.findByBasePath(basePath)) {
      throw createHttpError(409, `A runner is already mounted at basePath "${basePath}".`);
    }

    const record: RunnerRecord = {
      id,
      basePath,
      configPath: options.configPath,
      instance,
      createdAt: new Date(),
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
    await record.instance.close().catch(() => undefined);
    this.records.delete(id);
    this.logger.info?.(`Runner ${id} removed`);
  }

  async closeAll(): Promise<void> {
    const tasks = Array.from(this.records.values()).map((record) =>
      record.instance.close().catch(() => undefined),
    );
    await Promise.all(tasks);
    this.records.clear();
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
          record.instance.app(req, res, (err?: any) => {
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
