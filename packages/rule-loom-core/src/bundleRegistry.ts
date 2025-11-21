import type { ClosureDefinition } from 'rule-loom-engine';

export type BundleFactory = (options?: Record<string, unknown>) => ClosureDefinition[];

const bundleFactories = new Map<string, BundleFactory>();

export function registerBundlePreset(name: string, factory: BundleFactory) {
  if (bundleFactories.has(name)) {
    throw new Error(`Bundle preset "${name}" already registered`);
  }
  bundleFactories.set(name, factory);
}

export function listBundlePresets(): string[] {
  return Array.from(bundleFactories.keys());
}

export function getBundleFactory(name: string): BundleFactory | undefined {
  return bundleFactories.get(name);
}

export function createBundleClosures(preset: string, options?: Record<string, unknown>): ClosureDefinition[] {
  const factory = getBundleFactory(preset);
  if (!factory) {
    const available = listBundlePresets();
    const suggestion = available.length ? ` Available presets: ${available.join(', ')}` : '';
    throw new Error(`Unknown closure bundle preset "${preset}".${suggestion}`);
  }
  return factory(options);
}

// Used by tests to reset global state.
export function resetBundleRegistry() {
  bundleFactories.clear();
}
