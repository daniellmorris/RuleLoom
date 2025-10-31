import http from 'node:http';
import TreeExeEngine, { type FlowDefinition } from 'tree-exe-engine';
import { buildClosures } from './closures.js';
import { createRunnerApp } from './http-server.js';
import { createLogger, type TreeExeLogger } from 'tree-exe-lib';
import {
  loadRunnerConfig,
  type RunnerConfig,
  type RunnerConfigWithMeta,
  type ClosureConfig,
  type FlowConfig,
} from './config.js';

export interface RunnerInstance {
  engine: TreeExeEngine;
  logger: TreeExeLogger;
  config: RunnerConfig;
  configPath: string;
  app: ReturnType<typeof createRunnerApp>;
  listen: (port?: number) => Promise<http.Server>;
  close: () => Promise<void>;
}

export interface StartOptions {
  configPath: string;
  portOverride?: number;
}

function normalizeFlows(flows: FlowConfig[]): FlowDefinition[] {
  return flows.map((flow) => ({
    name: flow.name,
    description: flow.description,
    steps: flow.steps,
  }));
}

async function instantiateEngine(
  closureConfigs: ClosureConfig[],
  flows: FlowConfig[],
  configDir: string,
  logger: TreeExeLogger,
): Promise<TreeExeEngine> {
  const closures = await buildClosures(closureConfigs, configDir, logger);
  const engine = new TreeExeEngine();
  engine.registerClosures(closures);
  engine.registerFlows(normalizeFlows(flows));
  return engine;
}

export async function createRunner(configPath: string): Promise<RunnerInstance> {
  const { config, configDir, configPath: absolutePath } = await loadRunnerConfig(configPath);
  const logger = createLogger(config.logger?.level ?? 'info');

  const engine = await instantiateEngine(config.closures ?? [], config.flows, configDir, logger);
  const app = createRunnerApp(engine, config, logger);

  let server: http.Server | undefined;

  const listen = async (port?: number) => {
    const resolvedPort = port ?? config.server.http.port;
    if (server) {
      throw new Error('Runner is already listening.');
    }
    server = await new Promise<http.Server>((resolve) => {
      const srv = app.listen(resolvedPort, () => {
        logger.info(`TreeExe Runner listening on port ${resolvedPort}`);
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
  };

  return {
    engine,
    logger,
    config,
    configPath: absolutePath,
    app,
    listen,
    close,
  };
}

export async function startRunner(options: StartOptions): Promise<{ instance: RunnerInstance; server: http.Server }> {
  const instance = await createRunner(options.configPath);
  const server = await instance.listen(options.portOverride);
  return { instance, server };
}

export type { RunnerConfig, RunnerConfigWithMeta } from './config.js';
