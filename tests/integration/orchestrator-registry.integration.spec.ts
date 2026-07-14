import path from 'node:path';
import { describe, expect } from 'vitest';
import { itHttp } from '../helpers/httpSkip.ts';
import { RunnerRegistry } from '../../packages/rule-loom-orchestrator/src/registry.ts';

const CONFIG_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'configs');

describe('orchestrator runner replacement', () => {
  itHttp('keeps the existing runner alive when replacement validation fails', async () => {
    const registry = new RunnerRegistry({ info: () => {}, error: () => {} } as any);
    const existing = await registry.addRunner({
      id: 'stable',
      configPath: path.join(CONFIG_DIR, 'branching.yaml'),
      basePath: '/stable',
    });
    try {
      await expect(
        registry.updateRunner('stable', {
          configPath: path.join(CONFIG_DIR, 'invalid-missing-param.yaml'),
        }),
      ).rejects.toThrow();
      expect(registry.get('stable')).toBe(existing);
      expect(existing.instance.engine.getFlow('process-order')).toBeDefined();
    } finally {
      await registry.closeAll();
    }
  });
});
