import type { BaseInputConfig, InputPlugin } from './types.js';
export declare function resetInputPlugins(): void;
export declare function registerInputPlugin<Config extends BaseInputConfig>(plugin: InputPlugin<Config>): void;
export declare function getInputPlugins(): InputPlugin<BaseInputConfig>[];
export declare function getInputSchema(): any;
//# sourceMappingURL=pluginRegistry.d.ts.map