import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { createRunner } from '../../packages/tree-exe-runner/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, 'configs');

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Scheduler integration', () => {
  it('executes scheduled flows via Bree', async () => {
    const runner = await createRunner(path.join(CONFIG_DIR, 'scheduler.yaml'));
    try {
      await runner.listen();
      const scheduler = runner.scheduler;
      expect(scheduler).toBeDefined();
      await delay(1500);
      const jobState = scheduler?.jobStates.get('heartbeat');
      expect(jobState).toBeDefined();
      expect(jobState?.runs ?? 0).toBeGreaterThanOrEqual(1);
      expect(jobState?.lastResult?.state.lastHeartbeat).toBe('heartbeat');
    } finally {
      await runner.close();
    }
  });
});
