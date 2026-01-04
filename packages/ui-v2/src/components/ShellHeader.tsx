import React from 'react';
import { useFlowStore } from '../state/flowStore';
import { useAppStore } from '../state/appStore';

interface ShellHeaderProps {
  onReloadPlugins?: () => void;
  reloadingPlugins?: boolean;
  pluginErrors?: string[];
  onOpenLayoutEditor?: () => void;
}

const ShellHeader: React.FC<ShellHeaderProps> = ({ onReloadPlugins, reloadingPlugins, pluginErrors, onOpenLayoutEditor }) => {
  const app = useAppStore((s) => s.app);
  const addFlow = useAppStore((s) => s.addFlow);
  const addClosure = useAppStore((s) => s.addClosure);
  const renameFlow = useAppStore((s) => s.renameFlow);
  const renameClosure = useAppStore((s) => s.renameClosure);
  const removeFlow = useAppStore((s) => s.removeFlow);
  const removeClosure = useAppStore((s) => s.removeClosure);
  const setView = useAppStore((s) => s.setView);
  const mode = useFlowStore((s) => s.activeMode);
  const activeFlowIdx = useFlowStore((s) => s.activeFlowId);
  const activeClosureIdx = useFlowStore((s) => s.activeClosureId);
  const setActiveFlow = useFlowStore((s) => s.setActiveFlow);
  const setActiveClosure = useFlowStore((s) => s.setActiveClosure);
  const setMode = useFlowStore((s) => s.setActiveMode);

  const items = mode === 'flow' ? app.flows : app.closures;
  const activeIdx = mode === 'flow' ? activeFlowIdx : activeClosureIdx;

  return (
    <>
      <div className="brand">Orchestrator UI v3</div>
      <div className="segmented fancy">
        <button className={mode === 'flow' ? 'seg-active' : ''} onClick={() => setMode('flow')}>Flows</button>
        <button className={mode === 'closure' ? 'seg-active' : ''} onClick={() => setMode('closure')}>Closures</button>
      </div>
      <div className="selector-row">
        <select
          className="input"
          value={Math.min(activeIdx, Math.max(items.length - 1, 0))}
          onChange={(e) => {
            const idx = Number(e.target.value);
            if (mode === 'flow') setActiveFlow(idx);
            else setActiveClosure(idx);
          }}
        >
          {items.length === 0 && <option value={0}>None</option>}
          {items.map((f: any, idx: number) => (
            <option key={idx} value={idx}>{f.name ?? `Item ${idx + 1}`}</option>
          ))}
        </select>
        <div className="row" style={{ gap: 6 }}>
          <button
            className="button secondary"
            style={{ padding: '10px 10px' }}
            onClick={() => {
              const name = prompt('Rename', items[activeIdx]?.name ?? '');
              if (!name) return;
              if (mode === 'flow') renameFlow(activeIdx, name);
              else renameClosure(activeIdx, name);
            }}
            disabled={!items.length}
          >
            Rename
          </button>
          <button
            className="button secondary"
            style={{ padding: '10px 10px' }}
            onClick={() => {
              if (!items.length) return;
              if (!confirm('Delete this item?')) return;
              if (mode === 'flow') {
                removeFlow(activeIdx);
                setActiveFlow(Math.max(0, activeIdx - 1));
              } else {
                removeClosure(activeIdx);
                setActiveClosure(Math.max(0, activeIdx - 1));
              }
            }}
            disabled={!items.length}
          >
            Delete
          </button>
        </div>
        <button
          className="button"
          onClick={() => {
            if (mode === 'flow') {
              addFlow(`Flow ${app.flows.length + 1}`);
              setActiveFlow(app.flows.length);
            } else {
              addClosure(`Closure ${app.closures.length + 1}`);
              setActiveClosure(app.closures.length);
            }
          }}
        >
          + {mode === 'flow' ? 'Flow' : 'Closure'}
        </button>
        {onReloadPlugins && import.meta.env.DEV && (
          <button
            className="button secondary"
            style={{ padding: '10px 10px' }}
            onClick={() => onReloadPlugins?.()}
            disabled={Boolean(reloadingPlugins)}
            title="Reload UI plugins from plugins.json"
          >
            {reloadingPlugins ? 'Reloading plugins...' : 'Reload plugins'}
          </button>
        )}
        {pluginErrors?.length ? (
          <span className="badge" style={{ background: '#f3b0a8', color: '#4d0b00' }}>
            Plugin errors: {pluginErrors.length}
          </span>
        ) : null}
        <button className="button secondary" onClick={() => setView('dashboards')}>
          Dashboards
        </button>
        <button className="button secondary" onClick={onOpenLayoutEditor}>
          Open layout editor
        </button>
      </div>
    </>
  );
};

export default ShellHeader;
