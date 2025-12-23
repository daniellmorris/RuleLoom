export type NodeKind = "input" | "branch" | "closure" | "start";

export type ConnectorDirection = "prev" | "next" | "dynamic" | "param";

export interface Connector {
  id: string;
  label: string;
  direction: ConnectorDirection;
}

export interface NodeData {
  schema?: Record<string, unknown>;
  pluginId?: string;
  closureName?: string;
  callTarget?: string;
  params?: Record<string, unknown>;
  paramCalls?: Record<string, boolean>;
  config?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  configParameters?: Array<{ name: string; type?: string; required?: boolean; description?: string; properties?: any; items?: any; enum?: string[] }>;
  triggerParameters?: Array<{ name: string; type?: string; required?: boolean; description?: string; properties?: any; items?: any; enum?: string[] }>;
  ui?: { x?: number; y?: number; w?: number; h?: number; color?: string; collapsed?: boolean };
  branchRules?: Array<{ label: string; condition: string }>;
  description?: string;
  parametersMeta?: Array<{ name: string; type?: string; required?: boolean; description?: string }>;
  closureParameters?: string[];
}

export interface Node {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  connectors: Connector[];
  data?: NodeData;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: "control" | "branch" | "param";
}

export interface Flow {
  id: string;
  name: string;
  entryId: string;
  nodes: Node[];
  edges: Edge[];
  kind?: "flow" | "closure";
}

export * from './puckLayout';
export * from './uiPlugin';
