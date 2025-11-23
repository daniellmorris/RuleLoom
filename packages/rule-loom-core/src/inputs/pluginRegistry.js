import { z } from 'zod';
const plugins = [];
export function resetInputPlugins() {
    plugins.length = 0;
}
export function registerInputPlugin(plugin) {
    if (plugins.some((existing) => existing.type === plugin.type)) {
        throw new Error(`Input plugin with type "${plugin.type}" already registered`);
    }
    plugins.push(plugin);
}
export function getInputPlugins() {
    return [...plugins];
}
export function getInputSchema() {
    if (plugins.length === 0) {
        return z.never();
    }
    if (plugins.length === 1) {
        return plugins[0].schema;
    }
    return z.discriminatedUnion('type', plugins.map((plugin) => plugin.schema));
}
//# sourceMappingURL=pluginRegistry.js.map