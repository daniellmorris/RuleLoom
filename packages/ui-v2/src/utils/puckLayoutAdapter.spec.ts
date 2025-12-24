import { describe, expect, it } from 'vitest';
import { createComponentRegistry } from './componentRegistry';
import { buildPuckConfig, layoutToPuckData, puckDataToLayout } from './puckLayoutAdapter';

const sampleLayout = {
  version: 1,
  regions: [
    {
      id: 'sidebar',
      label: 'Sidebar',
      blocks: [
        { name: 'Palette', slot: 'primary', order: 1, props: { title: 'Palette' } },
        { name: 'ImportExport', order: 2 }
      ]
    }
  ]
};

describe('puck layout adapter', () => {
  it('round-trips layout to puck data and back', () => {
    const data = layoutToPuckData(sampleLayout as any);
    const roundTripped = puckDataToLayout(data);

    expect(roundTripped.regions?.[0].id).toBe('sidebar');
    expect(roundTripped.regions?.[0].blocks[0].name).toBe('Palette');
    expect(roundTripped.regions?.[0].blocks[0].props?.title).toBe('Palette');
  });

  it('builds config options from registry entries', () => {
    const registry = createComponentRegistry();
    const config = buildPuckConfig(registry);
    expect((config.components as any).Palette).toBeTruthy();
  });
});
