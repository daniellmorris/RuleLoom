import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect } from 'vitest';
import { createRunner } from '../../packages/rule-loom-runner/src/index.ts';
import { itHttp } from '../helpers/httpSkip.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, 'configs');

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Scheduler integration', () => {
itHttp('executes scheduled flows via Bree', async () => {
    const runner = await createRunner(path.join(CONFIG_DIR, 'scheduler.yaml'));
    try {
      const scheduler = (runner.services as any).scheduler as any;
      expect(scheduler).toBeDefined();
      await delay(1500);
      const jobState = scheduler?.jobStates.get('heartbeat');
      expect(jobState).toBeDefined();
      expect(jobState?.runs ?? 0).toBeGreaterThanOrEqual(1);
    } finally {
      await runner.close();
    }
  });
});
