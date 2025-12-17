import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';
import { httpInputPlugin } from './httpInput.js';
import { createHttpClosures } from './httpClosures.js';

export const plugin = {
  name: 'rule-loom-plugin-http',
  async register(ctx: PluginRegistrationContext) {
    ctx.registerInputPlugin?.(httpInputPlugin);
    createHttpClosures().forEach((closure) => ctx.registerClosure(closure));
    ctx.logger.debug?.('rule-loom-plugin-http registered http input + closures');
  },
};

export default plugin;
