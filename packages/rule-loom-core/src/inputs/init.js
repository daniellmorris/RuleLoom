import { z } from 'zod';
export const initInputSchema = z.object({
    type: z.literal('init'),
    flow: z.string().min(1),
    initialState: z.record(z.any()).optional(),
    runtime: z.record(z.any()).optional(),
});
export const initInputPlugin = {
    type: 'init',
    schema: initInputSchema,
    initialize: async (config, context) => {
        context.logger.info?.(`Init input executing flow "${config.flow}"`);
        await context.engine.execute(config.flow, config.initialState ?? {}, config.runtime ?? {});
    },
};
//# sourceMappingURL=init.js.map