import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';
import { schedulerInputPlugin } from './schedulerInput.js';

export const plugin = {
  name: 'rule-loom-plugin-scheduler',
  async register(ctx: PluginRegistrationContext) {
    ctx.registerInputPlugin?.(schedulerInputPlugin);
    ctx.logger.debug?.('rule-loom-plugin-scheduler registered scheduler input');
  },
};

export default plugin;
