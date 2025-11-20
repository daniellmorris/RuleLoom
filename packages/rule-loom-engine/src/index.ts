import _ from 'lodash';
import { resolveDynamicValues, type TemplateContext } from './utils.js';

export interface ClosureContext {
  /** Parameters resolved for the closure invocation. */
  parameters?: Record<string, unknown>;
  /** Mutable state shared across the flow. */
  state: Record<string, unknown>;
  /** Runtime metadata provided when executing the flow (request info, etc.). */
  runtime: ExecutionRuntime;
}

export type ClosureHandler = (
  state: Record<string, unknown>,
  context: ClosureContext,
) => Promise<unknown> | unknown;

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
  functionalParams?: Array<{ name: string; mode?: 'single' | 'array' }>;
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

export class RuleLoomEngine {
  private closures = new Map<string, ClosureDefinition>();
  private flows = new Map<string, FlowDefinition>();

  constructor(options?: EngineOptions) {
    if (options?.closures) {
      this.registerClosures(options.closures);
    }
    if (options?.flows) {
      this.registerFlows(options.flows);
    }
  }

  registerClosure(definition: ClosureDefinition): void {
    if (this.closures.has(definition.name)) {
      throw new Error(`Closure named "${definition.name}" is already registered.`);
    }
    this.closures.set(definition.name, definition);
  }

  registerClosures(definitions: ClosureDefinition[]): void {
    for (const def of definitions) {
      this.registerClosure(def);
    }
  }

  registerFlow(flow: FlowDefinition): void {
    if (this.flows.has(flow.name)) {
      throw new Error(`Flow named "${flow.name}" is already registered.`);
    }
    this.flows.set(flow.name, flow);
  }

  registerFlows(flows: FlowDefinition[]): void {
    for (const flow of flows) {
      this.registerFlow(flow);
    }
  }

  getClosure(name: string): ClosureDefinition | undefined {
    return this.closures.get(name);
  }

  getFlow(name: string): FlowDefinition | undefined {
    return this.flows.get(name);
  }

  async execute(
    flowName: string,
    initialState: Record<string, unknown> = {},
    runtime: ExecutionRuntime = {},
  ): Promise<ExecutionResult> {
    const flow = this.flows.get(flowName);
    if (!flow) {
      throw new Error(`Flow "${flowName}" is not registered.`);
    }

    const state: Record<string, unknown> = _.cloneDeep(initialState);
    runtime.engine = runtime.engine ?? this;

    const lastResult = await this.runSteps(flow.steps, state, runtime);
    return { state, lastResult };
  }

  async runSteps(
    steps: FlowStep[],
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
    inheritedParameters?: Record<string, unknown>,
  ): Promise<unknown> {
    let result: unknown;
    for (const step of steps) {
      if (this.isBranchStep(step)) {
        result = await this.executeBranch(step, state, runtime, inheritedParameters);
        continue;
      }

      if (!(await this.shouldExecute(step, state, runtime))) {
        continue;
      }

      result = await this.invokeStep(step, state, runtime, inheritedParameters);
    }
    return result;
  }

  private isBranchStep(step: FlowStep): step is FlowBranchStep {
    const record = step as unknown as Record<string, unknown>;
    return Array.isArray((record as any).cases) && !('closure' in record);
  }

  private async executeBranch(
    step: FlowBranchStep,
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
    inheritedParameters?: Record<string, unknown>,
  ): Promise<unknown> {
    for (const branchCase of step.cases) {
      const shouldRun = await this.evaluateConditions(branchCase.when, state, runtime);
      if (shouldRun) {
        return this.runSteps(branchCase.steps, state, runtime, inheritedParameters);
      }
    }

    if (step.otherwise) {
      return this.runSteps(step.otherwise, state, runtime, inheritedParameters);
    }

    return undefined;
  }

  private async shouldExecute(
    step: FlowInvokeStep,
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
  ): Promise<boolean> {
    if (!step.when) {
      return true;
    }
    return this.evaluateConditions(step.when, state, runtime);
  }

  private async evaluateConditions(
    conditions: ConditionDefinition | ConditionDefinition[],
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
  ): Promise<boolean> {
    const list = Array.isArray(conditions) ? conditions : [conditions];
    for (const condition of list) {
      const closure = this.closures.get(condition.closure);
      if (!closure) {
        throw new Error(`Condition closure "${condition.closure}" is not registered.`);
      }

      const resolvedParameters = await this.prepareParameters(
        closure,
        condition.parameters,
        state,
        runtime,
      );

      const context: ClosureContext = {
        parameters: resolvedParameters,
        state,
        runtime,
      };

      const result = await closure.handler(state, context);
      const truthy = Boolean(result);
      if (condition.negate ? truthy : !truthy) {
        return false;
      }
    }
    return true;
  }

