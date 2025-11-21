import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { applySecrets, resolveSecrets } from '../../packages/rule-loom-runner/src/secrets.ts';
import { parseRunnerConfig } from '../../packages/rule-loom-runner/src/config.ts';
import { createRunner } from '../../packages/rule-loom-runner/src/index.ts';

const CONFIG_DIR = path.join(os.tmpdir(), 'ruleloom-secrets-test');

beforeEach(async () => {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
});

afterEach(async () => {
  await fs.rm(CONFIG_DIR, { recursive: true, force: true });
});

describe('secrets resolution', () => {
  it('hydrates secrets from inline/env/files and substitutes placeholders', async () => {
    process.env.TEST_SECRET_ENV = 'from-env';

    const filePath = path.join(CONFIG_DIR, 'secret.txt');
    await fs.writeFile(filePath, 'from-file', 'utf8');

    const rawConfig = {
      secrets: {
        inline: { INLINE_KEY: 'from-inline' },
        env: { ENV_KEY: 'TEST_SECRET_ENV' },
        files: [{ key: 'FILE_KEY', path: filePath }],
      },
      flows: [
        {
          name: 'demo',
          steps: [
            {
              closure: 'core.respond',
              parameters: {
                body: {
                  a: '${secrets.INLINE_KEY}',
                  b: '${secrets.ENV_KEY}',
                  c: '${secrets.FILE_KEY}',
                },
              },
            },
          ],
        },
      ],
    } satisfies Record<string, unknown>;

    const secrets = await resolveSecrets(rawConfig.secrets as any, CONFIG_DIR);
    const resolved = applySecrets(rawConfig, secrets);
    const parsed = parseRunnerConfig(resolved);

    const body = (parsed.flows[0].steps[0] as any).parameters.body;
    expect(body).toEqual({ a: 'from-inline', b: 'from-env', c: 'from-file' });
  });

  it('throws when a placeholder cannot be resolved', async () => {
    const rawConfig = {
      flows: [
        { name: 'demo', steps: [{ closure: 'core.respond', parameters: { body: '${secrets.MISSING}' } }] },
      ],
    };

    const secrets = await resolveSecrets(undefined, CONFIG_DIR);
    expect(() => applySecrets(rawConfig, secrets)).toThrow(/Secret "MISSING" is not defined/);
  });

  it('loads secrets from fixture config via createRunner', async () => {
    const configPath = path.resolve(__dirname, 'configs', 'secrets-inline.yaml');
    process.env.SEC_INLINE_ENV = 'from-env-fixture';
    const runner = await createRunner(configPath);
    try {
      const body = (runner.config.flows[0].steps[0] as any).parameters.body;
      expect(body).toEqual({
        inline: 'from-inline-fixture',
        env: 'from-env-fixture',
        file: 'from-file-fixture',
        dotenv: 'from-dotenv-fixture',
      });
    } finally {
      await runner.close();
    }
  });
});
