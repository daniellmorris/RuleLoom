import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { type ClosureDefinition, type ClosureSignature } from 'rule-loom-engine';
import type { InputPlugin } from 'rule-loom-core/inputs';
import type { BaseInputConfig } from 'rule-loom-core/inputs/types';
import type { PluginRegistrationContext, RuleLoomPlugin } from './pluginLoader.js';

export interface RuleLoomManifestClosure {
  name: string;
  description?: string;
  signature?: ClosureSignature;
  implicitFields?: string[];
  metadata?: Record<string, unknown>;
}

export interface RuleLoomManifestInputPlugin {
  type: string;
  description?: string;
  configParameters?: any[];
  triggerParameters?: any[];
}

export interface RuleLoomManifest {
  version: 1;
  name: string;
  pluginVersion?: string;
  description?: string;
  entry: string;
  closures: RuleLoomManifestClosure[];
  inputs?: RuleLoomManifestInputPlugin[];
  metadata?: Record<string, unknown>;
}

interface GenerateOptions {
  pluginDir: string;
  outputPath?: string;
}

function createSilentLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  } as PluginRegistrationContext['logger'];
}

function sanitizeClosure(closure: ClosureDefinition): RuleLoomManifestClosure {
  const { name, description, signature, implicitFields, metadata } = closure;
  return { name, description, signature, implicitFields, metadata };
}

function sanitizeInputPlugin(plugin: InputPlugin<BaseInputConfig>): RuleLoomManifestInputPlugin {
  return {
    type: plugin.type,
    description: (plugin as any).description,
    configParameters: (plugin as any).configParameters,
    triggerParameters: (plugin as any).triggerParameters,
  };
}

async function readPackageJson(pluginDir: string) {
  const pkgPath = path.join(pluginDir, 'package.json');
  const content = await fs.readFile(pkgPath, 'utf8');
  return JSON.parse(content) as { name?: string; version?: string; description?: string; main?: string };
}

async function resolveEntryPath(pluginDir: string, pkgMain?: string) {
  const entry = pkgMain && pkgMain.trim().length ? pkgMain : 'dist/index.js';
  const absolute = path.resolve(pluginDir, entry);
  return { entry, absolute };
}

async function collectPluginExports(entryPath: string) {
  const module = await import(pathToFileURL(entryPath).href);
  const plugin: RuleLoomPlugin | undefined = module.default ?? module.plugin ?? module;
  if (!plugin || typeof plugin.register !== 'function') {
    throw new Error('Plugin module does not export a { register } function.');
  }
  return plugin;
}

export async function generateManifest(options: GenerateOptions): Promise<{ manifest: RuleLoomManifest; manifestPath: string }> {
  const pluginDir = path.resolve(options.pluginDir);
  const pkg = await readPackageJson(pluginDir);
  const { entry, absolute } = await resolveEntryPath(pluginDir, pkg.main);

  const manifest: RuleLoomManifest = {
    version: 1,
    name: pkg.name ?? path.basename(pluginDir),
    pluginVersion: pkg.version,
    description: pkg.description,
    entry,
    closures: [],
  };

  let generationWarning: string | undefined;

  const manifestPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.join(pluginDir, 'ruleloom.manifest.yaml');

  const entryExists = await fs
    .stat(absolute)
    .then((s) => s.isFile())
    .catch(() => false);

  if (entryExists) {
    const closures: ClosureDefinition[] = [];
    const inputs: InputPlugin<BaseInputConfig>[] = [];
    try {
      const plugin = await collectPluginExports(absolute);

      const context: PluginRegistrationContext = {
        registerClosure: (closure) => closures.push(closure),
        registerInputPlugin: (plugin) => inputs.push(plugin as unknown as InputPlugin<BaseInputConfig>),
        logger: createSilentLogger(),
      } as PluginRegistrationContext;

      await plugin.register?.(context);
      manifest.closures = closures.map(sanitizeClosure);
      if (inputs.length) {
        manifest.inputs = inputs.map(sanitizeInputPlugin);
      }
    } catch (error: unknown) {
      generationWarning = (error as Error).message;
    }
  }

  if (generationWarning) {
    manifest.metadata = {
      ...(manifest.metadata ?? {}),
      manifestGenerationWarning: generationWarning,
    };
  }

  const yamlText = yaml.dump(manifest, { noRefs: true, lineWidth: 120 });
  await fs.writeFile(manifestPath, yamlText, 'utf8');

  return { manifest, manifestPath };
}

export async function readManifest(manifestPath: string): Promise<RuleLoomManifest> {
  const raw = await fs.readFile(manifestPath, 'utf8');
  return yaml.load(raw) as RuleLoomManifest;
}
