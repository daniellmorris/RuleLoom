import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import yaml from 'js-yaml';
import { registerInputPlugin, resetInputPlugins } from 'rule-loom-core/inputs';
import { corePlugin } from 'rule-loom-core';
import { registerClosure } from './closureRegistry.js';
import { parseClosureConfigs } from './config.js';
import { buildClosures } from './closures.js';
const execFileAsync = promisify(execFile);
const loadedPlugins = new Set();
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.rule-loom', 'plugins');
export async function loadRuleLoomPlugins(specs, options) {
    const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
    await fs.mkdir(cacheDir, { recursive: true }).catch(() => undefined);
    // Always load built-in core plugin first so core/http closures are available without config entries.
    if (!loadedPlugins.has('builtin:core-plugin')) {
        await corePlugin.register({
            registerInputPlugin,
            registerClosure,
            logger: options.logger,
        });
        loadedPlugins.add('builtin:core-plugin');
    }
    if (!specs.length)
        return;
    for (const spec of specs) {
        const modulePath = await resolvePluginModule(spec, { ...options, cacheDir });
        if (loadedPlugins.has(modulePath)) {
            options.logger.debug?.(`Plugin at ${modulePath} already loaded; skipping.`);
            continue;
        }
        if (spec.source !== 'config') {
            await requireManifest(modulePath);
        }
        if (spec.source === 'config') {
            const sourcePath = fileURLToPath(new URL(modulePath));
            const rawFile = await fs.readFile(sourcePath, 'utf8');
            const parsed = (yaml.load(rawFile) ?? {});
            const closureEntries = Array.isArray(parsed) ? parsed : parsed.closures ?? [];
            const closureConfigs = parseClosureConfigs(closureEntries);
            const closures = await buildClosures(closureConfigs, path.dirname(sourcePath), options.logger);
            closures.forEach((c) => registerClosure(c));
            loadedPlugins.add(modulePath);
            continue;
        }
        const pluginModule = await import(modulePath);
        const plugin = pluginModule.default ?? pluginModule.plugin ?? pluginModule;
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
    resetInputPlugins();
}
function specName(spec) {
    if (spec.source === 'file')
        return spec.name ?? path.basename(spec.path);
    if (spec.source === 'config')
        return spec.name ?? path.basename(spec.path);
    if (spec.source === 'github')
        return spec.name ?? spec.repo;
    return spec.name;
}
async function resolvePluginModule(spec, options) {
    if (spec.source === 'config') {
        const resolved = spec.path.startsWith('file:') ? spec.path.replace(/^file:/, '') : spec.path;
        const absolute = path.isAbsolute(resolved) ? resolved : path.resolve(options.configDir, resolved);
        return pathToFileURL(absolute).href;
    }
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
async function requireManifest(modulePath) {
    const manifestPath = await locateManifest(modulePath);
    const exists = manifestPath
        ? await fs
            .stat(manifestPath)
            .then((s) => s.isFile())
            .catch(() => false)
        : false;
    if (!exists) {
        throw new Error(`Missing ruleloom.manifest.yaml for plugin (${modulePath}). Generate one with "ruleloom-runner manifest <plugin-dir>".`);
    }
}
async function locateManifest(resolvedModulePath) {
    const require = createRequire(import.meta.url);
    if (resolvedModulePath.startsWith('file:')) {
        const fsPath = fileURLToPath(resolvedModulePath);
        let current = path.extname(fsPath) ? path.dirname(fsPath) : fsPath;
        while (true) {
            const candidate = path.join(current, 'ruleloom.manifest.yaml');
            // eslint-disable-next-line no-await-in-loop
            const exists = await fs
                .stat(candidate)
                .then((s) => s.isFile())
                .catch(() => false);
            if (exists)
                return candidate;
            const parent = path.dirname(current);
            if (parent === current)
                break;
            current = parent;
        }
        return undefined;
    }
    // Attempt to resolve relative to module name (npm/store/github).
    try {
        return require.resolve(path.join(resolvedModulePath, 'ruleloom.manifest.yaml'));
    }
    catch (error) {
        // ignore
    }
    try {
        return require.resolve('ruleloom.manifest.yaml', { paths: [resolvedModulePath] });
    }
    catch (error) {
        return undefined;
    }
}
async function downloadGithubRepo(spec, targetDir, options) {
    await fs.mkdir(targetDir, { recursive: true });
    const tarballUrl = `https://codeload.github.com/${spec.repo}/tar.gz/${spec.ref}`;
    const tarFile = path.join(targetDir, 'plugin.tgz');
    options.logger.info?.(`Downloading GitHub plugin ${spec.repo}@${spec.ref}`);
    await new Promise((resolve, reject) => {
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
//# sourceMappingURL=pluginLoader.js.map