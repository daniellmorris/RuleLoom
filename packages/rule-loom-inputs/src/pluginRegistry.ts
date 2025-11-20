import { z } from 'zod';
import type { BaseInputConfig, InputPlugin } from './types.js';

const plugins: InputPlugin<BaseInputConfig>[] = [];

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
  if (plugins.length === 1) {
    return plugins[0].schema;
  }
  return z.discriminatedUnion('type', plugins.map((plugin) => plugin.schema) as any);
}
