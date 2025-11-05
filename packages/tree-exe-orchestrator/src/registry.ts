import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import createHttpError from 'http-errors';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRunner, type RunnerInstance } from 'tree-exe-runner';
import type { TreeExeLogger } from 'tree-exe-lib';

interface RunnerRecord {
  id: string;
  basePath: string;
  configPath: string;
  configSource: 'path' | 'inline';
  instance: RunnerInstance;
  createdAt: Date;
  tempDir?: string;
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

    const record: RunnerRecord = {
      id,
      basePath,
      configPath,
      configSource,
      tempDir,
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
    if (record.tempDir) {
      await fs.rm(record.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async closeAll(): Promise<void> {
    const tasks = Array.from(this.records.values()).map((record) =>
      record.instance.close().catch(() => undefined),
    );
    await Promise.all(tasks);
    for (const record of this.records.values()) {
      if (record.tempDir) {
        await fs.rm(record.tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
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
