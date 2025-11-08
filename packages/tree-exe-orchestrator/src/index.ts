import http from 'node:http';
import express from 'express';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from 'tree-exe-lib';
import { loadOrchestratorConfig, type OrchestratorConfig } from './config.js';
import { RunnerRegistry } from './registry.js';
import { createOrchestratorApi } from './api/app.js';

export interface OrchestratorInstance {
  app: express.Express;
  config: OrchestratorConfig;
  logger: ReturnType<typeof createLogger>;
  registry: RunnerRegistry;
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
  const metricsRegistry = registry.getMetricsRegistry();

  app.get('/metrics', (_req, res) => {
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.send(metricsRegistry.render());
  });

  for (const entry of config.runners) {
    await registry.addRunner({
      id: entry.name,
      configPath: entry.config,
      basePath: entry.basePath,
    });
  }

  const apiRouter = await createOrchestratorApi(registry);
  app.use('/api', apiRouter);

  const uiDistPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../tree-exe-orchestrator-ui/dist');
  if (fs.existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/__treeexe')) return next();
      res.sendFile(path.join(uiDistPath, 'index.html'));
    });
  }

  const dispatcher = registry.createDispatcher();
  app.use(dispatcher);

  app.get('/__treeexe/health', (_req, res) => {
    res.json({ status: 'ok', runners: registry.list().length });
  });

  let server: http.Server | undefined;

  const listen = async (port?: number) => {
    if (server) {
      throw new Error('Orchestrator already listening');
    }
    const resolvedPort = port ?? config.server.port;
    server = await new Promise<http.Server>((resolve) => {
      const srv = app.listen(resolvedPort, () => {
        logger.info(`TreeExe Orchestrator listening on port ${resolvedPort}`);
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
  };

  return {
    app,
    config,
    logger,
    registry,
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
