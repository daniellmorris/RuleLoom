import { z } from 'zod';
import type { InitInputConfig, InputPlugin, InputPluginContext } from './types.js';

export const initInputSchema = z.object({
  type: z.literal('init'),
  triggers: z.array(
    z.object({
      id: z.string().optional(),
      type: z.literal('init').optional(),
      flow: z.string().min(1),
      initialState: z.record(z.any()).optional(),
      runtime: z.record(z.any()).optional(),
    }),
  ).min(1),
});

export const initInputPlugin: InputPlugin<InitInputConfig> = {
  type: 'init',
  schema: initInputSchema,
  initialize: async (config, context: InputPluginContext) => {
    for (const trigger of config.triggers) {
      context.logger.info?.(`Init trigger executing flow "${trigger.flow}"`);
      await context.engine.execute(trigger.flow, trigger.initialState ?? {}, trigger.runtime ?? {});
    }
  },
};
