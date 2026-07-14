import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import supertest from 'supertest';
import { describe, expect } from 'vitest';
import { itHttp } from '../helpers/httpSkip.ts';
import { createRunner } from '../../packages/rule-loom-runner/src/index.ts';
import { RunnerValidationError } from '../../packages/rule-loom-runner/src/validator.ts';

const CONFIG_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'configs');

describe('multiple input instances', () => {
  itHttp('routes two HTTP input instances with distinct ids on one port', async () => {
    const port = await freePort();
    const configPath = await writeConfig(port, true);
    const runner = await createRunner(configPath);
    try {
      const app = runner.services.httpApp as any;
      const publicRes = await supertest(app).post('/public/check').send({}).set('Content-Type', 'application/json');
      const adminRes = await supertest(app).post('/admin/check').send({}).set('Content-Type', 'application/json');

      expect(publicRes.status).toBe(200);
      expect(publicRes.body).toEqual({ inputId: 'public-http' });
      expect(adminRes.status).toBe(200);
      expect(adminRes.body).toEqual({ inputId: 'admin-http' });
    } finally {
      await runner.close();
    }
  });

  itHttp('rejects duplicate input types without ids', async () => {
    const port = await freePort();
    const configPath = await writeConfig(port, false);
    await expect(createRunner(configPath)).rejects.toMatchObject({
      name: 'RunnerValidationError',
      result: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('unique "id"'),
          }),
        ]),
      },
    } satisfies Partial<RunnerValidationError>);
  });
});

async function writeConfig(port: number, includeIds: boolean): Promise<string> {
  const config = {
    version: 1,
    plugins: [
      { source: 'file', path: path.resolve(CONFIG_DIR, '../../../plugins/rule-loom-core') },
      { source: 'file', path: path.resolve(CONFIG_DIR, '../../../plugins/rule-loom-plugin-http') },
    ],
    inputs: [
      {
        type: 'http',
        ...(includeIds ? { id: 'public-http' } : {}),
        config: { port, basePath: '/public' },
        triggers: [{ method: 'post', path: '/check', flow: 'public-flow' }],
      },
      {
        type: 'http',
        ...(includeIds ? { id: 'admin-http' } : {}),
        config: { port, basePath: '/admin' },
        triggers: [{ method: 'post', path: '/check', flow: 'admin-flow' }],
      },
    ],
    flows: [
      {
        name: 'public-flow',
        steps: [{ closure: 'core.respond', parameters: { status: 200, body: { inputId: '${state.inputId}' } } }],
      },
      {
        name: 'admin-flow',
        steps: [{ closure: 'core.respond', parameters: { status: 200, body: { inputId: '${state.inputId}' } } }],
      },
    ],
  };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rule-loom-inputs-'));
  const configPath = path.join(dir, 'config.yaml');
  await fs.writeFile(configPath, yaml.dump(config));
  return configPath;
}

function freePort(): Promise<number> {
  const server = net.createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') reject(new Error('Failed to allocate port'));
        else resolve(address.port);
      });
    });
  });
}
