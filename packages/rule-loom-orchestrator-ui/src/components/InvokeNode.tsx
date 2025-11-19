import { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';

type InvokeNodeData = {
  label: string;
  showParamHandle?: boolean;
};

function InvokeNode({ data }: NodeProps<InvokeNodeData>) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
      {data.showParamHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id="param"
          style={{ background: 'var(--mantine-color-yellow-6)' }}
        />
      )}
    </>
  );
}

export default memo(InvokeNode);
