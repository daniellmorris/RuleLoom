import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import RuleLoomEngine from 'rule-loom-engine';
import { initializeInputs } from '../../packages/rule-loom-runner/src/inputPlugins.js';
import { registerInputPlugin, resetInputPlugins } from '../../packages/rule-loom-runner/src/pluginApi.js';

describe('input initialization', () => {
  it('cleans up initialized inputs when a later input fails', async () => {
    resetInputPlugins();
    const cleanup = vi.fn();
    registerInputPlugin({
      type: 'first',
      schema: {},
      initialize: () => ({ cleanup }),
    });
    registerInputPlugin({
      type: 'second',
      schema: {},
      initialize: () => {
        throw new Error('second failed');
      },
    });

    await expect(
      initializeInputs(
        [{ type: 'first' }, { type: 'second' }],
        new RuleLoomEngine(),
        {} as any,
        undefined,
        undefined,
        new EventEmitter(),
      ),
    ).rejects.toThrow('second failed');
    expect(cleanup).toHaveBeenCalledTimes(1);
    resetInputPlugins();
  });
});
