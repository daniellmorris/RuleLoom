export interface ClosureContext {
    /** Parameters resolved for the closure invocation. */
    parameters?: Record<string, unknown>;
    /** Mutable state shared across the flow. */
    state: Record<string, unknown>;
    /** Runtime metadata provided when executing the flow (request info, etc.). */
    runtime: ExecutionRuntime;
}
export type ClosureHandler = (state: Record<string, unknown>, context: ClosureContext) => Promise<unknown> | unknown;
export type ClosureParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any' | 'flowSteps';
export interface ClosureParameterDefinition {
    name: string;
    type: ClosureParameterType;
    description?: string;
    required?: boolean;
    allowDynamicValue?: boolean;
    defaultValue?: unknown;
}
export interface ClosureReturnDefinition {
    type: ClosureParameterType | ClosureParameterType[];
    description?: string;
}
export interface ClosureSignature {
    description?: string;
    parameters?: ClosureParameterDefinition[];
    allowAdditionalParameters?: boolean;
    returns?: ClosureReturnDefinition;
    mutates?: string[];
    notes?: string;
}
export interface ClosureDefinition {
    name: string;
    handler: ClosureHandler;
    description?: string;
    metadata?: Record<string, unknown>;
    functionalParams?: Array<{
        name: string;
        mode?: 'single' | 'array';
    }>;
    signature?: ClosureSignature;
}
export interface ConditionDefinition {
    closure: string;
    parameters?: Record<string, unknown>;
    negate?: boolean;
}
export interface FlowInvokeStep {
    type?: 'invoke';
    closure: string;
    parameters?: Record<string, unknown>;
    assign?: string;
    mergeResult?: boolean;
    when?: ConditionDefinition | ConditionDefinition[];
}
export interface FlowBranchCase {
    when: ConditionDefinition | ConditionDefinition[];
    steps: FlowStep[];
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
export interface EngineOptions {
    closures?: ClosureDefinition[];
    flows?: FlowDefinition[];
}
export interface ExecutionResult {
    state: Record<string, unknown>;
    lastResult: unknown;
}
export interface ExecutionRuntime {
    logger?: {
        debug?: (...args: unknown[]) => void;
        info?: (...args: unknown[]) => void;
        warn?: (...args: unknown[]) => void;
        error?: (...args: unknown[]) => void;
    };
    engine?: RuleLoomEngine;
    parameters?: Record<string, unknown>;
    [key: string]: unknown;
}
export declare class RuleLoomEngine {
    private closures;
    private flows;
    constructor(options?: EngineOptions);
    registerClosure(definition: ClosureDefinition): void;
    registerClosures(definitions: ClosureDefinition[]): void;
    registerFlow(flow: FlowDefinition): void;
    registerFlows(flows: FlowDefinition[]): void;
    getClosure(name: string): ClosureDefinition | undefined;
    getFlow(name: string): FlowDefinition | undefined;
    execute(flowName: string, initialState?: Record<string, unknown>, runtime?: ExecutionRuntime): Promise<ExecutionResult>;
    runSteps(steps: FlowStep[], state: Record<string, unknown>, runtime: ExecutionRuntime, inheritedParameters?: Record<string, unknown>): Promise<unknown>;
    private isBranchStep;
    private executeBranch;
    private shouldExecute;
    private evaluateConditions;
    private invokeStep;
    private prepareParameters;
    private resolveClosureReferences;
    private executeCallDirective;
    private executeSingleCall;
}
export default RuleLoomEngine;
export { resolveDynamicValues } from './utils.js';
export type { TemplateContext } from './utils.js';
//# sourceMappingURL=index.d.ts.map