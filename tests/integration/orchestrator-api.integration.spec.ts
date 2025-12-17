import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import supertest from 'supertest';
import { describe, it, expect } from 'vitest';
import { itHttp } from '../helpers/httpSkip.ts';

import { createOrchestrator } from '../../packages/rule-loom-orchestrator/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, 'configs');

async function withOrchestrator(
  configFile: string,
  testFn: (app: import('express').Express, close: () => Promise<void>) => Promise<void>,
) {
  const configPath = path.join(CONFIG_DIR, configFile);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruleloom-db-'));
  const dbPath = path.join(tempDir, 'orchestrator.db');
  const previousUrl = process.env.RULE_LOOM_DATABASE_URL;
  process.env.RULE_LOOM_DATABASE_URL = `file:${dbPath}`;
  const instance = await createOrchestrator(configPath);
  try {
    await testFn(instance.app, instance.close);
  } finally {
    await instance.close();
    process.env.RULE_LOOM_DATABASE_URL = previousUrl;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe('Orchestrator API', () => {
  itHttp('creates, lists, and removes runners via API', async () => {
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

  itHttp('prioritizes specific base paths over root-mounted runners', async () => {
    await withOrchestrator('orchestrator-empty.yaml', async (app) => {
      const request = supertest(app);
      const configPath = path.join(CONFIG_DIR, 'branching.yaml');

      const rootRes = await request
        .post('/api/runners')
        .send({ configPath, basePath: '/' })
        .set('Content-Type', 'application/json');
      expect(rootRes.status).toBe(201);

      const nestedRes = await request
        .post('/api/runners')
        .send({ configPath, basePath: '/dynamic' })
        .set('Content-Type', 'application/json');
      expect(nestedRes.status).toBe(201);

      const routeRes = await request
        .post('/dynamic/orders')
        .send({ items: ['A', 'B'] })
        .set('Content-Type', 'application/json');
      expect(routeRes.status).toBe(200);
      expect(routeRes.body.itemCount).toBe(2);
    });
  });

  itHttp('validates configs via API before creation', async () => {
    await withOrchestrator('orchestrator-empty.yaml', async (app) => {
      const request = supertest(app);
      const invalidConfig = `version: 1
plugins:
  - source: file
    path: ../../plugins/rule-loom-core
  - source: file
    path: ../../plugins/rule-loom-plugin-http
inputs:
  - type: http
    config: {}
    triggers:
      - type: httpRoute
        method: post
        path: /invalid
        flow: invalid-flow
flows:
  - name: invalid-flow
    steps:
      - closure: core.assign
        parameters:
          value: "should fail"
`;

      const validationRes = await request
        .post('/api/runners/validate')
        .send({ configContent: invalidConfig })
        .set('Content-Type', 'application/json');

      expect(validationRes.status).toBe(200);
      expect(validationRes.body.valid).toBe(false);
      expect(validationRes.body.issues.length).toBeGreaterThan(0);
    });
  });
});
