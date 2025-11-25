export type NodeKind = "input" | "branch" | "closure";

export type ConnectorDirection = "prev" | "next" | "dynamic";

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
  branchRules?: Array<{ label: string; condition: string }>;
  description?: string;
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
}
