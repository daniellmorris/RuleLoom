import http from 'node:http';
import _ from 'lodash';
import Bree from 'bree';
import TreeExeEngine, { type FlowDefinition, type ExecutionResult } from 'tree-exe-engine';
import { buildClosures } from './closures.js';
import { createRunnerApp } from './http-server.js';
import { createLogger, type TreeExeLogger } from 'tree-exe-lib';
import {
  loadRunnerConfig,
  type RunnerConfig,
  type RunnerConfigWithMeta,
  type ClosureConfig,
  type FlowConfig,
  type SchedulerJobConfig,
} from './config.js';

export interface RunnerInstance {
  engine: TreeExeEngine;
  logger: TreeExeLogger;
  config: RunnerConfig;
  configPath: string;
  app: ReturnType<typeof createRunnerApp>;
  listen: (port?: number) => Promise<http.Server>;
  close: () => Promise<void>;
  scheduler?: RunnerScheduler;
}

export interface StartOptions {
  configPath: string;
  portOverride?: number;
}

interface SchedulerJobState {
  runs: number;
  lastRun?: Date;
  lastResult?: ExecutionResult;
  lastError?: unknown;
}

interface RunnerScheduler {
  controller: Bree;
  jobStates: Map<string, SchedulerJobState>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
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

  const schedulerJobs = (config.scheduler?.jobs ?? []).filter((job) => job.enabled !== false);
  const schedulerJobStates = new Map<string, SchedulerJobState>();
  let schedulerController: Bree | undefined;

  if (schedulerJobs.length > 0) {
    const jobDefinitions = schedulerJobs.map((job) => {
      const jobCode = `(() => {
  const { parentPort, workerData } = require('node:worker_threads');
  const jobName = (workerData && workerData.name) || ${JSON.stringify(job.name)};
  if (parentPort) {
    parentPort.postMessage({ type: 'run-flow', name: jobName });
    parentPort.postMessage('done');
  }
})()`;
      const definition: any = {
        name: job.name,
        path: jobCode,
        worker: {
          eval: true,
          workerData: { name: job.name },
        },
      };
      if (job.interval !== undefined) definition.interval = job.interval;
      if (job.cron !== undefined) definition.cron = job.cron;
      if (job.timeout !== undefined) definition.timeout = job.timeout;
      return definition;
    });

    const jobConfigByName = new Map<string, SchedulerJobConfig>(
      schedulerJobs.map((job) => [job.name, job]),
    );

    const breeLogger =
      logger && logger.info
        ? {
            info: logger.info.bind(logger),
            warn: logger.warn.bind(logger),
            error: logger.error.bind(logger),
          }
        : false;

    schedulerController = new Bree({
      logger: breeLogger,
      root: false,
      doRootCheck: false,
      jobs: jobDefinitions,
      workerMessageHandler: ({ name, message }) => {
        if (message && typeof message === 'object' && message.type === 'run-flow') {
          const jobConfig = jobConfigByName.get(name);
          if (!jobConfig) return;
          const initialState = jobConfig.initialState ? _.cloneDeep(jobConfig.initialState) : {};
          const runtimeContext = {
            ...(jobConfig.runtime ? _.cloneDeep(jobConfig.runtime) : {}),
            scheduler: {
              job: jobConfig.name,
              triggeredAt: new Date().toISOString(),
            },
          };
          engine
            .execute(jobConfig.flow, initialState, runtimeContext)
            .then((result) => {
              const entry = schedulerJobStates.get(name) ?? { runs: 0 };
              entry.runs += 1;
              entry.lastRun = new Date();
              entry.lastResult = result;
              entry.lastError = undefined;
              schedulerJobStates.set(name, entry);
            })
            .catch((error) => {
              const entry = schedulerJobStates.get(name) ?? { runs: 0 };
              entry.lastRun = new Date();
              entry.lastError = error;
              schedulerJobStates.set(name, entry);
              logger.error?.(`Scheduler job "${name}" failed`, error);
            });
        }
      },
    });

    await schedulerController.start();
  }

  const close = async () => {
    if (schedulerController) {
      await schedulerController.stop();
      schedulerController = undefined;
    }
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

  const scheduler: RunnerScheduler | undefined = schedulerController
    ? {
        controller: schedulerController,
        jobStates: schedulerJobStates,
        start: () => schedulerController!.start(),
        stop: () => schedulerController!.stop(),
      }
    : undefined;

  return {
    engine,
    logger,
    config,
    configPath: absolutePath,
    app,
    listen,
    close,
    scheduler,
  };
}

export async function startRunner(options: StartOptions): Promise<{ instance: RunnerInstance; server: http.Server }> {
  const instance = await createRunner(options.configPath);
  const server = await instance.listen(options.portOverride);
  return { instance, server };
}

export type { RunnerConfig, RunnerConfigWithMeta, SchedulerConfig, SchedulerJobConfig } from './config.js';
export type { RunnerScheduler };
