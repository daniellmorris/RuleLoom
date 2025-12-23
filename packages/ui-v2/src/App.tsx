import React, { useMemo } from 'react';
import defaultLayout from './config/layout.default.json';
import { PluginApiProvider } from './state/pluginApi';
import type { LayoutRegionId, PuckBlockDescriptor, PuckLayout, PuckPage } from './types/puckLayout';
import type { ComponentRegistry, RegisteredBlock } from './utils/componentRegistry';

interface AppProps {
  layout?: PuckLayout;
  registry: ComponentRegistry;
  onReloadPlugins?: () => void;
  pluginErrors?: string[];
  reloadingPlugins?: boolean;
  onUpdateLayout?: (next: PuckLayout) => void;
}

interface BlockRendererProps {
  descriptor: PuckBlockDescriptor;
  registry: ComponentRegistry;
  hostProps: BlockHostProps;
}

type BlockHostProps = Pick<AppProps, 'onReloadPlugins' | 'pluginErrors' | 'reloadingPlugins' | 'onUpdateLayout'> & {
  pages: PuckPage[];
  activePageId: string;
  onPageChange?: (pageId: string) => void;
  layout: PuckLayout;
};

const MissingBlock: React.FC<{ descriptor: PuckBlockDescriptor }> = ({ descriptor }) => (
  <div className="panel" style={{ border: '1px dashed var(--muted)', padding: 12 }}>
    <div style={{ fontWeight: 600 }}>Missing block</div>
    <div style={{ color: 'var(--muted)', fontSize: 13 }}>
      Block "{descriptor.name}" is not registered in the component registry.
    </div>
  </div>
);

const BlockRenderer: React.FC<BlockRendererProps> = ({ descriptor, registry, hostProps }) => {
  const registration = registry.resolve(descriptor.name) as RegisteredBlock | undefined;
  if (!registration) return <MissingBlock descriptor={descriptor} />;
  const Component = registration.component as React.ComponentType<any>;
  const props = { ...(descriptor.props ?? {}), ...hostProps };
  return <Component {...props} />;
};

const regionSort = (blocks: PuckBlockDescriptor[]) => [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const groupBlocksBySlot = (blocks: PuckBlockDescriptor[]) => {
  const slots = new Map<string, PuckBlockDescriptor[]>();
  regionSort(blocks).forEach((block) => {
    const slot = block.slot ?? 'default';
    const current = slots.get(slot) ?? [];
    slots.set(slot, [...current, block]);
  });
  return Array.from(slots.entries()).map(([slot, grouped]) => ({ slot, blocks: grouped }));
};

const App: React.FC<AppProps> = ({ layout, registry, onReloadPlugins, pluginErrors, reloadingPlugins, onUpdateLayout }) => {
  const appliedLayout = useMemo<PuckLayout>(() => layout ?? (defaultLayout as PuckLayout), [layout]);
  const pages = useMemo<PuckPage[]>(() => {
    if (Array.isArray(appliedLayout.pages) && appliedLayout.pages.length) return appliedLayout.pages;
    if (Array.isArray(appliedLayout.regions)) {
      return [{ id: 'default', label: 'Main', regions: appliedLayout.regions }];
    }
    return [];
  }, [appliedLayout]);

  const [activePageId, setActivePageId] = React.useState(() => pages[0]?.id ?? 'default');

  React.useEffect(() => {
    if (!pages.find((p) => p.id === activePageId) && pages[0]) {
      setActivePageId(pages[0].id);
    }
  }, [pages, activePageId]);

  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0];
  const regionMap = useMemo(
    () => Object.fromEntries((activePage?.regions ?? []).map((r) => [r.id, r])),
    [activePage]
  );
  const resolveRegionBlocks = (id: LayoutRegionId) => regionSort(regionMap[id]?.blocks ?? []);
  const resolveSlots = (id: LayoutRegionId) => groupBlocksBySlot(regionMap[id]?.blocks ?? []);
  const hostProps = useMemo(
    () => ({
      onReloadPlugins,
      pluginErrors,
      reloadingPlugins,
      onUpdateLayout,
      pages,
      activePageId: activePage?.id ?? 'default',
      onPageChange: setActivePageId,
      layout: appliedLayout
    }),
    [onReloadPlugins, pluginErrors, reloadingPlugins, pages, activePage, appliedLayout, onUpdateLayout]
  );

  return (
    <PluginApiProvider>
      <div className="app-shell">
        <header className="topbar">
          {resolveRegionBlocks('header').map((block) => (
            <BlockRenderer key={block.name} descriptor={block} registry={registry} hostProps={hostProps} />
          ))}
        </header>

        <aside className="rail sidebar">
          <div className="scroll-column">
            <div className="stack">
              {resolveSlots('sidebar').map(({ slot, blocks }) => (
                <React.Fragment key={slot}>
                  {blocks.map((block) => (
                    <BlockRenderer key={`${slot}-${block.name}`} descriptor={block} registry={registry} hostProps={hostProps} />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </aside>

        <main className="canvas-area">
          {resolveSlots('canvas').map(({ slot, blocks }) => (
            <React.Fragment key={slot}>
              {blocks.map((block) => (
                <BlockRenderer key={`${slot}-${block.name}`} descriptor={block} registry={registry} hostProps={hostProps} />
              ))}
            </React.Fragment>
          ))}
        </main>

        <aside className="rail inspector-rail">
          <div className="scroll-column">
            {resolveSlots('inspector').map(({ slot, blocks }) => (
              <React.Fragment key={slot}>
                {blocks.map((block) => (
                  <BlockRenderer key={`${slot}-${block.name}`} descriptor={block} registry={registry} hostProps={hostProps} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </aside>
      </div>
    </PluginApiProvider>
  );
};

export default App;
