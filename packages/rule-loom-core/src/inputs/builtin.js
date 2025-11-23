import { registerInputPlugin } from './pluginRegistry.js';
import { httpInputPlugin } from './http.js';
import { schedulerInputPlugin } from './scheduler.js';
import { initInputPlugin } from './init.js';
export const builtinInputPlugins = [
    httpInputPlugin,
    schedulerInputPlugin,
    initInputPlugin,
];
export function registerBuiltinInputs(registerFn = registerInputPlugin) {
    for (const plugin of builtinInputPlugins) {
        registerFn(plugin);
    }
}
export default registerBuiltinInputs;
//# sourceMappingURL=builtin.js.map