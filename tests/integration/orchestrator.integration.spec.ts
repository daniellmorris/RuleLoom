import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import supertest from 'supertest';
import { describe, it, expect } from 'vitest';

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

describe('RuleLoom Orchestrator', () => {
  it('mounts multiple runner configs under different base paths', async () => {
    await withOrchestrator('orchestrator.yaml', async (app) => {
      const request = supertest(app);

      const branchingRes = await request
        .post('/branch/orders')
        .send({ items: ['A'] })
        .set('Content-Type', 'application/json');
      expect(branchingRes.status).toBe(200);
      expect(branchingRes.body.itemCount).toBe(1);

      const functionalRes = await request
        .post('/func/items')
        .send({ items: ['alpha', 'beta'] })
        .set('Content-Type', 'application/json');
      expect(functionalRes.status).toBe(200);
      expect(functionalRes.body.items).toHaveLength(2);
    });
  });
});
