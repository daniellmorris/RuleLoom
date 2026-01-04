import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import layoutConfig from './config/layout.default.json';
import pluginSourcesConfig from './config/plugins.json';
import type { PuckLayout } from './types/puckLayout';
import type { UiPluginSource } from './types/uiPlugin';
import { createComponentRegistry } from './utils/componentRegistry';
import { loadPlugins } from './utils/uiPluginLoader';
import './styles/global.css';
import DashboardsPage from './views/DashboardsPage';
import { useAppStore } from './state/appStore';

(globalThis as any).React = (globalThis as any).React ?? React;
(globalThis as any).ReactDOM = (globalThis as any).ReactDOM ?? ReactDOM;

const Host: React.FC = () => {
  const [layout, setLayout] = useState<PuckLayout>(layoutConfig as PuckLayout);
  const [sources, setSources] = useState<UiPluginSource[]>(pluginSourcesConfig as UiPluginSource[]);
  const [registry, setRegistry] = useState(() => createComponentRegistry());
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [pluginErrors, setPluginErrors] = useState<string[]>([]);
  const view = useAppStore((s) => s.app.view ?? 'builder');

  const reloadPlugins = useCallback(async () => {
    setLoadingPlugins(true);
    const nextRegistry = createComponentRegistry();

    try {
      if (sources.length) {
        const result = await loadPlugins(sources);
        result.plugins.forEach((plugin) => nextRegistry.registerPluginBlocks(plugin.manifest, plugin.modules));
        setPluginErrors(result.errors);
      } else {
        setPluginErrors([]);
      }
    } catch (err) {
      console.error('Unexpected plugin load failure', err);
      setPluginErrors(['Unexpected plugin load failure']);
    } finally {
      setRegistry(nextRegistry);
      setLoadingPlugins(false);
    }
  }, [sources]);

  useEffect(() => {
    reloadPlugins();
  }, [reloadPlugins]);

  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept('./config/plugins.json', (mod) => {
        setSources(mod?.default as UiPluginSource[]);
      });
    }
  }, []);

  return (
    view === 'dashboards' ? (
      <DashboardsPage registry={registry} onReloadPlugins={reloadPlugins} pluginErrors={pluginErrors} reloadingPlugins={loadingPlugins} />
    ) : (
      <App
        layout={layout}
        registry={registry}
        onReloadPlugins={reloadPlugins}
        pluginErrors={pluginErrors}
        reloadingPlugins={loadingPlugins}
        onUpdateLayout={setLayout}
      />
    )
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Host />
  </React.StrictMode>
);
