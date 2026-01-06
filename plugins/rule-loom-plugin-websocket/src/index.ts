import { z } from 'zod';
import WebSocket from 'ws';
import type { PluginRegistrationContext } from 'rule-loom-runner/src/pluginLoader.js';

type WebsocketTriggerConfig = {
  id?: string;
  type?: 'message';
  flow: string;
  json?: boolean;
};

type WebsocketInputConfig = {
  type: 'websocket';
  config: {
    url: string;
    protocols?: string | string[];
    headers?: Record<string, string>;
    connectMessages?: unknown[];
    reconnect?: boolean;
    reconnectIntervalMs?: number;
  };
  triggers: WebsocketTriggerConfig[];
};

export const plugin = {
  name: 'rule-loom-plugin-websocket',
  async register(ctx: PluginRegistrationContext) {
    const triggerSchema = z.object({
      id: z.string().optional(),
      type: z.literal('message').optional(),
      flow: z.string().min(1),
      json: z.boolean().optional(),
    });

    const inputSchema = z.object({
      type: z.literal('websocket'),
      config: z
        .object({
          url: z.string().min(1),
          protocols: z.union([z.string(), z.array(z.string())]).optional(),
          headers: z.record(z.string()).optional(),
          connectMessages: z.array(z.any()).optional(),
          reconnect: z.boolean().optional(),
          reconnectIntervalMs: z.number().optional(),
        })
        .strict(),
      triggers: z.array(triggerSchema).min(1),
    });

    ctx.registerInputPlugin({
      type: 'websocket',
      schema: inputSchema,
      configParameters: [
        { name: 'url', type: 'string', required: true, description: 'WebSocket URL (ws:// or wss://).' },
        { name: 'protocols', type: 'string', required: false, description: 'Subprotocol(s) for the WebSocket handshake.' },
        { name: 'headers', type: 'object', required: false, description: 'Headers to send during the WebSocket handshake.' },
        { name: 'connectMessages', type: 'any', required: false, description: 'Messages to send after connect (objects are JSON-encoded).' },
        { name: 'reconnect', type: 'boolean', required: false, description: 'Reconnect on disconnect (default true).' },
        { name: 'reconnectIntervalMs', type: 'number', required: false, description: 'Reconnect delay in milliseconds (default 5000).' },
      ],
      triggerParameters: [
        { name: 'flow', type: 'string', required: true, description: 'Target flow name' },
        { name: 'json', type: 'boolean', required: false, description: 'Parse inbound messages as JSON' },
      ],
      initialize: async (config: WebsocketInputConfig, context) => {
        const reconnect = config.config.reconnect ?? true;
        const reconnectIntervalMs = config.config.reconnectIntervalMs ?? 5000;
        const connectMessages = config.config.connectMessages ?? [];

        let socket: WebSocket | undefined;
        let stopped = false;
        let reconnectTimer: NodeJS.Timeout | undefined;

        const sendMessage = (message: unknown) => {
          if (!socket || socket.readyState !== WebSocket.OPEN) return;
          if (typeof message === 'string' || Buffer.isBuffer(message)) {
            socket.send(message);
            return;
          }
          socket.send(JSON.stringify(message));
        };

        const handleMessage = async (raw: WebSocket.RawData) => {
          const text = (() => {
            if (typeof raw === 'string') return raw;
            if (Buffer.isBuffer(raw)) return raw.toString('utf8');
            if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
            if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8');
            return Buffer.from(raw as Uint8Array).toString('utf8');
          })();
          let parsed: unknown;
          let parsedAttempted = false;
          const parseJson = () => {
            if (parsedAttempted) return parsed;
            parsedAttempted = true;
            try {
              parsed = JSON.parse(text);
            } catch (error) {
              context.logger.warn?.('WebSocket message JSON parse failed', { error });
              parsed = undefined;
            }
            return parsed;
          };

          for (const trigger of config.triggers) {
            const wantsJson = trigger.json ?? false;
            const message = wantsJson ? parseJson() ?? text : text;
            const state = {
              websocket: {
                message,
                raw: text,
                json: wantsJson ? parseJson() : undefined,
              },
            };
            const runtime = {
              websocket: {
                url: config.config.url,
              },
            };
            try {
              await context.engine.execute(trigger.flow, state, runtime);
            } catch (error) {
              context.logger.error?.('WebSocket input handler failed', { flow: trigger.flow, error });
            }
          }
        };

        const connect = () => {
          socket = new WebSocket(config.config.url, config.config.protocols, {
            headers: config.config.headers,
          });

          socket.on('open', () => {
            connectMessages.forEach((message) => sendMessage(message));
            context.logger.info?.(`WebSocket input connected to ${config.config.url}`);
          });

          socket.on('message', handleMessage);

          socket.on('close', (code, reason) => {
            context.logger.warn?.(`WebSocket input closed (${code}) ${reason.toString()}`);
            if (!stopped && reconnect) {
              reconnectTimer = setTimeout(connect, reconnectIntervalMs);
            }
          });

          socket.on('error', (error) => {
            context.logger.error?.('WebSocket input error', { error });
          });
        };

        connect();

        return {
          cleanup: async () => {
            stopped = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (socket) {
              socket.removeAllListeners();
              socket.close();
            }
          },
        };
      },
    });
  },
};

export default plugin;
