import type { InputPlugin, BaseInputConfig } from './types.js';
import { registerInputPlugin } from './pluginRegistry.js';
import { httpInputPlugin } from './http.js';
import { schedulerInputPlugin } from './scheduler.js';
import { initInputPlugin } from './init.js';

export const builtinInputPlugins: InputPlugin<BaseInputConfig>[] = [
  httpInputPlugin as unknown as InputPlugin<BaseInputConfig>,
  schedulerInputPlugin as unknown as InputPlugin<BaseInputConfig>,
  initInputPlugin as unknown as InputPlugin<BaseInputConfig>,
];

export function registerBuiltinInputs(registerFn: typeof registerInputPlugin = registerInputPlugin) {
  for (const plugin of builtinInputPlugins) {
    registerFn(plugin as any);
  }
}

export default registerBuiltinInputs;
