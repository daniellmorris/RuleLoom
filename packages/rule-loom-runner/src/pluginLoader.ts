import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import type { RuleLoomLogger } from 'rule-loom-lib';
import { registerInputPlugin } from 'rule-loom-inputs';
import { corePlugin } from 'rule-loom-core';
import type { ClosureDefinition } from 'rule-loom-engine';
import { registerClosure } from './closureRegistry.js';
import type { PluginSpec } from './pluginSpecs.js';

const execFileAsync = promisify(execFile);
const loadedPlugins = new Set<string>();

export interface RuleLoomPlugin {
  name?: string;
  version?: string;
  register?: (ctx: PluginRegistrationContext) => Promise<void> | void;
}

export interface PluginRegistrationContext {
  registerInputPlugin: typeof registerInputPlugin;
  registerClosure: (closure: ClosureDefinition) => void;
  logger: RuleLoomLogger;
}

export interface PluginLoaderOptions {
  configDir: string;
  cacheDir?: string;
  logger: RuleLoomLogger;
}

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.rule-loom', 'plugins');

export async function loadRuleLoomPlugins(specs: PluginSpec[], options: PluginLoaderOptions) {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  await fs.mkdir(cacheDir, { recursive: true }).catch(() => undefined);

  // Always load built-in core plugin first so core/http closures are available without config entries.
  if (!loadedPlugins.has('builtin:core-plugin')) {
    await corePlugin.register({
      registerInputPlugin,
      registerClosure,
      logger: options.logger,
    } as PluginRegistrationContext);
    loadedPlugins.add('builtin:core-plugin');
  }

  if (!specs.length) return;

  for (const spec of specs) {
    const modulePath = await resolvePluginModule(spec, { ...options, cacheDir });
    if (loadedPlugins.has(modulePath)) {
      options.logger.debug?.(`Plugin at ${modulePath} already loaded; skipping.`);
      continue;
    }
    const pluginModule = await import(modulePath);
    const plugin: RuleLoomPlugin | undefined = pluginModule.default ?? pluginModule.plugin ?? pluginModule;
    if (!plugin || typeof plugin.register !== 'function') {
      throw new Error(`Plugin loaded from ${modulePath} does not export a { register } function.`);
    }

    const name = plugin.name ?? specName(spec);
    options.logger.info?.(`Registering plugin ${name ?? 'unknown'}${plugin.version ? `@${plugin.version}` : ''}`);
    await plugin.register({
      registerInputPlugin,
      registerClosure,
      logger: options.logger,
    });
    loadedPlugins.add(modulePath);
  }
}

export function resetLoadedPlugins() {
  loadedPlugins.clear();
}

function specName(spec: PluginSpec): string | undefined {
  if (spec.source === 'file') return spec.name ?? path.basename(spec.path);
  if (spec.source === 'github') return spec.name ?? spec.repo;
  return spec.name;
}

interface ResolveOptions extends PluginLoaderOptions {
  cacheDir: string;
}

async function resolvePluginModule(spec: PluginSpec, options: ResolveOptions): Promise<string> {
  if (spec.source === 'file') {
    const p = spec.path.startsWith('file:') ? spec.path.replace(/^file:/, '') : spec.path;
    const resolved = path.isAbsolute(p) ? p : path.resolve(options.configDir, p);
    return pathToFileURL(resolved).href;
  }

  if (spec.source === 'npm' || spec.source === 'store') {
    // Attempt native resolution; external download would require package manager.
    return spec.name;
  }

  // github source
  const cacheKey = `${spec.repo.replace(/[\\/]/g, '_')}@${spec.ref}`;
  const targetDir = path.join(options.cacheDir, cacheKey);
  const entryFile = spec.path ? path.join(targetDir, spec.path) : targetDir;

  const exists = await fs
    .stat(entryFile)
    .then((s) => s.isDirectory() || s.isFile())
    .catch(() => false);
  if (!exists) {
    await downloadGithubRepo(spec, targetDir, options);
  }

  return pathToFileURL(entryFile).href;
}

async function downloadGithubRepo(spec: Extract<PluginSpec, { source: 'github' }>, targetDir: string, options: ResolveOptions) {
  await fs.mkdir(targetDir, { recursive: true });
  const tarballUrl = `https://codeload.github.com/${spec.repo}/tar.gz/${spec.ref}`;
  const tarFile = path.join(targetDir, 'plugin.tgz');

  options.logger.info?.(`Downloading GitHub plugin ${spec.repo}@${spec.ref}`);
  await new Promise<void>((resolve, reject) => {
    const file = createWriteStream(tarFile);
    https
      .get(tarballUrl, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Failed to download plugin tarball: ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => reject(err));
  });

  if (spec.integrity) {
    const hash = createHash('sha256');
    const data = await fs.readFile(tarFile);
    hash.update(data);
    const digest = `sha256-${hash.digest('hex')}`;
    if (digest !== spec.integrity) {
      throw new Error(`Integrity mismatch for ${spec.repo}@${spec.ref}. Expected ${spec.integrity} got ${digest}`);
    }
  }

  // Extract tarball (requires system tar).
  await execFileAsync('tar', ['-xzf', tarFile, '--strip-components=1', '-C', targetDir]);
}
