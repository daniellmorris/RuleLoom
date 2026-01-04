import React, { useEffect, useMemo, useState } from 'react';
import { Puck, type Data as PuckData } from '@measured/puck';
import type { ComponentRegistry } from '../utils/componentRegistry';
import type { PuckLayout } from '../types/puckLayout';
import { buildPuckConfig, layoutToPuckData, puckDataToLayout, normalizeDataIds } from '../utils/puckLayoutAdapter';
import '@measured/puck/puck.css';

interface PuckLayoutEditorProps {
  layout: PuckLayout;
  registry: ComponentRegistry;
  onUpdateLayout?: (next: PuckLayout) => void;
  open?: boolean;
  onClose?: () => void;
}

const PuckLayoutEditor: React.FC<PuckLayoutEditorProps> = ({ layout, registry, onUpdateLayout, open = true, onClose }) => {
  const [draft, setDraft] = useState<PuckData>(() => layoutToPuckData(layout));
  const [status, setStatus] = useState<'clean' | 'dirty'>('clean');

  const config = useMemo(() => buildPuckConfig(registry), [registry]);

  useEffect(() => {
    if (open) {
      setDraft(layoutToPuckData(layout));
      setStatus('clean');
    }
  }, [open, layout]);

  const handlePublish = () => {
    const nextLayout = puckDataToLayout(draft);
    onUpdateLayout?.(nextLayout);
    setStatus('clean');
  };

  const handleReset = () => {
    setDraft(layoutToPuckData(layout));
    setStatus('clean');
  };

  if (!open) {
    return (
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Layout editor</h3>
          <button
            className="button"
            onClick={() => {
              setDraft(layoutToPuckData(layout));
              setStatus('clean');
            }}
          >
            Prime editor
          </button>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Use the header button to open the editor.</div>
      </div>
    );
  }

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Layout editor (Puck)</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="button secondary" onClick={handleReset} disabled={status === 'clean'}>
            Reset
          </button>
          <button className="button" onClick={handlePublish}>
            Publish layout
          </button>
          {onClose && (
            <button className="button secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <Puck
          config={config}
          data={normalizeDataIds(draft)}
          onChange={(next) => {
            setDraft(normalizeDataIds(next));
            setStatus('dirty');
          }}
          onPublish={handlePublish}
        />
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>
          Drag blocks into regions. Block options reflect the loaded plugin/component registry.
        </div>
      </div>
    </div>
  );
};

export default PuckLayoutEditor;
