import type RuleLoomEngine from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { HttpInputApp, InputPluginContext, RunnerInputConfig, RunnerScheduler } from 'rule-loom-inputs';
import { getInputPlugins } from 'rule-loom-inputs';
import type { EventEmitter } from 'node:events';

export interface InitializedInputs {
  httpApp?: HttpInputApp;
  scheduler?: RunnerScheduler;
  cleanup: () => Promise<void>;
}

export async function initializeInputs(
  inputs: RunnerInputConfig[],
  engine: RuleLoomEngine,
  logger: RuleLoomLogger,
  metadata: Record<string, unknown> | undefined,
  events: EventEmitter,
): Promise<InitializedInputs> {
  const cleanupFns: Array<() => Promise<void> | void> = [];
  const pluginMap = new Map(getInputPlugins().map((plugin) => [plugin.type, plugin]));
  let httpApp: HttpInputApp | undefined;
  let scheduler: RunnerScheduler | undefined;

  for (const input of inputs) {
    const plugin = pluginMap.get((input as any).type);
    if (!plugin) {
      throw new Error(`No input plugin registered for type "${(input as any).type}".`);
    }
    const context: InputPluginContext = { logger, engine, metadata, events };
    const result = await plugin.initialize(input as any, context);
    if (result?.http) {
      if (httpApp) {
        throw new Error('Only a single HTTP input is currently supported.');
      }
      httpApp = result.http.app;
    }
    if (result?.scheduler) {
      if (scheduler) {
        throw new Error('Only a single scheduler input is currently supported.');
      }
      scheduler = result.scheduler;
    }
    if (result?.cleanup) {
      cleanupFns.push(result.cleanup);
    }
  }

  return {
    httpApp,
    scheduler,
    cleanup: async () => {
      for (const cleanup of cleanupFns.reverse()) {
        await Promise.resolve(cleanup()).catch(() => undefined);
      }
    },
  };
}
