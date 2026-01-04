import React from 'react';

const ChartWidget: React.FC<{ title?: string }> = ({ title }) => (
  <div className="panel" style={{ minHeight: 140 }}>
    <div style={{ fontWeight: 700 }}>{title ?? 'Chart'}</div>
    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Chart preview</div>
  </div>
);

export default ChartWidget;
