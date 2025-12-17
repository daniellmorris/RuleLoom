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

export type ClosureParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'any'
  | 'flowSteps';

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

export class RuleLoomEngine {
  private closures = new Map<string, ClosureDefinition>();
  private implicitClosures: ClosureDefinition[] = [];
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

    if (definition.implicitFields && definition.implicitFields.length) {
      this.implicitClosures.push(definition);
    }
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

  getImplicitClosures(): ClosureDefinition[] {
    return [...this.implicitClosures];
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

    const lastResult = await this.runSteps(flow.steps, state, { ...runtime, flow: flow.name });
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
      if (!(await this.shouldExecute(step, state, runtime))) {
        continue;
      }
      const implicit = await this.resolveImplicitClosure(step, state, runtime);
      if (implicit) {
        const implicitParams = this.extractParameters(step);
        const implicitInvoke: FlowInvokeStep = {
          ...(step as any),
          type: 'invoke',
          closure: implicit.name,
          parameters: implicitParams,
        };
        result = await this.invokeStep(implicitInvoke, state, runtime, inheritedParameters);
        continue;
      }

      if (!this.isInvokeStep(step)) {
        throw new Error('Flow step is missing "closure" and no implicit closure matched.');
      }

      result = await this.invokeStep(step, state, runtime, inheritedParameters);
    }
    return result;
  }

  private isInvokeStep(step: FlowStep): step is FlowInvokeStep & { closure: string } {
    return typeof (step as FlowInvokeStep).closure === 'string';
  }

  private async resolveImplicitClosure(
    step: FlowStep,
    state: Record<string, unknown>,
    runtime: ExecutionRuntime,
  ): Promise<ClosureDefinition | undefined> {
    for (const candidate of this.implicitClosures) {
      const fields = candidate.implicitFields ?? [];
      if (!fields.length) continue;
      const allPresent = fields.every((field) => Object.prototype.hasOwnProperty.call(step as any, field));
      if (allPresent) {
        if (runtime.logger?.debug) {
          runtime.logger.debug('Implicit closure matched step', { closure: candidate.name, step });
        }
        return candidate;
      }
    }
    return undefined;
  }

  private extractParameters(step: FlowStep): Record<string, unknown> | undefined {
    const explicit = (step as FlowInvokeStep).parameters;
    const rest = { ...(step as Record<string, unknown>) };
    delete rest.type;
    delete rest.closure;
    delete rest.when;
    delete rest.assign;
    delete rest.mergeResult;
    delete rest.parameters;

    const merged = explicit ? { ...rest, ...explicit } : rest;
    return Object.keys(merged).length ? merged : undefined;
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

  async evaluateConditions(
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
    if (!step.closure) {
      throw new Error('invokeStep requires a closure name.');
    }

    const closure = this.closures.get(step.closure);
    if (!closure) {
      throw new Error(`Closure "${step.closure}" is not registered.`);
    }

    const parameterSeed = inheritedParameters
      ? { ...(inheritedParameters ?? {}), ...(step.parameters ?? {}) }
      : step.parameters;

    const resolvedParameters = await this.prepareParameters(closure, parameterSeed, state, runtime);

    const recorders = normalizeRecorders(runtime.recorder);
    const level = runtime.recordLevel ?? 'full';
    const t0 = Date.now();

    if (recorders.length && level !== 'none') {
      const evt: RecorderEnterEvent = {
        kind: 'enter',
        flow: (runtime as any).flow,
        step: (step as any).$meta?.id ?? step.closure,
        closure: step.closure,
        timestamp: t0,
        params: level === 'timing' ? undefined : cloneLite(resolvedParameters),
        stateBefore: level === 'full' || level === 'state' ? cloneLite(state) : undefined,
      };
      recorders.forEach((r) => r.onEvent?.(evt));
    }

    const context: ClosureContext = {
      parameters: resolvedParameters,
      state,
      runtime,
    };

    let result: unknown;
    try {
      result = await closure.handler(state, context);
    } catch (err) {
      if (recorders.length && level !== 'none') {
        const evt: RecorderErrorEvent = {
          kind: 'error',
          flow: (runtime as any).flow,
          step: (step as any).$meta?.id ?? step.closure,
          closure: step.closure,
          timestamp: Date.now(),
          durationMs: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        };
        recorders.forEach((r) => r.onEvent?.(evt));
      }
      throw err;
    }

    if (step.assign) {
      _.set(state, step.assign, result);
    } else if (step.mergeResult && _.isPlainObject(result)) {
      _.merge(state, result as Record<string, unknown>);
    }

    if (recorders.length && level !== 'none') {
      const evt: RecorderExitEvent = {
        kind: 'exit',
        flow: (runtime as any).flow,
        step: (step as any).$meta?.id ?? step.closure,
        closure: step.closure,
        timestamp: Date.now(),
        durationMs: Date.now() - t0,
        output: level === 'timing' ? undefined : cloneLite(result),
        stateAfter: level === 'full' || level === 'state' ? cloneLite(state) : undefined,
      };
      recorders.forEach((r) => r.onEvent?.(evt));
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

    const signatureSkip = new Set(
      (closure.signature?.parameters ?? [])
        .filter((p) => p.type === 'flowSteps' || p.skipTemplateResolution)
        .map((p) => p.name),
    );
    const skipKeys = signatureSkip;

    const reserved: Record<string, unknown> = {};
    if (skipKeys.size && working) {
      for (const key of Object.keys(working)) {
        if (skipKeys.has(key)) {
          reserved[key] = working[key];
          delete working[key];
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

    if (skipKeys.size) {
      resolved = resolved ?? {};
      for (const key of Object.keys(reserved)) {
        resolved[key] = reserved[key];
      }
    }

    if (resolved) {
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

function normalizeRecorders(rec?: Recorder | Recorder[] | undefined): Recorder[] {
  if (!rec) return [];
  return Array.isArray(rec) ? rec.filter(Boolean) : [rec];
}

function cloneLite<T>(val: T): T {
  try {
    return _.cloneDeep(val);
  } catch {
    return val;
  }
}

export default RuleLoomEngine;
export { resolveDynamicValues } from './utils.js';
export type { TemplateContext } from './utils.js';
