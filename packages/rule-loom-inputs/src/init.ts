import { z } from 'zod';
import { registerInputPlugin } from './pluginRegistry.js';
import type { InitInputConfig, InputPluginContext } from './types.js';

const initInputSchema = z.object({
  type: z.literal('init'),
  flow: z.string().min(1),
  initialState: z.record(z.any()).optional(),
  runtime: z.record(z.any()).optional(),
});

registerInputPlugin<InitInputConfig>({
  type: 'init',
  schema: initInputSchema,
  initialize: async (config, context: InputPluginContext) => {
    context.logger.info?.(`Init input executing flow "${config.flow}"`);
    await context.engine.execute(config.flow, config.initialState ?? {}, config.runtime ?? {});
  },
});
