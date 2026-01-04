import React from 'react';

const MetricWidget: React.FC<{ title?: string; value?: string | number }> = ({ title, value }) => (
  <div className="panel" style={{ minHeight: 80 }}>
    <div style={{ fontWeight: 700 }}>{title ?? 'Metric'}</div>
    {value !== undefined && <div style={{ fontSize: 24, marginTop: 4 }}>{value}</div>}
  </div>
);

export default MetricWidget;
