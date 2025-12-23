import React, { useMemo, useState } from 'react';
import { Puck, type Data as PuckData } from '@measured/puck';
import type { ComponentRegistry } from '../utils/componentRegistry';
import type { PuckLayout } from '../types/puckLayout';
import { buildPuckConfig, layoutToPuckData, puckDataToLayout } from '../utils/puckLayoutAdapter';
import '@measured/puck/puck.css';

interface PuckLayoutEditorProps {
  layout: PuckLayout;
  registry: ComponentRegistry;
  onUpdateLayout?: (next: PuckLayout) => void;
}

const PuckLayoutEditor: React.FC<PuckLayoutEditorProps> = ({ layout, registry, onUpdateLayout }) => {
  const [draft, setDraft] = useState<PuckData>(() => layoutToPuckData(layout));
  const [status, setStatus] = useState<'clean' | 'dirty'>('clean');

  const config = useMemo(() => buildPuckConfig(registry), [registry]);

  const handlePublish = () => {
    const nextLayout = puckDataToLayout(draft);
    onUpdateLayout?.(nextLayout);
    setStatus('clean');
  };

  const handleReset = () => {
    setDraft(layoutToPuckData(layout));
    setStatus('clean');
  };

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
        </div>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <Puck
          config={config}
          data={draft}
          onChange={(next) => {
            setDraft(next);
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
