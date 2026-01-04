import React from 'react';
import { useAppStore } from '../state/appStore';
import type { PuckLayout } from '../types/puckLayout';

const DashboardList: React.FC = () => {
  const dashboards = useAppStore((s) => s.app.dashboards);
  const setCurrentDashboard = useAppStore((s) => s.setCurrentDashboard);
  const addDashboard = useAppStore((s) => s.addDashboard);
  const updateDashboardLayout = useAppStore((s) => s.updateDashboardLayout);
  const currentId = dashboards?.config?.currentId ?? dashboards?.config?.defaultId;

  const handleAdd = () => {
    const name = prompt('Dashboard name?');
    if (!name) return;
    addDashboard(name);
  };

  const handleDuplicate = (id: string) => {
    const dash = dashboards?.list.find((d) => d.id === id);
    if (!dash) return;
    const name = prompt('New dashboard name?', `${dash.name} Copy`);
    if (!name) return;
    const copyLayout = JSON.parse(JSON.stringify(dash.layout)) as PuckLayout;
    addDashboard(name, copyLayout);
  };

  const handleReset = (id: string) => {
    updateDashboardLayout(id, {
      version: 1,
      regions: [
        {
          id: 'canvas',
          blocks: [{ name: 'DashboardGrid', props: { widgets: [] } }]
        }
      ]
    });
  };

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Dashboards</h3>
        <button className="button secondary" onClick={handleAdd}>
          New
        </button>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {(dashboards?.list ?? []).map((d) => {
          const isActive = d.id === currentId;
          return (
            <div
              key={d.id}
              className="row"
              style={{
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                background: isActive ? 'var(--bg-panel)' : 'transparent',
                cursor: 'pointer'
              }}
              onClick={() => setCurrentDashboard(d.id)}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>{d.name}</span>
                {d.description && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{d.description}</span>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="button secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate(d.id);
                  }}
                >
                  Duplicate
                </button>
                <button
                  className="button secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset(d.id);
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          );
        })}
        {(dashboards?.list?.length ?? 0) === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>No dashboards yet. Create one to get started.</div>
        )}
      </div>
    </div>
  );
};

export default DashboardList;
