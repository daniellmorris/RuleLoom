import _ from 'lodash';
import { resolveDynamicValues } from './utils.js';
export class RuleLoomEngine {
    constructor(options) {
        this.closures = new Map();
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
        const lastResult = await this.runSteps(flow.steps, state, runtime);
        return { state, lastResult };
    }
    async runSteps(steps, state, runtime, inheritedParameters) {
        let result;
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
    isBranchStep(step) {
        const record = step;
        return Array.isArray(record.cases) && !('closure' in record);
    }
    async executeBranch(step, state, runtime, inheritedParameters) {
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
        const closure = this.closures.get(step.closure);
        if (!closure) {
            throw new Error(`Closure "${step.closure}" is not registered.`);
        }
        const parameterSeed = inheritedParameters
            ? { ...(inheritedParameters ?? {}), ...(step.parameters ?? {}) }
            : step.parameters;
        const resolvedParameters = await this.prepareParameters(closure, parameterSeed, state, runtime);
        const context = {
            parameters: resolvedParameters,
            state,
            runtime,
        };
        const result = await closure.handler(state, context);
        if (step.assign) {
            _.set(state, step.assign, result);
        }
        else if (step.mergeResult && _.isPlainObject(result)) {
            _.merge(state, result);
        }
        return result;
    }
    async prepareParameters(closure, rawParameters, state, runtime) {
        if (!rawParameters) {
            return undefined;
        }
        let working = _.cloneDeep(rawParameters);
        const reserved = {};
        if (closure.functionalParams && working) {
            for (const spec of closure.functionalParams) {
                if (spec.name in working) {
                    reserved[spec.name] = working[spec.name];
                    delete working[spec.name];
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
export default RuleLoomEngine;
export { resolveDynamicValues } from './utils.js';
//# sourceMappingURL=index.js.map