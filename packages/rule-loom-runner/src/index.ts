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
import { type BaseInputConfig } from './pluginApi.js';
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
  close: () => Promise<void>;
  services: Record<string, unknown>;
  events: EventEmitter;
}

export interface StartOptions {
  configPath: string;
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
  const { services, cleanup } = await initializeInputs(
    config.inputs as BaseInputConfig[],
    engine,
    logger,
    config.metadata,
    events,
  );

  const close = async () => {
    await cleanup();
  };

  return {
    engine,
    logger,
    config,
    configPath: absolutePath,
    services,
    close,
    events,
  };
}

export async function startRunner(options: StartOptions): Promise<{ instance: RunnerInstance }> {
  const instance = await createRunner(options.configPath);
  return { instance };
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

export type { RunnerConfig, RunnerConfigWithMeta } from './config.js';
export { RunnerValidationError } from './validator.js';
export type { ValidationIssue, ValidationResult } from './validator.js';
export type { PluginRegistrationContext, RuleLoomPlugin } from './pluginLoader.js';
export { generateManifest, readManifest, type RuleLoomManifest } from './manifest.js';
