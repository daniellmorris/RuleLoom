import { z } from 'zod';
import type RuleLoomEngine from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { EventEmitter } from 'node:events';

export interface BaseInputConfig {
  type: string;
  id?: string;
  config?: Record<string, unknown>;
}

export interface InputPluginContext {
  engine: RuleLoomEngine;
  logger: RuleLoomLogger;
  metadata?: Record<string, unknown>;
  events: EventEmitter;
}

export interface InputPluginResult {
  cleanup?: () => void | Promise<void>;
  services?: Record<string, unknown>;
}

export interface InputPlugin<Config extends BaseInputConfig = BaseInputConfig> {
  type: Config['type'];
  schema: any; // z.ZodType but keep loose to avoid circular deps in plain JS build
  configParameters?: Array<{ name: string; type?: string; required?: boolean; description?: string; enum?: string[]; properties?: any; items?: any }>;
  triggerParameters?: Array<{ name: string; type?: string; required?: boolean; description?: string; enum?: string[]; properties?: any; items?: any }>;
  initialize: (config: Config, context: InputPluginContext) => Promise<InputPluginResult | void> | InputPluginResult | void;
}

const plugins: InputPlugin<BaseInputConfig>[] = [];

export function resetInputPlugins() {
  plugins.length = 0;
}

export function registerInputPlugin<Config extends BaseInputConfig>(plugin: InputPlugin<Config>) {
  if (plugins.some((existing) => existing.type === plugin.type)) {
    throw new Error(`Input plugin with type "${plugin.type}" already registered`);
  }
  plugins.push(plugin as unknown as InputPlugin<BaseInputConfig>);
}

export function getInputPlugins(): InputPlugin<BaseInputConfig>[] {
  return [...plugins];
}

export function getInputSchema() {
  if (plugins.length === 0) {
    return z.never();
  }
  const missingSchema = plugins.filter((plugin) => !plugin.schema);
  if (missingSchema.length) {
    const names = missingSchema.map((p) => p.type ?? '<unknown>').join(', ');
    throw new Error(`Input plugins missing schema: ${names}`);
  }

  // Normalize schemas to the local zod instance so unions work even if
  // plugins were built with their own bundled zod.
  const normalized = plugins.map((plugin) => {
    const base = z.object({ type: z.literal(plugin.type) });
    if (!(plugin as any).schema?._def) {
      console.warn('Input plugin schema missing _def', plugin.type, plugin.schema);
    }
    return base.and(plugin.schema as any);
  });

  if (normalized.length === 1) {
    return normalized[0];
  }

  return z.union(normalized as any);
}
