import { describe, it, expect, vi, beforeEach } from 'vitest';
import plugin from '../src/index.js';

vi.mock('@slack/web-api', () => {
  const postMessage = vi.fn(async (payload) => ({ ok: true, channel: payload.channel, text: payload.text }));
  const WebClient = vi.fn().mockImplementation(() => ({ chat: { postMessage } }));
  return { WebClient, __postMessage: postMessage };
});

describe('rule-loom-plugin-slack', () => {
  const registerClosure = vi.fn();
  const ctx: any = { registerClosure, logger: {} };

  beforeEach(() => {
    registerClosure.mockClear();
  });

  it('registers the slack.postMessage closure', async () => {
    await plugin.register(ctx);
    expect(registerClosure).toHaveBeenCalledTimes(1);
    const closure = registerClosure.mock.calls[0][0];
    expect(closure.name).toBe('slack.postMessage');
  });
});
