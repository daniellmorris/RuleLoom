import React, { useMemo, useState } from 'react';
import type { PuckLayout } from '../types/puckLayout';

interface DashboardEditorProps {
  layout: PuckLayout;
  onUpdateLayout?: (next: PuckLayout) => void;
}

const DashboardEditor: React.FC<DashboardEditorProps> = ({ layout, onUpdateLayout }) => {
  const initialText = useMemo(() => JSON.stringify(layout, null, 2), [layout]);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Dashboard Layout Editor</h3>
        <button
          className="button secondary"
          onClick={() => {
            try {
              const parsed = JSON.parse(text);
              setError(null);
              onUpdateLayout?.(parsed as PuckLayout);
            } catch (err: any) {
              setError(err?.message ?? 'Invalid JSON');
            }
          }}
        >
          Apply layout
        </button>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <textarea
          className="input"
          style={{ minHeight: 260, fontFamily: 'monospace', fontSize: 12 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        {error && <div style={{ color: '#b00020', fontSize: 12 }}>Error: {error}</div>}
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>
          Tip: you can edit pages/regions/blocks JSON directly. The layout will re-render immediately after apply.
        </div>
      </div>
    </div>
  );
};

export default DashboardEditor;
