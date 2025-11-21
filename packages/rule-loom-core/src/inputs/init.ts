import { z } from 'zod';
import type { InitInputConfig, InputPlugin, InputPluginContext } from './types.js';

export const initInputSchema = z.object({
  type: z.literal('init'),
  flow: z.string().min(1),
  initialState: z.record(z.any()).optional(),
  runtime: z.record(z.any()).optional(),
});

export const initInputPlugin: InputPlugin<InitInputConfig> = {
  type: 'init',
  schema: initInputSchema,
  initialize: async (config, context: InputPluginContext) => {
    context.logger.info?.(`Init input executing flow "${config.flow}"`);
    await context.engine.execute(config.flow, config.initialState ?? {}, config.runtime ?? {});
  },
};
