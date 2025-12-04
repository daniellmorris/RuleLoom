import { z } from 'zod';
import type { InitInputConfig, InputPlugin, InputPluginContext } from './types.js';

export const initConfigParameters: any[] = [];
export const initTriggerParameters = [
  { name: 'flow', type: 'string', required: true, description: 'Flow to run at startup' },
  { name: 'initialState', type: 'any', required: false },
  { name: 'runtime', type: 'any', required: false },
];

function buildInitSchema() {
  const toZod = (p: any) => {
    switch (p.type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      default:
        return z.any();
    }
  };
  const triggerShape: Record<string, any> = { id: z.string().optional(), type: z.literal('init').optional() };
  initTriggerParameters.forEach((p) => {
    triggerShape[p.name] = p.required ? toZod(p) : toZod(p).optional();
  });
  return z.object({
    type: z.literal('init'),
    triggers: z.array(z.object(triggerShape)).min(1),
  });
}

export const initInputSchema = buildInitSchema();

export const initInputPlugin: InputPlugin<InitInputConfig> = {
  type: 'init',
  schema: initInputSchema,
  configParameters: initConfigParameters,
  triggerParameters: initTriggerParameters,
  initialize: async (config, context: InputPluginContext) => {
    for (const trigger of config.triggers) {
      context.logger.info?.(`Init trigger executing flow "${trigger.flow}"`);
      await context.engine.execute(trigger.flow, trigger.initialState ?? {}, trigger.runtime ?? {});
    }
  },
};
