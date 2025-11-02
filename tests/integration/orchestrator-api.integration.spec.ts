import path from 'node:path';
import { fileURLToPath } from 'node:url';
import supertest from 'supertest';
import { describe, it, expect } from 'vitest';

import { createOrchestrator } from '../../packages/tree-exe-orchestrator/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, 'configs');

async function withOrchestrator(configFile: string, testFn: (app: import('express').Express, close: () => Promise<void>) => Promise<void>) {
  const configPath = path.join(CONFIG_DIR, configFile);
  const instance = await createOrchestrator(configPath);
  try {
    await testFn(instance.app, instance.close);
  } finally {
    await instance.close();
  }
}

describe('Orchestrator API', () => {
  it('creates, lists, and removes runners via API', async () => {
    await withOrchestrator('orchestrator-empty.yaml', async (app) => {
      const request = supertest(app);
      const configPath = path.join(CONFIG_DIR, 'branching.yaml');

      const createRes = await request
        .post('/api/runners')
        .send({ configPath, basePath: '/dynamic' })
        .set('Content-Type', 'application/json');
      expect(createRes.status).toBe(201);
      const runnerId = createRes.body.id;
      expect(runnerId).toBeTruthy();

      const listRes = await request.get('/api/runners');
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((runner: any) => runner.id === runnerId)).toBe(true);

      const routeRes = await request
        .post('/dynamic/orders')
        .send({ items: ['A'] })
        .set('Content-Type', 'application/json');
      expect(routeRes.status).toBe(200);
      expect(routeRes.body.itemCount).toBe(1);

      const deleteRes = await request.delete(`/api/runners/${runnerId}`);
      expect(deleteRes.status).toBe(204);

      const notFoundRes = await request.post('/dynamic/orders').send({ items: ['A'] }).set('Content-Type', 'application/json');
      expect(notFoundRes.status).toBe(404);
    });
  });
});
