import React, { useEffect, useMemo, useState } from 'react';
import { Puck, Render, type Data as PuckData } from '@measured/puck';
import type { ComponentRegistry } from '../utils/componentRegistry';
import { normalizeDataIds } from '../utils/puckLayoutAdapter';
import { useAppStore } from '../state/appStore';
import DashboardList from '../components/DashboardList';
import MetricWidget from '../components/widgets/MetricWidget';
import ChartWidget from '../components/widgets/ChartWidget';
import TableWidget from '../components/widgets/TableWidget';
import '@measured/puck/puck.css';
import type { PuckLayout } from '../types/puckLayout';

interface DashboardsPageProps {
  registry: ComponentRegistry;
  onReloadPlugins?: () => void;
  pluginErrors?: string[];
  reloadingPlugins?: boolean;
}

const DashboardsPage: React.FC<DashboardsPageProps> = ({ registry, onReloadPlugins, pluginErrors, reloadingPlugins }) => {
  const dashboards = useAppStore((s) => s.app.dashboards);
  const flows = useAppStore((s) => s.app.flows);
  const setView = useAppStore((s) => s.setView);
  const setCurrentDashboard = useAppStore((s) => s.setCurrentDashboard);
  const updateDashboardLayout = useAppStore((s) => s.updateDashboardLayout);

  const currentDashboardId =
    dashboards?.config?.currentId ?? dashboards?.config?.defaultId ?? dashboards?.list?.[0]?.id;
  const currentDashboard = dashboards?.list.find((d) => d.id === currentDashboardId);

  const [draft, setDraft] = useState<PuckData>(() => normalizeDataIds(currentDashboard?.layout ?? { content: [] }));
  const [editOpen, setEditOpen] = useState(false);
  const config = useMemo(() => buildDashboardConfig(registry, flows), [registry, flows]);

  useEffect(() => {
    setDraft(normalizeDataIds(currentDashboard?.layout ?? { content: [] }));
  }, [currentDashboard]);

  const resetDraft = () => setDraft(normalizeDataIds(currentDashboard?.layout ?? { content: [] }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gridTemplateRows: '60px 1fr', gap: 12, height: '100vh', padding: 12 }}>
      <div style={{ gridColumn: '1 / span 2' }} className="row">
        <div className="panel row" style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <button className="button secondary" onClick={() => setView('builder')}>
              ← Back to builder
            </button>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Dashboards</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{currentDashboard?.name ?? 'None selected'}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {onReloadPlugins && import.meta.env.DEV && (
              <button className="button secondary" onClick={onReloadPlugins} disabled={reloadingPlugins}>
                {reloadingPlugins ? 'Reloading…' : 'Reload plugins'}
              </button>
            )}
            {pluginErrors && pluginErrors.length > 0 && (
              <span className="badge" style={{ background: '#f3b0a8', color: '#4d0b00' }}>
                Plugin errors: {pluginErrors.length}
              </span>
            )}
          </div>
        </div>
      </div>

      <aside className="panel" style={{ overflow: 'hidden' }}>
        <div className="scroll-column">
          <DashboardList />
        </div>
      </aside>

      <main className="panel stack" style={{ gap: 12, overflow: 'hidden' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{currentDashboard?.name ?? 'Select a dashboard'}</h3>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="button"
              onClick={() => {
                resetDraft();
                setEditOpen(true);
              }}
              disabled={!currentDashboard}
            >
              Edit layout
            </button>
          </div>
        </div>

        <div className="stack" style={{ gap: 12, overflow: 'auto' }}>
          {currentDashboard && (
            <div className="panel">
              <Render config={config} data={normalizeDataIds(currentDashboard.layout)} />
            </div>
          )}
        </div>
      </main>

      {editOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-panel"
            style={{
              maxWidth: '1800px',
              width: '99%',
              maxHeight: '92vh',
              overflow: 'auto'
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Edit dashboard layout</h3>
              <div className="row" style={{ gap: 8 }}>
                <button className="button secondary" onClick={resetDraft}>
                  Reset draft
                </button>
                <button
                  className="button"
                  onClick={() => {
                    const nextLayout = normalizeDataIds(draft);
                    if (currentDashboardId) {
                      updateDashboardLayout(currentDashboardId, nextLayout);
                      setDraft(normalizeDataIds(nextLayout));
                    }
                    setEditOpen(false);
                  }}
                >
                  Publish
                </button>
                <button className="button secondary" onClick={() => setEditOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            <Puck
              config={config}
              data={normalizeDataIds(draft)}
              onChange={(next) => setDraft(normalizeDataIds(next))}
              onPublish={() => {
                const nextLayout = normalizeDataIds(draft);
                if (currentDashboardId) updateDashboardLayout(currentDashboardId, nextLayout);
                setEditOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardsPage;

function buildDashboardConfig(registry: ComponentRegistry, flows: any[]) {
  const layoutNames = ['FlexRow', 'FlexColumn', 'Panel'];
  const widgetNames = ['MetricWidget', 'ChartWidget', 'TableWidget'];
  const allowAll = [...layoutNames, ...widgetNames];

  return {
    components: {
      FlexRow: {
        label: 'Row',
        fields: {
          gap: { type: 'number', label: 'Gap', optional: true },
          align: {
            type: 'select',
            label: 'Align Items',
            options: [
              { label: 'Start', value: 'start' },
              { label: 'Center', value: 'center' },
              { label: 'End', value: 'end' },
              { label: 'Stretch', value: 'stretch' }
            ],
            optional: true
          },
          justify: {
            type: 'select',
            label: 'Justify',
            options: [
              { label: 'Start', value: 'start' },
              { label: 'Center', value: 'center' },
              { label: 'End', value: 'end' },
              { label: 'Space Between', value: 'between' },
              { label: 'Space Around', value: 'around' }
            ],
            optional: true
          },
          children: { type: 'slot', label: 'Children', allow: allowAll }
        },
        render: ({ gap = 12, align = 'stretch', justify = 'start', children: Children }: any) => (
          <Children
            allow={allowAll}
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap,
              alignItems: align === 'stretch' ? 'stretch' : align,
              justifyContent:
                justify === 'between'
                  ? 'space-between'
                  : justify === 'around'
                  ? 'space-around'
                  : justify === 'center'
                  ? 'center'
                  : justify === 'end'
                  ? 'flex-end'
                  : 'flex-start',
              flexWrap: 'wrap',
              width: '100%'
            }}
          />
        )
      },
      FlexColumn: {
        label: 'Column',
        fields: {
          gap: { type: 'number', label: 'Gap', optional: true },
          align: {
            type: 'select',
            label: 'Align Items',
            options: [
              { label: 'Start', value: 'start' },
              { label: 'Center', value: 'center' },
              { label: 'End', value: 'end' },
              { label: 'Stretch', value: 'stretch' }
            ],
            optional: true
          },
          justify: {
            type: 'select',
            label: 'Justify',
            options: [
              { label: 'Start', value: 'start' },
              { label: 'Center', value: 'center' },
              { label: 'End', value: 'end' },
              { label: 'Space Between', value: 'between' },
              { label: 'Space Around', value: 'around' }
            ],
            optional: true
          },
          children: { type: 'slot', label: 'Children', allow: allowAll }
        },
        render: ({ gap = 12, align = 'stretch', justify = 'start', children: Children }: any) => (
          <Children
            allow={allowAll}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap,
              alignItems: align === 'stretch' ? 'stretch' : align,
              justifyContent:
                justify === 'between'
                  ? 'space-between'
                  : justify === 'around'
                  ? 'space-around'
                  : justify === 'center'
                  ? 'center'
                  : justify === 'end'
                  ? 'flex-end'
                  : 'flex-start',
              width: '100%'
            }}
          />
        )
      },
      Panel: {
        label: 'Panel',
        fields: {
          title: { type: 'text', label: 'Title', optional: true },
          children: { type: 'slot', label: 'Children', allow: allowAll }
        },
        render: ({ title, children: Children }: any) => (
          <div className="panel stack" style={{ gap: 8 }}>
            {title && <div style={{ fontWeight: 700 }}>{title}</div>}
            <Children allow={allowAll} />
          </div>
        )
      },
      MetricWidget: {
        label: 'Metric',
        fields: {
          title: { type: 'text', label: 'Title' },
          value: { type: 'text', label: 'Value', optional: true }
        },
        render: ({ title, value }: any) => <MetricWidget title={title} value={value} />
      },
      ChartWidget: {
        label: 'Chart',
        fields: {
          title: { type: 'text', label: 'Title' }
        },
        render: ({ title }: any) => <ChartWidget title={title} />
      },
      TableWidget: {
        label: 'Table',
        fields: {
          title: { type: 'text', label: 'Title' },
          endpoint: { type: 'text', label: 'Endpoint URL', optional: true },
          columns: { type: 'text', label: 'Columns (comma-separated, optional)', optional: true },
          data: { type: 'textarea', label: 'Data JSON fallback (columns, rows)', optional: true }
        },
        render: ({ title, data, endpoint, columns }: any) => (
          <TableWidget title={title} data={data} endpoint={endpoint} columns={columns} />
        )
      }
    }
  };
}
