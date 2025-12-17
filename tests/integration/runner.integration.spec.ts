import path from 'node:path';
import { fileURLToPath } from 'node:url';
import supertest from 'supertest';
import { describe, it, expect } from 'vitest';
import { itHttp } from '../helpers/httpSkip.ts';

import { createRunner } from '../../packages/rule-loom-runner/src/index.ts';
import type { RunnerInstance } from '../../packages/rule-loom-runner/src/index.ts';
import { FEATURES } from './features.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, 'configs');

async function withRunner<T>(configFile: string, testFn: (instance: RunnerInstance) => Promise<T>) {
  const configPath = path.join(CONFIG_DIR, configFile);
  const instance = await createRunner(configPath);
  try {
    return await testFn(instance);
  } finally {
    await instance.close();
  }
}

describe('RuleLoom Runner configuration features', () => {
  it('rejects configs that fail validation', async () => {
    const invalidPath = path.join(CONFIG_DIR, 'invalid-missing-param.yaml');
    await expect(createRunner(invalidPath)).rejects.toThrow(/validation/i);
  });

  itHttp('Branching & Core Closures', async () => {
    await withRunner('branching.yaml', async (instance) => {
      const app = instance.services.httpApp as any;
      const request = supertest(app);
      const positive = await request
        .post('/orders')
        .send({ items: ['A', 'B'] })
        .set('Content-Type', 'application/json');
      expect(positive.status).toBe(200);
      expect(positive.body.itemCount).toBe(2);

      const negative = await request
        .post('/orders')
        .send({ items: [] })
        .set('Content-Type', 'application/json');
      expect(negative.status).toBe(204);
    });
  });

  itHttp('$call Inline Closure Execution', async () => {
    await withRunner('call-inline.yaml', async (instance) => {
      const app = instance.services.httpApp as any;
      const res = await supertest(app)
        .post('/format')
        .send({ id: 'O-1', total: 99 })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Order O-1 total 99');
    });
  });

  itHttp('Functional Parameters (core.for-each)', async () => {
    await withRunner('functional.yaml', async (instance) => {
      const app = instance.services.httpApp as any;
      const res = await supertest(app)
        .post('/items')
        .send({ items: ['x', 'y', 'z'] })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([
        { index: 0, value: 'x' },
        { index: 1, value: 'y' },
        { index: 2, value: 'z' },
      ]);
    });
  });

  itHttp('Flow Closures reuse', async () => {
    await withRunner('flow-closure.yaml', async (instance) => {
      const app = instance.services.httpApp as any;
      const res = await supertest(app)
        .post('/flow')
        .send({ id: 'USER-1', total: 123 })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'USER-1', total: 123, status: 'processed' });
    });
  });

  itHttp('Flow closure parameters interpolate', async () => {
    await withRunner('flow-closure-params.yaml', async (instance) => {
      const app = instance.services.httpApp as any;
      const res = await supertest(app)
        .post('/flow-params')
        .send({ message: 'hi-from-test' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.echoed).toBe('hi-from-test');
    });
  });

  itHttp('Module closures via $call', async () => {
    await withRunner('module.yaml', async (instance) => {
      const app = instance.services.httpApp as any;
      const res = await supertest(app)
        .post('/module')
        .send({ amount: 100, rate: 0.2 })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(200);
      expect(res.body.total).toBeCloseTo(80);
    });
  });
});

// Ensures the feature list stays in sync with implemented configs.
describe('Configuration feature catalogue', () => {
  it('lists all major configuration features', () => {
    expect(FEATURES.map((f) => f.config).sort()).toEqual(
      ['branching.yaml', 'call-inline.yaml', 'functional.yaml', 'flow-closure.yaml', 'module.yaml', 'scheduler.yaml'].sort(),
    );
  });
});
