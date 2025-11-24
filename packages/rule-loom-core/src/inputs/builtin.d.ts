import type { InputPlugin, BaseInputConfig } from './types.js';
import { registerInputPlugin } from './pluginRegistry.js';
export declare const builtinInputPlugins: InputPlugin<BaseInputConfig>[];
export declare function registerBuiltinInputs(registerFn?: typeof registerInputPlugin): void;
export default registerBuiltinInputs;
//# sourceMappingURL=builtin.d.ts.map