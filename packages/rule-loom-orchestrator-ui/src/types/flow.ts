export type FlowConditionClause = {
  closure: string;
  parameters?: Record<string, unknown>;
  negate?: boolean;
};

export type FlowCondition = FlowConditionClause | FlowConditionClause[];

export interface FlowInvokeStep {
  type?: 'invoke';
  closure: string;
  parameters?: Record<string, unknown>;
  assign?: string;
  mergeResult?: boolean;
  when?: FlowCondition;
}

export interface FlowBranchCase {
  when: FlowStep[];
  then: FlowStep[];
}

export interface FlowBranchStep {
  type: 'branch';
  cases: FlowBranchCase[];
  otherwise?: FlowStep[];
}

export type FlowStep = FlowInvokeStep | FlowBranchStep;

export interface FlowDefinition {
  name: string;
  description?: string;
  steps: FlowStep[];
}

export interface ClosureDefinition {
  type: string;
  name?: string;
  description?: string;
  template?: string;
  module?: string;
  steps?: FlowStep[];
  metadata?: Record<string, unknown>;
}
