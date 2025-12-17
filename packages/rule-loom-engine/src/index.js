import _ from 'lodash';
import { resolveDynamicValues } from './utils.js';
export class RuleLoomEngine {
    constructor(options) {
        this.closures = new Map();
        this.implicitClosures = [];
        this.flows = new Map();
        if (options?.closures) {
            this.registerClosures(options.closures);
        }
        if (options?.flows) {
            this.registerFlows(options.flows);
        }
    }
    registerClosure(definition) {
        if (this.closures.has(definition.name)) {
            throw new Error(`Closure named "${definition.name}" is already registered.`);
        }
        this.closures.set(definition.name, definition);
        if (definition.implicitFields && definition.implicitFields.length) {
            this.implicitClosures.push(definition);
        }
    }
    registerClosures(definitions) {
        for (const def of definitions) {
            this.registerClosure(def);
        }
    }
    registerFlow(flow) {
        if (this.flows.has(flow.name)) {
            throw new Error(`Flow named "${flow.name}" is already registered.`);
        }
        this.flows.set(flow.name, flow);
    }
    registerFlows(flows) {
        for (const flow of flows) {
            this.registerFlow(flow);
        }
    }
    getClosure(name) {
        return this.closures.get(name);
    }
    getImplicitClosures() {
        return [...this.implicitClosures];
    }
    getFlow(name) {
        return this.flows.get(name);
    }
    async execute(flowName, initialState = {}, runtime = {}) {
        const flow = this.flows.get(flowName);
        if (!flow) {
            throw new Error(`Flow "${flowName}" is not registered.`);
        }
        const state = _.cloneDeep(initialState);
        runtime.engine = runtime.engine ?? this;
        const lastResult = await this.runSteps(flow.steps, state, { ...runtime, flow: flow.name });
        return { state, lastResult };
    }
    async runSteps(steps, state, runtime, inheritedParameters) {
        let result;
        for (const step of steps) {
            if (!(await this.shouldExecute(step, state, runtime))) {
                continue;
            }
            const implicit = await this.resolveImplicitClosure(step, state, runtime);
            if (implicit) {
                const implicitParams = this.extractParameters(step);
                const implicitInvoke = {
                    ...step,
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
    isInvokeStep(step) {
        return typeof step.closure === 'string';
    }
    async resolveImplicitClosure(step, state, runtime) {
        for (const candidate of this.implicitClosures) {
            const fields = candidate.implicitFields ?? [];
            if (!fields.length)
                continue;
            const allPresent = fields.every((field) => Object.prototype.hasOwnProperty.call(step, field));
            if (allPresent) {
                if (runtime.logger?.debug) {
                    runtime.logger.debug('Implicit closure matched step', { closure: candidate.name, step });
                }
                return candidate;
            }
        }
        return undefined;
    }
    extractParameters(step) {
        const explicit = step.parameters;
        const rest = { ...step };
        delete rest.type;
        delete rest.closure;
        delete rest.when;
        delete rest.assign;
        delete rest.mergeResult;
        delete rest.parameters;
        const merged = explicit ? { ...rest, ...explicit } : rest;
        return Object.keys(merged).length ? merged : undefined;
    }
    async shouldExecute(step, state, runtime) {
        if (!step.when) {
            return true;
        }
        return this.evaluateConditions(step.when, state, runtime);
    }
    async evaluateConditions(conditions, state, runtime) {
        const list = Array.isArray(conditions) ? conditions : [conditions];
        for (const condition of list) {
            const closure = this.closures.get(condition.closure);
            if (!closure) {
                throw new Error(`Condition closure "${condition.closure}" is not registered.`);
            }
            const resolvedParameters = await this.prepareParameters(closure, condition.parameters, state, runtime);
            const context = {
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
    async invokeStep(step, state, runtime, inheritedParameters) {
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
            const evt = {
                kind: 'enter',
                flow: runtime.flow,
                step: step.$meta?.id ?? step.closure,
                closure: step.closure,
                timestamp: t0,
                params: level === 'timing' ? undefined : cloneLite(resolvedParameters),
                stateBefore: level === 'full' || level === 'state' ? cloneLite(state) : undefined,
            };
            recorders.forEach((r) => r.onEvent?.(evt));
        }
        const context = {
            parameters: resolvedParameters,
            state,
            runtime,
        };
        let result;
        try {
            result = await closure.handler(state, context);
        }
        catch (err) {
            if (recorders.length && level !== 'none') {
                const evt = {
                    kind: 'error',
                    flow: runtime.flow,
                    step: step.$meta?.id ?? step.closure,
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
        }
        else if (step.mergeResult && _.isPlainObject(result)) {
            _.merge(state, result);
        }
        if (recorders.length && level !== 'none') {
            const evt = {
                kind: 'exit',
                flow: runtime.flow,
                step: step.$meta?.id ?? step.closure,
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
    async prepareParameters(closure, rawParameters, state, runtime) {
        if (!rawParameters) {
            return undefined;
        }
        let working = _.cloneDeep(rawParameters);
        const signatureSkip = new Set((closure.signature?.parameters ?? [])
            .filter((p) => p.type === 'flowSteps' || p.skipTemplateResolution)
            .map((p) => p.name));
        const skipKeys = signatureSkip;
        const reserved = {};
        if (skipKeys.size && working) {
            for (const key of Object.keys(working)) {
                if (skipKeys.has(key)) {
                    reserved[key] = working[key];
                    delete working[key];
                }
            }
        }
        const templateContext = {
            state,
            runtime,
            parameters: working,
        };
        let resolved = working
            ? resolveDynamicValues(working, templateContext)
            : undefined;
        if (skipKeys.size) {
            resolved = resolved ?? {};
            for (const key of Object.keys(reserved)) {
                resolved[key] = reserved[key];
            }
        }
        if (resolved) {
            resolved = (await this.resolveClosureReferences(resolved, state, runtime, skipKeys));
        }
        return resolved && Object.keys(resolved).length ? resolved : undefined;
    }
    async resolveClosureReferences(value, state, runtime, skipKeys) {
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
                const ref = value.$call;
                return this.executeCallDirective(ref, state, runtime);
            }
            const evaluatedEntries = await Promise.all(entries.map(async ([key, val]) => {
                if (skipKeys?.has(key)) {
                    return [key, val];
                }
                return [key, await this.resolveClosureReferences(val, state, runtime, skipKeys)];
            }));
            return Object.fromEntries(evaluatedEntries);
        }
        return value;
    }
    async executeCallDirective(ref, state, runtime) {
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
    async executeSingleCall(ref, state, runtime) {
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
        const context = {
            parameters: prepared,
            state,
            runtime,
        };
        return target.handler(state, context);
    }
}
function normalizeRecorders(rec) {
    if (!rec)
        return [];
    return Array.isArray(rec) ? rec.filter(Boolean) : [rec];
}
function cloneLite(val) {
    try {
        return _.cloneDeep(val);
    }
    catch {
        return val;
    }
}
export default RuleLoomEngine;
export { resolveDynamicValues } from './utils.js';
//# sourceMappingURL=index.js.map