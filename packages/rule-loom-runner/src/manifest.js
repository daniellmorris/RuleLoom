import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
function createSilentLogger() {
    return {
        info: () => { },
        warn: () => { },
        error: () => { },
        debug: () => { },
    };
}
function sanitizeClosure(closure) {
    const { name, description, signature } = closure;
    return { name, description, signature };
}
function sanitizeInputPlugin(plugin) {
    return { type: plugin.type, description: plugin.description };
}
async function readPackageJson(pluginDir) {
    const pkgPath = path.join(pluginDir, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf8');
    return JSON.parse(content);
}
async function resolveEntryPath(pluginDir, pkgMain) {
    const entry = pkgMain && pkgMain.trim().length ? pkgMain : 'dist/index.js';
    const absolute = path.resolve(pluginDir, entry);
    return { entry, absolute };
}
async function collectPluginExports(entryPath) {
    const module = await import(pathToFileURL(entryPath).href);
    const plugin = module.default ?? module.plugin ?? module;
    if (!plugin || typeof plugin.register !== 'function') {
        throw new Error('Plugin module does not export a { register } function.');
    }
    return plugin;
}
export async function generateManifest(options) {
    const pluginDir = path.resolve(options.pluginDir);
    const pkg = await readPackageJson(pluginDir);
    const { entry, absolute } = await resolveEntryPath(pluginDir, pkg.main);
    const manifest = {
        version: 1,
        name: pkg.name ?? path.basename(pluginDir),
        pluginVersion: pkg.version,
        description: pkg.description,
        entry,
        closures: [],
    };
    const manifestPath = options.outputPath
        ? path.resolve(options.outputPath)
        : path.join(pluginDir, 'ruleloom.manifest.yaml');
    const entryExists = await fs
        .stat(absolute)
        .then((s) => s.isFile())
        .catch(() => false);
    if (entryExists) {
        const closures = [];
        const inputs = [];
        const plugin = await collectPluginExports(absolute);
        const context = {
            registerClosure: (closure) => closures.push(closure),
            registerInputPlugin: (plugin) => inputs.push(plugin),
            logger: createSilentLogger(),
        };
        await plugin.register?.(context);
        manifest.closures = closures.map(sanitizeClosure);
        if (inputs.length) {
            manifest.inputs = inputs.map(sanitizeInputPlugin);
        }
    }
    const yamlText = yaml.dump(manifest, { noRefs: true, lineWidth: 120 });
    await fs.writeFile(manifestPath, yamlText, 'utf8');
    return { manifest, manifestPath };
}
export async function readManifest(manifestPath) {
    const raw = await fs.readFile(manifestPath, 'utf8');
    return yaml.load(raw);
}
//# sourceMappingURL=manifest.js.map