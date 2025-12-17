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
    /** When true, skip templating/resolution for this parameter value. */
    skipTemplateResolution?: boolean;
    /** Nested parameter definitions for array/object values (e.g., shape of array items or object fields). */
    children?: ClosureParameterDefinition[];
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
    signature?: ClosureSignature;
    /** Optional list of top-level fields this closure claims implicitly when `closure` is absent. */
    implicitFields?: string[];
}
export interface ConditionDefinition {
    closure: string;
    parameters?: Record<string, unknown>;
    negate?: boolean;
}
export interface FlowInvokeStep {
    type?: 'invoke';
    closure?: string;
    parameters?: Record<string, unknown>;
    assign?: string;
    mergeResult?: boolean;
    when?: ConditionDefinition | ConditionDefinition[];
}
export type FlowStep = FlowInvokeStep;
export interface FlowBranchCase {
    when: FlowStep[];
    then: FlowStep[];
}
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
    /** Optional recorder(s) to capture execution events, usable in live runs or simulations. */
    recorder?: Recorder | Recorder[];
    /** Optional recording level to trim payloads ("none" | "timing" | "params" | "state" | "full"). */
    recordLevel?: RecordingLevel;
    [key: string]: unknown;
}
export type RecordingLevel = 'none' | 'timing' | 'params' | 'state' | 'full';
export type RecorderEventKind = 'enter' | 'exit' | 'error';
export interface RecorderEventBase {
    kind: RecorderEventKind;
    flow?: string;
    step?: string;
    closure?: string;
    timestamp: number;
    durationMs?: number;
}
export interface RecorderEnterEvent extends RecorderEventBase {
    kind: 'enter';
    params?: Record<string, unknown>;
    stateBefore?: Record<string, unknown>;
}
export interface RecorderExitEvent extends RecorderEventBase {
    kind: 'exit';
    output?: unknown;
    stateAfter?: Record<string, unknown>;
}
export interface RecorderErrorEvent extends RecorderEventBase {
    kind: 'error';
    error: string;
}
export type RecorderEvent = RecorderEnterEvent | RecorderExitEvent | RecorderErrorEvent;
export interface Recorder {
    onEvent?: (event: RecorderEvent) => void;
}
export declare class RuleLoomEngine {
    private closures;
    private implicitClosures;
    private flows;
    constructor(options?: EngineOptions);
    registerClosure(definition: ClosureDefinition): void;
    registerClosures(definitions: ClosureDefinition[]): void;
    registerFlow(flow: FlowDefinition): void;
    registerFlows(flows: FlowDefinition[]): void;
    getClosure(name: string): ClosureDefinition | undefined;
    getImplicitClosures(): ClosureDefinition[];
    getFlow(name: string): FlowDefinition | undefined;
    execute(flowName: string, initialState?: Record<string, unknown>, runtime?: ExecutionRuntime): Promise<ExecutionResult>;
    runSteps(steps: FlowStep[], state: Record<string, unknown>, runtime: ExecutionRuntime, inheritedParameters?: Record<string, unknown>): Promise<unknown>;
    private isInvokeStep;
    private resolveImplicitClosure;
    private extractParameters;
    private shouldExecute;
    evaluateConditions(conditions: ConditionDefinition | ConditionDefinition[], state: Record<string, unknown>, runtime: ExecutionRuntime): Promise<boolean>;
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