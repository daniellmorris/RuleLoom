import http from 'node:http';
import { EventEmitter } from 'node:events';
import RuleLoomEngine, { type ClosureDefinition, type FlowDefinition } from 'rule-loom-engine';
import { buildClosures } from './closures.js';
import { createLogger, type RuleLoomLogger } from 'rule-loom-lib';
import {
  loadRunnerConfig,
  getHttpInput,
  getSchedulerInput,
  type RunnerConfig,
  type RunnerConfigWithMeta,
  type FlowConfig,
} from './config.js';
import {
  createHttpInputApp,
  createPlaceholderHttpApp,
  createSchedulerInput,
  type HttpInputApp,
  type RunnerScheduler,
} from 'rule-loom-inputs';
import { RunnerValidationError, validateRunnerConfig, type ValidationResult } from './validator.js';

export interface RunnerInstance {
  engine: RuleLoomEngine;
  logger: RuleLoomLogger;
  config: RunnerConfig;
  configPath: string;
  app: HttpInputApp;
  listen: (port?: number) => Promise<http.Server>;
  close: () => Promise<void>;
  scheduler?: RunnerScheduler;
  events: EventEmitter;
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
  closures: ClosureDefinition[],
  flows: FlowConfig[],
  _logger: RuleLoomLogger,
): Promise<RuleLoomEngine> {
  const engine = new RuleLoomEngine();
  engine.registerClosures(closures);
  engine.registerFlows(normalizeFlows(flows));
  return engine;
}

export async function createRunner(configPath: string): Promise<RunnerInstance> {
  const { config, configDir, configPath: absolutePath } = await loadRunnerConfig(configPath);
  const logger = createLogger(config.logger?.level ?? 'info');
  const closures = await buildClosures(config.closures ?? [], configDir, logger);
  const validation = validateRunnerConfig(config, closures);
  if (!validation.valid) {
    for (const issue of validation.issues) {
      logger.error?.(
        `Validation issue [${issue.level}] ${issue.message}${issue.path ? ` @ ${issue.path}` : ''}${
          issue.flow ? ` (flow: ${issue.flow})` : ''
        }`,
      );
    }
    throw new RunnerValidationError(validation);
  }

  const engine = await instantiateEngine(closures, config.flows, logger);
  const httpInput = getHttpInput(config);
  const app = httpInput
    ? createHttpInputApp(engine, httpInput, { logger, metadata: config.metadata })
    : createPlaceholderHttpApp(logger);

  let server: http.Server | undefined;

  const listen = async (port?: number) => {
    const resolvedPort = port ?? 3000;
    if (server) {
      throw new Error('Runner is already listening.');
    }
    server = await new Promise<http.Server>((resolve) => {
      const srv = app.listen(resolvedPort, () => {
        logger.info(`RuleLoom Runner listening on port ${resolvedPort}`);
        resolve(srv);
      });
    });
    return server;
  };

  const events = new EventEmitter();
  const schedulerInput = getSchedulerInput(config);
  const scheduler = schedulerInput
    ? await createSchedulerInput(schedulerInput, {
        engine,
        logger,
        events,
      })
    : undefined;

  const close = async () => {
    if (scheduler) {
      await scheduler.stop();
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

  return {
    engine,
    logger,
    config,
    configPath: absolutePath,
    app,
    listen,
    close,
    scheduler,
    events,
  };
}

export async function startRunner(options: StartOptions): Promise<{ instance: RunnerInstance; server: http.Server }> {
  const instance = await createRunner(options.configPath);
  const server = await instance.listen(options.portOverride);
  return { instance, server };
}

export async function validateConfig(configPath: string): Promise<ValidationResult> {
  const { config, configDir } = await loadRunnerConfig(configPath);
  const logger = createLogger(config.logger?.level ?? 'info');
  const closures = await buildClosures(config.closures ?? [], configDir, logger);
  return validateRunnerConfig(config, closures);
}

export { getHttpInput, getSchedulerInput } from './config.js';
export type { RunnerConfig, RunnerConfigWithMeta } from './config.js';
export type { RunnerScheduler, SchedulerJobConfig, SchedulerInputConfig, HttpInputConfig } from 'rule-loom-inputs';
export { RunnerValidationError } from './validator.js';
export type { ValidationIssue, ValidationResult } from './validator.js';
