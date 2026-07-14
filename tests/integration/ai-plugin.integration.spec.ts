import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { createRunner } from '../../packages/rule-loom-runner/src/index.ts';

describe('provider-neutral AI plugin', () => {
  it('loads from YAML and executes mock AI workflow closures', async () => {
    const configPath = await writeConfig();
    const runner = await createRunner(configPath);

    try {
      const result = await runner.engine.execute('ai-demo', { request: { body: { message: 'checkout failed' } } });

      expect(result.state.ai).toMatchObject({
        generated: { text: 'mock:Summarize: checkout failed' },
        ticket: {
          priority: 'low',
          summary: 'mock-summary',
        },
        category: {
          label: 'billing',
        },
      });
      expect((result.state.ai as any).embedding.embeddings).toHaveLength(1);
    } finally {
      await runner.close();
    }
  });
});

async function writeConfig() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rule-loom-ai-plugin-'));
  const config = {
    version: 1,
    plugins: [{ source: 'file', path: path.resolve('plugins/rule-loom-plugin-ai') }],
    flows: [
      {
        name: 'ai-demo',
        steps: [
          {
            closure: 'ai.generate',
            assign: 'ai.generated',
            parameters: {
              provider: 'mock',
              prompt: 'Summarize: ${state.request.body.message}',
            },
          },
          {
            closure: 'ai.extract',
            assign: 'ai.ticket',
            parameters: {
              provider: 'mock',
              input: '${state.request.body.message}',
              schema: {
                type: 'object',
                properties: {
                  priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                  summary: { type: 'string' },
                },
                required: ['priority', 'summary'],
              },
            },
          },
          {
            closure: 'ai.classify',
            assign: 'ai.category',
            parameters: {
              provider: 'mock',
              input: '${state.request.body.message}',
              labels: ['billing', 'bug', 'sales'],
            },
          },
          {
            closure: 'ai.embed',
            assign: 'ai.embedding',
            parameters: {
              provider: 'mock',
              input: '${state.request.body.message}',
            },
          },
        ],
      },
    ],
  };
  const configPath = path.join(dir, 'config.yaml');
  await fs.writeFile(configPath, yaml.dump(config), 'utf8');
  return configPath;
}
