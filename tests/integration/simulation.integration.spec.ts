import { describe, expect, it, vi } from 'vitest';
import RuleLoomEngine from 'rule-loom-engine';

describe('safe simulation', () => {
  it('runs pure closures and blocks undeclared side effects', async () => {
    const sideEffect = vi.fn(() => 'sent');
    const engine = new RuleLoomEngine({
      closures: [
        { name: 'pure.value', capabilities: ['pure'], handler: () => 42 },
        { name: 'network.send', capabilities: ['network'], handler: sideEffect },
      ],
      flows: [
        { name: 'pure-flow', steps: [{ closure: 'pure.value' }] },
        { name: 'network-flow', steps: [{ closure: 'network.send' }] },
      ],
    });

    await expect(engine.simulate('pure-flow')).resolves.toMatchObject({ lastResult: 42 });
    await expect(engine.simulate('network-flow')).rejects.toThrow(/Simulation blocked closure/);
    expect(sideEffect).not.toHaveBeenCalled();
  });

  it('uses an explicit simulator instead of the live handler', async () => {
    const live = vi.fn(() => 'live');
    const simulate = vi.fn(() => 'simulated');
    const engine = new RuleLoomEngine({
      closures: [{ name: 'network.send', capabilities: ['network'], handler: live, simulate }],
      flows: [{ name: 'flow', steps: [{ closure: 'network.send' }] }],
    });

    await expect(engine.simulate('flow')).resolves.toMatchObject({ lastResult: 'simulated' });
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(live).not.toHaveBeenCalled();
  });
});
