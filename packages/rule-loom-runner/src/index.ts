import http from 'node:http';
import { EventEmitter } from 'node:events';
import RuleLoomEngine, { type ClosureDefinition, type FlowDefinition } from 'rule-loom-engine';
import { buildClosures } from './closures.js';
import { createLogger, type RuleLoomLogger } from 'rule-loom-lib';
import {
  readRunnerConfigFile,
  parseRunnerConfig,
  type RunnerConfig,
  type RunnerConfigWithMeta,
  type FlowConfig,
} from './config.js';
import {
  createPlaceholderHttpApp,
  type HttpInputApp,
  type RunnerScheduler,
  type RunnerInputConfig,
} from 'rule-loom-core/inputs';
import { initializeInputs } from './inputPlugins.js';
import { RunnerValidationError, validateRunnerConfig, type ValidationResult } from './validator.js';
import { parsePluginSpecs } from './pluginSpecs.js';
import { loadRuleLoomPlugins } from './pluginLoader.js';
import { getRegisteredClosures } from './closureRegistry.js';
import { applySecrets, resolveSecrets } from './secrets.js';

export interface RunnerInstance {
  engine: RuleLoomEngine;
  logger: RuleLoomLogger;
  config: RunnerConfig;
  configPath: string;
  app: HttpInputApp;
  listen: (port?: number, host?: string) => Promise<http.Server>;
  close: () => Promise<void>;
  scheduler?: RunnerScheduler;
  events: EventEmitter;
}

export interface StartOptions {
  configPath: string;
  portOverride?: number;
  host?: string;
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
  pluginClosures: ClosureDefinition[] = [],
): Promise<RuleLoomEngine> {
  const engine = new RuleLoomEngine();
  const allClosures = [...pluginClosures, ...closures];
  engine.registerClosures(allClosures);
  engine.registerFlows(normalizeFlows(flows));
  return engine;
}

export async function createRunner(configPath: string): Promise<RunnerInstance> {
  const { rawConfig, configDir, configPath: absolutePath } = await readRunnerConfigFile(configPath);
  const secrets = await resolveSecrets((rawConfig as any).secrets, configDir);
  const resolvedConfig = applySecrets(rawConfig, secrets);
  const preliminaryLogger = createLogger((rawConfig as any)?.logger?.level ?? 'info');
  const pluginSpecs = parsePluginSpecs((rawConfig as any)?.plugins ?? []);
  await loadRuleLoomPlugins(pluginSpecs, { logger: preliminaryLogger, configDir });

  const config = parseRunnerConfig(resolvedConfig);
  const logger = createLogger(config.logger?.level ?? 'info');
  const closures = await buildClosures(config.closures ?? [], configDir, logger);
  const pluginClosures = getRegisteredClosures();
  const validation = validateRunnerConfig(config, [...pluginClosures, ...closures]);
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

  const engine = await instantiateEngine(closures, config.flows, logger, pluginClosures);
  const events = new EventEmitter();
  const { httpApp, scheduler, cleanup } = await initializeInputs(
    config.inputs as RunnerInputConfig[],
    engine,
    logger,
    config.metadata,
    events,
  );
  const app = httpApp ?? createPlaceholderHttpApp(logger);

  let server: http.Server | undefined;

  const listen = async (port?: number, host = '127.0.0.1') => {
    const resolvedPort = port ?? Number(process.env.RULE_LOOM_PORT ?? 3000);
    if (server) {
      throw new Error('Runner is already listening.');
    }
    server = await new Promise<http.Server>((resolve, reject) => {
      const srv = app.listen(resolvedPort, host, () => {
        logger.info(`RuleLoom Runner listening on port ${resolvedPort}`);
        resolve(srv);
      });
      srv.on('error', reject);
    });
    return server;
  };

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
    await cleanup();
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
  const server = await instance.listen(options.portOverride, options.host);
  return { instance, server };
}

export async function validateConfig(configPath: string): Promise<ValidationResult> {
  const { rawConfig, configDir } = await readRunnerConfigFile(configPath);
  const secrets = await resolveSecrets((rawConfig as any).secrets, configDir);
  const resolvedConfig = applySecrets(rawConfig, secrets);
  const preliminaryLogger = createLogger((rawConfig as any)?.logger?.level ?? 'info');
  const pluginSpecs = parsePluginSpecs((rawConfig as any)?.plugins ?? []);
  await loadRuleLoomPlugins(pluginSpecs, { logger: preliminaryLogger, configDir });
  const config = parseRunnerConfig(resolvedConfig);
  const logger = createLogger(config.logger?.level ?? 'info');
  const closures = await buildClosures(config.closures ?? [], configDir, logger);
  const pluginClosures = getRegisteredClosures();
  return validateRunnerConfig(config, [...pluginClosures, ...closures]);
}

export { getHttpInput, getSchedulerInput } from './config.js';
export type { RunnerConfig, RunnerConfigWithMeta } from './config.js';
export type { RunnerScheduler, SchedulerJobConfig, SchedulerInputConfig, HttpInputConfig } from 'rule-loom-core/inputs';
export { RunnerValidationError } from './validator.js';
export type { ValidationIssue, ValidationResult } from './validator.js';
export type { PluginRegistrationContext, RuleLoomPlugin } from './pluginLoader.js';
