import { z } from 'zod';
import type { PluginRegistrationContext, RuleLoomPlugin } from 'rule-loom-runner';

const plugin: RuleLoomPlugin = {
  name: 'example-plugin-ts',
  version: '0.0.1',
  async register({ registerInputPlugin, registerClosure, logger }: PluginRegistrationContext) {
    const echoInputSchema = z.object({
      type: z.literal('echo'),
      message: z.string().min(1),
    });

    registerInputPlugin({
      type: 'echo',
      schema: echoInputSchema,
      initialize: async (config) => {
        logger.info?.(`example-plugin-ts echo input: ${config.message}`);
        return {
          cleanup: () => logger.info?.('example-plugin-ts echo cleanup'),
        };
      },
    });

    registerClosure({
      name: 'hello.uppercase',
      handler: async (_state, context) => {
        const value = context.parameters?.value ?? '';
        return String(value).toUpperCase();
      },
      signature: {
        description: 'Uppercases a string value.',
        parameters: [{ name: 'value', type: 'string', required: true }],
        returns: { type: 'string' },
      },
    });

    registerClosure({
      name: 'hello.add',
      handler: async (_state, context) => {
        const a = Number(context.parameters?.a ?? 0);
        const b = Number(context.parameters?.b ?? 0);
        return a + b;
      },
      signature: {
        description: 'Adds two numbers.',
        parameters: [
          { name: 'a', type: 'number', required: true },
          { name: 'b', type: 'number', required: true },
        ],
        returns: { type: 'number' },
      },
    });
  },
};

export default plugin;