  private async invokeStep(
    step: FlowInvokeStep,
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
    inheritedParameters?: Record<string, unknown>,
  ): Promise<unknown> {
    const closure = this.closures.get(step.closure);
    if (!closure) {
      throw new Error(`Closure "${step.closure}" is not registered.`);
    }

    const parameterSeed = inheritedParameters
      ? { ...(inheritedParameters ?? {}), ...(step.parameters ?? {}) }
      : step.parameters;

    const resolvedParameters = await this.prepareParameters(closure, parameterSeed, state, runtime);

    const context: ClosureContext = {
      parameters: resolvedParameters,
      state,
      runtime,
    };

    const result = await closure.handler(state, context);

    if (step.assign) {
      _.set(state, step.assign, result);
    } else if (step.mergeResult && _.isPlainObject(result)) {
      _.merge(state, result as Record<string, unknown>);
    }

    return result;
  }

  private async prepareParameters(
    closure: ClosureDefinition,
    rawParameters: Record<string, unknown> | undefined,
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
  ): Promise<Record<string, unknown> | undefined> {
    if (!rawParameters) {
      return undefined;
    }

    let working = _.cloneDeep(rawParameters);
    const reserved: Record<string, unknown> = {};

    if (closure.functionalParams && working) {
      for (const spec of closure.functionalParams) {
        if (spec.name in working) {
          reserved[spec.name] = working[spec.name];
          delete working[spec.name];
        }
      }
    }

    const templateContext: TemplateContext = {
      state,
      runtime,
      parameters: working,
    };

    let resolved = working
      ? (resolveDynamicValues(working, templateContext) as Record<string, unknown>)
      : undefined;

    if (closure.functionalParams) {
      resolved = resolved ?? {};
      for (const spec of closure.functionalParams) {
        if (spec.name in reserved) {
          resolved[spec.name] = reserved[spec.name];
        }
      }
    }

    if (resolved) {
      const skipKeys = new Set(closure.functionalParams?.map((spec) => spec.name));
      resolved = (await this.resolveClosureReferences(resolved, state, runtime, skipKeys)) as Record<
        string,
        unknown
      >;
    }

    return resolved && Object.keys(resolved).length ? resolved : undefined;
  }

  private async resolveClosureReferences(
    value: any,
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
    skipKeys?: Set<string>,
  ): Promise<any> {
    if (Array.isArray(value)) {
      const results = [];
      for (const item of value) {
        results.push(await this.resolveClosureReferences(item, state, runtime, skipKeys));
      }
      return results;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value);

      if ('$call' in value && Object.keys(value).length === 1) {
        const ref = value.$call as any;
        return this.executeCallDirective(ref, state, runtime);
      }

      const evaluatedEntries = await Promise.all(
        entries.map(async ([key, val]) => {
          if (skipKeys?.has(key)) {
            return [key, val];
          }
          return [key, await this.resolveClosureReferences(val, state, runtime, skipKeys)];
        }),
      );
      return Object.fromEntries(evaluatedEntries);
    }

    return value;
  }

  private async executeCallDirective(
    ref: any,
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
  ): Promise<any> {
    if (!ref) {
      return undefined;
    }

    if (Array.isArray(ref)) {
      const results = [];
      for (const entry of ref) {
        results.push(await this.executeSingleCall(entry, state, runtime));
      }
      return results;
    }

    return this.executeSingleCall(ref, state, runtime);
  }

  private async executeSingleCall(
    ref: { name?: string; steps?: FlowStep[]; parameters?: Record<string, unknown> },
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
  ): Promise<any> {
    if (ref.steps) {
      if (!runtime.engine) {
        throw new Error('Inline step execution requires runtime.engine to be available.');
      }
      return runtime.engine.runSteps(ref.steps, state, runtime);
    }

    if (!ref.name) {
      throw new Error('$call requires either a name or steps array.');
    }

    const target = this.closures.get(ref.name);
    if (!target) {
      throw new Error(`Referenced closure "${ref.name}" is not registered.`);
    }

    const prepared = await this.prepareParameters(target, ref.parameters, state, runtime);
    const context: ClosureContext = {
      parameters: prepared,
      state,
      runtime,
    };
    return target.handler(state, context);
  }
}

export default RuleLoomEngine;
export { resolveDynamicValues } from './utils.js';
export type { TemplateContext } from './utils.js';
