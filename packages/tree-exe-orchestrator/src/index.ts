import http from 'node:http';
import express from 'express';
import morgan from 'morgan';
import { createRunner, type RunnerInstance } from 'tree-exe-runner';
import { createLogger } from 'tree-exe-lib';
import { loadOrchestratorConfig, type OrchestratorConfig } from './config.js';

export interface OrchestratedRunner {
  entry: OrchestratorConfig['runners'][number];
  instance: RunnerInstance;
}

export interface OrchestratorInstance {
  app: express.Express;
  config: OrchestratorConfig;
  logger: ReturnType<typeof createLogger>;
  runners: OrchestratedRunner[];
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

  const runners: OrchestratedRunner[] = [];
  for (const entry of config.runners) {
    const instance = await createRunner(entry.config);
    const mountPath = entry.basePath ?? instance.config.server.http.basePath ?? '/';
    app.use(mountPath, instance.app);
    logger.info(`Mounted runner ${entry.name ?? instance.configPath} at ${mountPath}`);
    runners.push({ entry, instance });
  }

  app.get('/__treeexe/health', (_req, res) => {
    res.json({ status: 'ok', runners: runners.length });
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
    await Promise.all(runners.map((runner) => runner.instance.close().catch(() => undefined)));
  };

  return {
    app,
    config,
    logger,
    runners,
    listen,
    close,
  };
}

export async function startOrchestrator(options: StartOptions): Promise<{ instance: OrchestratorInstance; server: http.Server }> {
  const instance = await createOrchestrator(options.configPath);
  const server = await instance.listen(options.portOverride);
  return { instance, server };
}
