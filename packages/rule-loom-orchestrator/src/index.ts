import http from 'node:http';
import express from 'express';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger, type RuleLoomLogger } from 'rule-loom-lib';
import { loadOrchestratorConfig, type OrchestratorConfig } from './config.js';
import { RunnerRegistry } from './registry.js';
import { createOrchestratorApi } from './api/app.js';
import { RunnerStore, type RunnerPersistenceRecord } from './persistence/runnerStore.js';

export interface OrchestratorInstance {
  app: express.Express;
  config: OrchestratorConfig;
  logger: ReturnType<typeof createLogger>;
  registry: RunnerRegistry;
  runnerStore: RunnerStore;
  listen: (port?: number) => Promise<http.Server>;
  close: () => Promise<void>;
}

export interface StartOptions {
  configPath: string;
  portOverride?: number;
}

export async function createOrchestrator(configPath: string): Promise<OrchestratorInstance> {
  const config = await loadOrchestratorConfig(configPath);
  const logger = createLogger(config.logger?.level ?? 'info');

  const app = express();
  app.use(morgan('combined'));

  const registry = new RunnerRegistry(logger);
  const runnerStore = new RunnerStore();
  const persisted = await restorePersistedRunners(runnerStore, registry, logger);
  await seedConfiguredRunners(config, runnerStore, registry, logger, persisted);
  const metricsRegistry = registry.getMetricsRegistry();

  app.get('/metrics', (_req, res) => {
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.send(metricsRegistry.render());
  });

  const apiRouter = await createOrchestratorApi(registry, runnerStore);
  app.use('/api', apiRouter);

  const uiDistPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../rule-loom-orchestrator-ui/dist');
  if (fs.existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/__ruleloom')) return next();
      res.sendFile(path.join(uiDistPath, 'index.html'));
    });
  }

  const dispatcher = registry.createDispatcher();
  app.use(dispatcher);

  app.get('/__ruleloom/health', (_req, res) => {
    res.json({ status: 'ok', runners: registry.list().length });
  });

  let server: http.Server | undefined;

  const listen = async (port?: number) => {
    if (server) {
      throw new Error('Orchestrator already listening');
    }
    const envPortValue = process.env.PORT ? Number(process.env.PORT) : undefined;
    const defaultPort = typeof envPortValue === 'number' && Number.isFinite(envPortValue) && envPortValue > 0 ? envPortValue : 8080;
    const resolvedPort = port ?? defaultPort;
    server = await new Promise<http.Server>((resolve) => {
      const srv = app.listen(resolvedPort, () => {
        logger.info(`RuleLoom Orchestrator listening on port ${resolvedPort}`);
        resolve(srv);
      });
    });
    return server;
  };

  const close = async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      server = undefined;
    }
    await registry.closeAll();
    await runnerStore.disconnect().catch(() => undefined);
  };

  return {
    app,
    config,
    logger,
    registry,
    runnerStore,
    listen,
    close,
  };
}

export async function startOrchestrator(options: StartOptions): Promise<{ instance: OrchestratorInstance; server: http.Server }> {
  const instance = await createOrchestrator(options.configPath);
  const server = await instance.listen(options.portOverride);
  return { instance, server };
}

export { RunnerRegistry } from './registry.js';
export { createOrchestratorApi } from './api/app.js';

async function restorePersistedRunners(
  store: RunnerStore,
  registry: RunnerRegistry,
  logger: RuleLoomLogger,
): Promise<RunnerPersistenceRecord[]> {
  const records = await store.list();
  for (const record of records) {
    try {
      await registry.addRunner({
        id: record.id,
        configPath: record.configPath ?? undefined,
        configContent: record.configContent ?? undefined,
        basePath: record.basePath,
      });
    } catch (error) {
      logger.error?.(`Failed to restore runner "${record.id}":`, error);
    }
  }
  return records;
}

async function seedConfiguredRunners(
  config: OrchestratorConfig,
  store: RunnerStore,
  registry: RunnerRegistry,
  logger: RuleLoomLogger,
  existingRecords: RunnerPersistenceRecord[],
): Promise<void> {
  if (!config.runners?.length) {
    return;
  }

  const existingIds = new Set(existingRecords.map((record) => record.id));
  const existingPaths = new Set(
    existingRecords
      .map((record) => (record.configPath ? path.normalize(record.configPath) : undefined))
      .filter((value): value is string => Boolean(value)),
  );

  for (const entry of config.runners) {
    const normalizedPath = path.normalize(entry.config);
    if ((entry.name && existingIds.has(entry.name)) || existingPaths.has(normalizedPath)) {
      continue;
    }
    try {
      const runtimeRecord = await registry.addRunner({
        id: entry.name,
        configPath: normalizedPath,
        basePath: entry.basePath,
      });
      const inlineContent =
        runtimeRecord.configSource === 'inline' ? (await registry.getRunnerConfig(runtimeRecord.id)).content : null;
      await store.create({
        id: runtimeRecord.id,
        basePath: runtimeRecord.basePath,
        configPath: runtimeRecord.configSource === 'path' ? runtimeRecord.configPath : null,
        configContent: inlineContent,
      });
      existingIds.add(runtimeRecord.id);
      if (runtimeRecord.configSource === 'path') {
        existingPaths.add(path.normalize(runtimeRecord.configPath));
      }
    } catch (error) {
      logger.error?.(
        `Failed to bootstrap runner "${entry.name ?? entry.config}"`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
