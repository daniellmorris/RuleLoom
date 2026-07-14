const ReactRuntime = (globalThis as any).React as any;
const usePluginApi = (globalThis as any).RuleLoomPluginApi?.usePluginApi as (() => any) | undefined;

function ensureReact() {
  if (!ReactRuntime) {
    console.warn('Sample plugin: React not found on globalThis');
  }
  return ReactRuntime ?? { createElement: () => null };
}

export const SampleSidebarPanel = () => {
  const React = ensureReact();
  const api = usePluginApi?.();
  const selection = api?.selectors.useSelection();
  const flows = api?.selectors.useFlows();
  return React.createElement(
    'div',
    { className: 'panel stack' },
    React.createElement('h3', null, 'Sample Plugin Sidebar'),
    React.createElement('div', { style: { fontSize: 13, color: 'var(--muted)' } }, `Flows: ${flows?.length ?? 0}`),
    React.createElement('div', { style: { fontSize: 13, color: 'var(--muted)' } }, `Selected: ${selection?.selectedNodeId ?? 'None'}`)
  );
};

export const SampleInspectorSection = () => {
  const React = ensureReact();
  const api = usePluginApi?.();
  const selection = api?.selectors.useSelection();
  const activeFlow = api?.selectors.useFlows()[selection?.flowIndex ?? 0];
  return React.createElement(
    'div',
    { className: 'panel stack' },
    React.createElement('h3', null, 'Sample Inspector'),
    React.createElement('div', { style: { fontSize: 13, color: 'var(--muted)' } }, `Active flow: ${activeFlow?.name ?? 'Unknown'}`),
    React.createElement('div', { style: { fontSize: 13, color: 'var(--muted)' } }, `Selected node: ${selection?.selectedNodeId ?? 'None'}`)
  );
};

export const SampleRightRailPanel = () => {
  const React = ensureReact();
  const api = usePluginApi?.();
  const catalog = api?.selectors.useCatalog();
  return React.createElement(
    'div',
    { className: 'panel stack' },
    React.createElement('h3', null, 'Sample Right Rail'),
    React.createElement('div', { style: { fontSize: 13, color: 'var(--muted)' } }, `Closures: ${catalog?.availableClosures.length ?? 0}`)
  );
};

export const SampleCanvasOverlay = ({ nodes = [] }: { nodes?: Array<{ id: string; x: number; y: number }> }) => {
  const React = ensureReact();
  const first = nodes[0];
  if (!first) return null;
  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        left: first.x + 24,
        top: first.y + 24,
        padding: '4px 8px',
        borderRadius: 8,
        background: 'rgba(125,211,252,0.9)',
        color: '#0f172a',
        fontSize: 12,
        fontWeight: 700,
      },
    },
    'Sample'
  );
};

export const SampleValidator = {
  validate({ app }: any) {
    const firstStep = app?.flows?.[0]?.steps?.[0];
    const nodeId = firstStep?.$meta?.id;
    if (!nodeId) return [];
    return [
      {
        id: `sample-validator:${nodeId}`,
        nodeId,
        flowName: app.flows[0].name,
        field: 'sample',
        message: 'Sample plugin warning',
        severity: 'warning',
        kind: 'plugin',
      },
    ];
  },
};

export const SampleTransformer = {
  beforeExport(text: string) {
    return text.includes('# sample-plugin-transformer') ? text : `${text.trimEnd()}\n# sample-plugin-transformer\n`;
  },
  beforeImport(text: string) {
    return text;
  },
};

export default SampleSidebarPanel;
