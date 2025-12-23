const ReactRuntime = globalThis.React;
const usePluginApi = globalThis.RuleLoomPluginApi?.usePluginApi;

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

export default SampleSidebarPanel;
