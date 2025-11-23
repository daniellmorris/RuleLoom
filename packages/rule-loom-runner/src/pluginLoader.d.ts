import type { RuleLoomLogger } from 'rule-loom-lib';
import { registerInputPlugin } from 'rule-loom-core/inputs';
import type { ClosureDefinition } from 'rule-loom-engine';
import type { PluginSpec } from './pluginSpecs.js';
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
export declare function loadRuleLoomPlugins(specs: PluginSpec[], options: PluginLoaderOptions): Promise<void>;
export declare function resetLoadedPlugins(): void;
//# sourceMappingURL=pluginLoader.d.ts.map