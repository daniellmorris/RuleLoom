import type { ClosureDefinition } from 'rule-loom-engine';
import { createCoreClosures } from './closures.js';
import { createHttpClosures, type HttpClosureOptions } from './http.js';

type BundleFactory = (options?: Record<string, unknown>) => ClosureDefinition[];

const bundleFactories: Record<string, BundleFactory> = {
  core: () => createCoreClosures(),
  http: (options) => createHttpClosures(options as HttpClosureOptions),
};

export function listBundlePresets(): string[] {
  return Object.keys(bundleFactories);
}

export function createBundleClosures(preset: string, options?: Record<string, unknown>): ClosureDefinition[] {
  const factory = bundleFactories[preset];
  if (!factory) {
    const available = listBundlePresets();
    const suggestion = available.length ? ` Available presets: ${available.join(', ')}` : '';
    throw new Error(`Unknown closure bundle preset "${preset}".${suggestion}`);
  }
  return factory(options);
}
