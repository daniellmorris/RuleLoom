import { z } from 'zod';
import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';

type PublishParams = {
  url: string;
  username?: string;
  password?: string;
  topic: string;
  payload: string;
  qos?: 0 | 1 | 2;
  retain?: boolean;
};

export const plugin = {
  name: 'rule-loom-plugin-mqtt',
  async register(ctx: PluginRegistrationContext) {
    const triggerSchema = z.object({
      id: z.string().optional(),
      type: z.literal('topic').optional(),
      topic: z.string().min(1),
      flow: z.string().min(1),
      qos: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
      json: z.boolean().optional(),
    });

    const mqttInputSchema = z.object({
      type: z.literal('mqtt'),
      config: z
        .object({
          url: z.string().min(1),
          username: z.string().optional(),
          password: z.string().optional(),
          clientId: z.string().optional(),
          options: z.record(z.any()).optional(),
        })
        .strict(),
      triggers: z.array(triggerSchema).min(1),
    });

    type MqttInputConfig = z.infer<typeof mqttInputSchema>;

    ctx.registerInputPlugin({
      type: 'mqtt',
      schema: mqttInputSchema,
      configParameters: [
        { name: 'url', type: 'string', required: true },
        { name: 'username', type: 'string' },
        { name: 'password', type: 'string' },
        { name: 'clientId', type: 'string' },
        { name: 'options', type: 'any' },
      ],
      triggerParameters: [
        { name: 'topic', type: 'string', required: true },
        { name: 'flow', type: 'flow', required: true },
        { name: 'qos', type: 'string', enum: ['0', '1', '2'] },
        { name: 'json', type: 'boolean' },
      ],
      initialize: async (config: MqttInputConfig, context: any) => {
        const mqtt = await import('mqtt');
        const client = mqtt.connect(config.config.url, {
          username: config.config.username,
          password: config.config.password,
          clientId: config.config.clientId,
          ...(config.config.options ?? {}),
        });

        await new Promise<void>((resolve, reject) => {
          client.once('connect', () => resolve());
          client.once('error', reject);
        });

        // Subscribe to configured topics
        const subs = config.triggers.map((s) => ({ topic: s.topic, qos: s.qos ?? 0 }));
        if (subs.length) {
          await new Promise<void>((resolve, reject) => {
          client.subscribe(subs as any, (err) => (err ? reject(err) : resolve()));
        });
        }

        const onMessage = async (topic: string, payload: Buffer) => {
          const sub = config.triggers.find((s) => s.topic === topic);
          if (!sub) return;
          try {
            const body = sub.json ? JSON.parse(payload.toString('utf8')) : payload.toString('utf8');
            await context.engine.execute(sub.flow, {}, { mqtt: { topic, payload: body } });
          } catch (error) {
            context.logger.error?.('MQTT input handler failed', { topic, error });
          }
        };

        client.on('message', onMessage);

        return {
          cleanup: async () => {
            client.off('message', onMessage);
            await new Promise<void>((resolve) => client.end(true, () => resolve()));
          },
        };
      },
    });

    ctx.registerClosure({
      name: 'mqtt.publish',
      description: 'Publish a message to an MQTT topic',
      signature: {
        parameters: [
          { name: 'url', type: 'string', required: true },
          { name: 'username', type: 'string', required: false },
          { name: 'password', type: 'string', required: false },
          { name: 'topic', type: 'string', required: true },
          { name: 'payload', type: 'string', required: true },
          { name: 'qos', type: 'number', required: false },
          { name: 'retain', type: 'boolean', required: false },
        ],
      },
      handler: async (_state, { parameters }) => {
        const { url, username, password, topic, payload, qos = 0, retain = false } = parameters as PublishParams;
        const mqtt = await import('mqtt');
        const client = mqtt.connect(url, { username, password });
        await new Promise<void>((resolve, reject) => {
          client.on('connect', () => {
            client.publish(topic, payload, { qos, retain }, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          client.on('error', reject);
        });
        client.end();
        return { published: true, topic };
      },
    });
  },
};

export default plugin;
