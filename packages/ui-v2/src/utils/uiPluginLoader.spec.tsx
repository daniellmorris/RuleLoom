import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { PuckLayout } from '../types/puckLayout';
import type { UiPluginSource } from '../types/uiPlugin';
import { createComponentRegistry } from './componentRegistry';
import { loadPlugins } from './uiPluginLoader';
import { validateApp } from './validation';
import { applyBeforeExport, applyBeforeImport } from '../components/ImportExport';

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

  it('uses a JS-friendly default base for module imports to avoid MIME errors', async () => {
    const manifest = {
      id: 'sample',
      version: '1.0.0',
      blocks: [{ type: 'sidebar', name: 'SampleBlock', module: 'bundle.js' }]
    };

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify(manifest)) });
    const moduleLoader = vi.fn().mockResolvedValue({ default: () => null });

    const result = await loadPlugins([source], { fetchImpl: fetchMock as any, moduleLoader });

    expect(fetchMock).toHaveBeenCalledWith('https://raw.githubusercontent.com/example/repo/main/plugin/manifest.json');
    expect(moduleLoader).toHaveBeenCalledWith('https://raw.githack.com/example/repo/main/bundle.js');
    expect(result.plugins[0].manifest.id).toBe('sample');
    expect(result.errors.length).toBe(0);
  });

  it('prevents plugin blocks from overriding core blocks', () => {
    const registry = createComponentRegistry();
    const override = () => null;
    expect(() => registry.registerPluginBlocks(
      {
        id: 'override-test',
        version: '0.0.1',
        blocks: [{ type: 'canvas', name: 'Canvas', module: 'override.js' }]
      },
      { 'override.js': { default: override } }
    )).toThrow('cannot replace registered block');
  });

  it('rejects duplicate plugin ids and insecure remote URLs', async () => {
    const registry = createComponentRegistry();
    const manifest = { id: 'duplicate', version: '1.0.0', blocks: [] };
    registry.registerPluginBlocks(manifest, {});
    expect(() => registry.registerPluginBlocks(manifest, {})).toThrow('conflicts with already loaded version');

    await expect(loadPlugins([{ ...source, baseUrl: 'http://plugins.example.com' }], {
      fetchImpl: vi.fn() as any,
    })).rejects.toThrow('must use HTTPS');
  });

  it('registers extension slots and rejects unknown slot types', () => {
    const registry = createComponentRegistry();
    const Panel = () => null;
    const Overlay = () => null;
    const validator = { validate: () => [] };
    const transformer = { beforeExport: (text: string) => `${text}\n# transformed` };

    registry.registerPluginBlocks(
      {
        id: 'extensions-test',
        version: '0.0.1',
        blocks: [
          { type: 'panel', name: 'Panel', module: 'plugin.js', spec: { export: 'Panel', slot: 'right' } },
          { type: 'canvasOverlay', name: 'Overlay', module: 'plugin.js', spec: { export: 'Overlay' } },
          { type: 'validator', name: 'Validator', module: 'plugin.js', spec: { export: 'validator' } },
          { type: 'transformer', name: 'Transformer', module: 'plugin.js', spec: { export: 'transformer' } },
        ]
      },
      { 'plugin.js': { Panel, Overlay, validator, transformer } }
    );

    expect(registry.extensions('panel')[0].value).toBe(Panel);
    expect(registry.extensions('canvasOverlay')[0].value).toBe(Overlay);
    expect(registry.extensions('validator')[0].value).toBe(validator);
    expect(registry.extensions('transformer')[0].value).toBe(transformer);

    expect(() =>
      registry.registerPluginBlocks(
        { id: 'bad-slot', version: '0.0.1', blocks: [{ type: 'unknownSlot', name: 'Bad', module: 'bad.js' }] },
        { 'bad.js': { default: () => null } }
      )
    ).toThrow('unknown UI slot');
  });

  it('merges plugin validator issues and applies import/export transformers', () => {
    const app: any = {
      flows: [{ name: 'Demo', steps: [{ closure: 'core.log', parameters: {}, $meta: { id: 'node-1' } }] }],
      closures: [],
      inputs: []
    };
    const validator = {
      validate: () => [
        {
          id: 'plugin-warning',
          nodeId: 'node-1',
          flowName: 'Demo',
          field: 'plugin',
          message: 'Plugin warning',
          severity: 'warning',
          kind: 'plugin',
        },
      ],
    };
    const result = validateApp(app, { closuresMeta: {}, inputsMeta: {} }, [validator as any]);

    expect(result.byNodeId['node-1'].some((issue) => issue.id === 'plugin-warning')).toBe(true);
    expect(app.flows[0].steps[0].parameters).toEqual({});

    const transformer = {
      beforeExport: (text: string) => `${text.trimEnd()}\n# exported`,
      beforeImport: (text: string) => text.replace('# exported', '# imported'),
    };

    expect(applyBeforeExport('version: 1\n', [transformer], { app })).toContain('# exported');
    expect(applyBeforeImport('version: 1\n# exported', [transformer])).toContain('# imported');
  });

  it('renders plugin panel extensions without adding them to the core layout', () => {
    const registry = createComponentRegistry();
    const PluginPanel = () => <div>Plugin panel mounted</div>;
    registry.registerExtension({
      name: 'PluginPanel',
      type: 'panel',
      pluginId: 'panel-test',
      value: PluginPanel,
      spec: { slot: 'right' }
    });

    const html = renderToString(<App registry={registry} />);

    expect(html).toContain('Plugin panel mounted');
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
