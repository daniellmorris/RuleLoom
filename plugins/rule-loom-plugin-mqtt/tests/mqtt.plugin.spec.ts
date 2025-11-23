import { describe, it, expect, vi } from 'vitest';
import plugin from '../src/index.js';

vi.mock('mqtt', () => {
  const handlers: Record<string, Function> = {};
  const publish = vi.fn((topic, payload, opts, cb) => cb && cb(null));
  const end = vi.fn();
  const client = { on: (ev: string, cb: Function) => (handlers[ev] = cb), publish, end };
  const connect = vi.fn(() => {
    setTimeout(() => handlers['connect']?.(), 0);
    return client;
  });
  return { connect, __mockHandlers: handlers };
});

describe('rule-loom-plugin-mqtt', () => {
  it('registers mqtt.publish', async () => {
    const registerClosure = vi.fn();
    await plugin.register({ registerClosure, logger: {} } as any);
    expect(registerClosure).toHaveBeenCalledTimes(1);
    expect(registerClosure.mock.calls[0][0].name).toBe('mqtt.publish');
  });
});
