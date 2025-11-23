import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';

type SlackPostParams = {
  channel: string;
  text: string;
  thread_ts?: string;
  blocks?: unknown;
  token: string;
};

export const plugin = {
  name: 'rule-loom-plugin-slack',
  async register(ctx: PluginRegistrationContext) {
    ctx.registerClosure({
      name: 'slack.postMessage',
      description: 'Send a message to a Slack channel',
      signature: {
        parameters: [
          { name: 'channel', type: 'string', required: true },
          { name: 'text', type: 'string', required: true },
          { name: 'thread_ts', type: 'string', required: false },
          { name: 'blocks', type: 'any', required: false },
          { name: 'token', type: 'string', required: false },
        ],
      },
      handler: async (_state, context) => {
        const params = (context.parameters ?? {}) as SlackPostParams;
        const { WebClient } = await import('@slack/web-api');
        const token = params.token;
        if (!token) throw new Error('Slack token missing (provide param token via secrets/params)');
        const client = new WebClient(token);
        const res = await client.chat.postMessage({
          channel: params.channel,
          text: params.text,
          thread_ts: params.thread_ts,
          blocks: params.blocks as any,
        });
        return res;
      },
    });
  },
};

export default plugin;
