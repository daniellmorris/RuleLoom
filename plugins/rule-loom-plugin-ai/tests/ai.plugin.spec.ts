import { describe, expect, it } from 'vitest';
import RuleLoomEngine from 'rule-loom-engine';
import plugin from '../src/index.js';

async function engineWithAi() {
  const closures: any[] = [];
  await plugin.register({ registerClosure: (closure: any) => closures.push(closure), logger: {} } as any);
  return new RuleLoomEngine({ closures });
}

describe('rule-loom-plugin-ai', () => {
  it('registers provider-neutral closures', async () => {
    const closures: any[] = [];
    await plugin.register({ registerClosure: (closure: any) => closures.push(closure), logger: {} } as any);

    expect(closures.map((c) => c.name).sort()).toEqual([
      'ai.classify',
      'ai.embed',
      'ai.extract',
      'ai.generate',
    ]);
    expect(closures.every((c) => c.namespace === 'ai')).toBe(true);
  });

  it('generates deterministic mock text', async () => {
    const engine = await engineWithAi();
    engine.registerFlow({
      name: 'generate',
      steps: [
        {
          closure: 'ai.generate',
          assign: 'ai.generated',
          parameters: { provider: 'mock', prompt: 'summarize this' },
        },
      ],
    });

    const { state } = await engine.execute('generate');

    expect(state.ai).toEqual({
      generated: {
        text: 'mock:summarize this',
        model: 'mock',
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    });
  });

  it('extracts schema-shaped JSON with falsey-safe mock values', async () => {
    const engine = await engineWithAi();
    engine.registerFlow({
      name: 'extract',
      steps: [
        {
          closure: 'ai.extract',
          assign: 'ticket',
          parameters: {
            provider: 'mock',
            input: 'broken checkout',
            schema: {
              type: 'object',
              properties: {
                priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                retryCount: { type: 'number' },
                needsHuman: { type: 'boolean' },
                summary: { type: 'string' },
              },
              required: ['priority', 'summary'],
            },
          },
        },
      ],
    });

    const { state } = await engine.execute('extract');

    expect(state.ticket).toEqual({
      priority: 'low',
      retryCount: 0,
      needsHuman: false,
      summary: 'mock-summary',
    });
  });

  it('classifies and embeds with the mock provider', async () => {
    const engine = await engineWithAi();
    engine.registerFlow({
      name: 'classify-embed',
      steps: [
        {
          closure: 'ai.classify',
          assign: 'category',
          parameters: { provider: 'mock', input: 'charge failed', labels: ['billing', 'bug'] },
        },
        {
          closure: 'ai.embed',
          assign: 'embedding',
          parameters: { provider: 'mock', input: ['hello', 'world'] },
        },
      ],
    });

    const { state } = await engine.execute('classify-embed');

    expect((state.category as any).label).toBe('billing');
    expect((state.embedding as any).embeddings).toHaveLength(2);
    expect((state.embedding as any).embeddings[0]).toHaveLength(3);
  });
});
