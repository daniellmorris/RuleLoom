import { describe, it, expect, vi } from 'vitest';
import plugin from '../src/index.js';

vi.mock('openai', () => {
  const create = vi.fn(async () => ({ id: 'chatcmpl' }));
  const OpenAI = vi.fn().mockImplementation(() => ({
    chat: { completions: { create } },
  }));
  return { OpenAI };
});

describe('rule-loom-plugin-openai', () => {
  it('registers chatCompletion', async () => {
    const registerClosure = vi.fn();
    await plugin.register({ registerClosure, logger: {} } as any);
    expect(registerClosure).toHaveBeenCalledTimes(1);
    expect(registerClosure.mock.calls[0][0].name).toBe('openai.chatCompletion');
  });
});
