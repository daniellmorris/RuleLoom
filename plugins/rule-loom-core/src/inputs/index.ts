export { registerInputPlugin, getInputPlugins, getInputSchema, resetInputPlugins } from './pluginRegistry.js';
export { registerBuiltinInputs, builtinInputPlugins } from './builtin.js';
export { initInputPlugin, initInputSchema } from './init.js';
export type {
  BaseInputConfig,
  RunnerInputConfig,
  InitInputConfig,
  InputPluginContext,
  InputPlugin,
} from './types.js';
