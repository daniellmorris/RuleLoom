import type RuleLoomEngine from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { InputPluginContext, BaseInputConfig } from './pluginApi.js';
import { getInputPlugins } from './pluginApi.js';
import type { EventEmitter } from 'node:events';

export interface InitializedInputs {
  services: Record<string, unknown>;
  cleanup: () => Promise<void>;
}

export async function initializeInputs(
  inputs: BaseInputConfig[],
  engine: RuleLoomEngine,
  logger: RuleLoomLogger,
  metadata: Record<string, unknown> | undefined,
  events: EventEmitter,
): Promise<InitializedInputs> {
  const cleanupFns: Array<() => Promise<void> | void> = [];
  const pluginMap = new Map(getInputPlugins().map((plugin) => [plugin.type, plugin]));
  const services: Record<string, unknown> = {};

  for (const input of inputs) {
    const plugin = pluginMap.get((input as any).type);
    if (!plugin) {
      throw new Error(`No input plugin registered for type "${(input as any).type}".`);
    }
    const context: InputPluginContext = { logger, engine, metadata, events };
    const result = await plugin.initialize(input as any, context);
    if (result?.services) {
      Object.assign(services, result.services);
    }
    if (result?.cleanup) {
      cleanupFns.push(result.cleanup);
    }
  }

  return {
    services,
    cleanup: async () => {
      for (const cleanup of cleanupFns.reverse()) {
        await Promise.resolve(cleanup()).catch(() => undefined);
      }
    },
  };
}
