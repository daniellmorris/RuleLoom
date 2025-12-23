import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { PuckLayout } from '../types/puckLayout';
import type { UiPluginSource } from '../types/uiPlugin';
import { createComponentRegistry } from './componentRegistry';
import { loadPlugins } from './uiPluginLoader';

const source: UiPluginSource = {
  repo: 'example/repo',
  ref: 'main',
  manifest: 'plugin/manifest.json'
};

describe('ui plugin loader', () => {
  it('fetches and parses manifests and modules', async () => {
    const manifest = {
      id: 'sample',
      version: '1.0.0',
      blocks: [
        { type: 'sidebar', name: 'SampleBlock', module: 'bundle.js' },
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify(manifest)) });
    const moduleLoader = vi.fn().mockResolvedValue({ default: () => null });

    const result = await loadPlugins([source], { fetchImpl: fetchMock as any, moduleLoader, rawBaseUrl: 'https://raw.test' });

    expect(fetchMock).toHaveBeenCalledWith('https://raw.test/example/repo/main/plugin/manifest.json');
    expect(moduleLoader).toHaveBeenCalledWith('https://raw.test/example/repo/main/bundle.js');
    expect(result.plugins[0].manifest.id).toBe('sample');
    expect(result.errors.length).toBe(0);
  });

  it('allows plugin blocks to override core blocks in the registry', () => {
    const registry = createComponentRegistry();
    const override = () => null;
    registry.registerPluginBlocks(
      {
        id: 'override-test',
        version: '0.0.1',
        blocks: [{ type: 'canvas', name: 'Canvas', module: 'override.js' }]
      },
      { 'override.js': { default: override } }
    );

    expect(registry.resolve('Canvas')?.component).toBe(override);
  });

  it('loads manifests and modules from npm-installed plugins', async () => {
    const manifest = {
      id: 'npm-sample',
      version: '1.0.0',
      blocks: [{ type: 'sidebar', name: 'SampleBlock', module: 'bundle.js' }]
    };

    const sourceNpm: UiPluginSource = {
      kind: 'npm',
      package: '@acme/ui-plugin',
      manifest: 'dist/manifest.json',
      moduleBase: 'dist'
    };

    const moduleLoader = vi.fn(async (spec: string) => {
      if (spec === '@acme/ui-plugin/dist/manifest.json') return { default: manifest };
      if (spec === '@acme/ui-plugin/dist/bundle.js') {
        return { default: () => null };
      }
      throw new Error(`Unexpected spec ${spec}`);
    });

    const result = await loadPlugins([sourceNpm], { moduleLoader });

    expect(moduleLoader).toHaveBeenCalledWith('@acme/ui-plugin/dist/manifest.json');
    expect(result.plugins[0].manifest.id).toBe('npm-sample');
    expect(result.errors.length).toBe(0);
  });

  it('renders a missing block fallback when the registry cannot resolve a block', () => {
    const layout: PuckLayout = {
      version: 1,
      regions: [
        { id: 'header', blocks: [{ name: 'ShellHeader' }] },
        { id: 'sidebar', blocks: [{ name: 'GhostBlock' }] },
        { id: 'canvas', blocks: [{ name: 'Canvas' }] },
        { id: 'inspector', blocks: [] }
      ]
    };

    const html = renderToString(
      <App registry={createComponentRegistry()} layout={layout} />
    );

    expect(html).toContain('Missing block');
    expect(html).toContain('GhostBlock');
  });

  it('renders the first page when layout declares pages', () => {
    const layout: PuckLayout = {
      version: 1,
      pages: [
        {
          id: 'main',
          label: 'Main',
          regions: [
            { id: 'header', blocks: [{ name: 'ShellHeader' }] },
            { id: 'sidebar', blocks: [] },
            { id: 'canvas', blocks: [{ name: 'Canvas' }] },
            { id: 'inspector', blocks: [] }
          ]
        }
      ]
    };

    const html = renderToString(<App registry={createComponentRegistry()} layout={layout} />);
    expect(html).toContain('Orchestrator UI v3');
  });
});
