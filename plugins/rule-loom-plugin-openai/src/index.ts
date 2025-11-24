import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';

type ChatParams = {
  apiKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
};

export const plugin = {
  name: 'rule-loom-plugin-openai',
  async register(ctx: PluginRegistrationContext) {
    ctx.registerClosure({
      name: 'openai.chatCompletion',
      description: 'Call OpenAI chat completions',
      signature: {
        parameters: [
          { name: 'apiKey', type: 'string', required: true },
          { name: 'model', type: 'string', required: true },
          { name: 'messages', type: 'array', required: true },
          { name: 'temperature', type: 'number', required: false },
        ],
      },
      handler: async (_state, { parameters }) => {
        const { OpenAI } = await import('openai');
        const { apiKey, model, messages, temperature } = parameters as ChatParams;
        const client = new OpenAI({ apiKey });
        const res = await client.chat.completions.create({
          model,
          messages,
          temperature,
        });
        return res;
      },
    });
  },
};

export default plugin;
