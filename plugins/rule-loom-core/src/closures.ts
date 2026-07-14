import _ from 'lodash';
import type { ClosureDefinition, FlowBranchCase, FlowStep } from 'rule-loom-engine';
import RuleLoomEngine from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import { callRuleLoomRunner, type RunnerCallResponse } from './runnerClient.js';
import { createUtilityClosures } from './utilityClosures.js';

export function coreAssignClosure(): ClosureDefinition {
  return {
    name: 'core.assign',
    handler: async (state: any, context: any) => {
      const params = context.parameters ?? {};
      const target = params.target as string | undefined;
      if (!target) {
        throw new Error('core.assign requires a "target" parameter.');
      }
      const merge = Boolean(params.merge);
      const value = params.value;

      if (merge) {
        const current = _.get(state, target);
        if (_.isPlainObject(current) && _.isPlainObject(value)) {
          _.set(state, target, _.merge({}, current, value));
        } else {
          _.set(state, target, value);
        }
      } else {
        _.set(state, target, value);
      }

      return _.get(state, target);
    },
    signature: {
      description: 'Assigns a value from parameters/state/runtime into state at the provided path.',
      parameters: [
        { name: 'target', type: 'string', required: true, description: 'Dot-notation path in state to write.' },
        { name: 'value', type: 'any', description: 'Value or template expression to assign.' },
        { name: 'merge', type: 'boolean', description: 'Merge plain objects instead of replacing the existing value.' },
      ],
      returns: { type: 'any', description: 'The value stored at the target path.' },
      mutates: ['state'],
    },
  };
}

export function coreRespondClosure(): ClosureDefinition {
  return {
    name: 'core.respond',
    handler: async (state: any, context: any) => {
      const params = context.parameters ?? {};
      const status = Number(params.status ?? 200);
      const headers = params.headers as Record<string, string> | undefined;
      const body = params.body;

      const response = { status, headers, body };
      _.set(state, 'response', response);
      return response;
    },
    signature: {
      description: 'Sets state.response so HTTP inputs send a response downstream.',
      parameters: [
        { name: 'status', type: 'number', description: 'HTTP status code.', allowDynamicValue: true },
        { name: 'headers', type: 'object', description: 'Map of response headers.' },
        { name: 'body', type: 'any', description: 'Response payload (object/string/etc.).' },
      ],
      returns: { type: 'object', description: 'Response descriptor containing status, headers, and body.' },
      mutates: ['state.response'],
    },
  };
}

export function coreLogClosure(): ClosureDefinition {
  return {
    name: 'core.log',
    handler: async (_state: any, context: any) => {
      const params = context.parameters ?? {};
      const level = (params.level as keyof RuleLoomLogger | undefined) ?? 'info';
      const message = params.message ?? 'RuleLoom log';
      const logger = context.runtime.logger as RuleLoomLogger | undefined;
      const loggerFn = logger && typeof logger[level] === 'function' ? logger[level] : undefined;
      const logFn = (loggerFn ?? console.log.bind(console)) as (...args: unknown[]) => void;
      logFn(message, { state: context.state, runtime: context.runtime });
      return message;
    },
    signature: {
      description: 'Logs a message using the configured logger.',
      parameters: [
        { name: 'level', type: 'string', description: 'Log level (trace/debug/info/warn/error/fatal).' },
        { name: 'message', type: 'string', required: true, description: 'Message template to log.' },
      ],
      returns: { type: 'string', description: 'The message that was logged.' },
    },
  };
}

export function coreTruthyClosure(): ClosureDefinition {
  return {
    name: 'core.truthy',
    handler: async (_state: any, context: any) => {
      const value = context.parameters?.value;
      return Boolean(value);
    },
    signature: {
      description: 'Returns true when the provided value is truthy.',
      parameters: [{ name: 'value', type: 'any', required: true }],
      returns: { type: 'boolean', description: 'Whether the value is truthy.' },
    },
  };
}

export function coreEqualsClosure(): ClosureDefinition {
  return {
    name: 'core.equals',
    handler: async (_state: any, context: any) => {
      const left = context.parameters?.left;
      const right = context.parameters?.right;
      return _.isEqual(left, right);
    },
    signature: {
      description: 'Performs a deep equality comparison between `left` and `right`.',
      parameters: [
        { name: 'left', type: 'any', required: true },
        { name: 'right', type: 'any', required: true },
      ],
      returns: { type: 'boolean' },
    },
  };
}

export function coreGreaterThanClosure(): ClosureDefinition {
  return {
    name: 'core.greater-than',
    handler: async (_state: any, context: any) => {
      const left = Number(context.parameters?.left);
      const right = Number(context.parameters?.right);
      return left > right;
    },
    signature: {
      description: 'Compares whether `left` is greater than `right` after numeric coercion.',
      parameters: [
        { name: 'left', type: 'any', required: true },
        { name: 'right', type: 'any', required: true },
      ],
      returns: { type: 'boolean' },
    },
  };
}

export function coreLessThanClosure(): ClosureDefinition {
  return {
    name: 'core.less-than',
    handler: async (_state: any, context: any) => {
      const left = Number(context.parameters?.left);
      const right = Number(context.parameters?.right);
      return left < right;
    },
    signature: {
      description: 'Compares whether `left` is less than `right` after numeric coercion.',
      parameters: [
        { name: 'left', type: 'any', required: true },
        { name: 'right', type: 'any', required: true },
      ],
      returns: { type: 'boolean' },
    },
  };
}

export function coreIncludesClosure(): ClosureDefinition {
  return {
    name: 'core.includes',
    handler: async (_state: any, context: any) => {
      const collection = context.parameters?.collection as unknown;
      const value = context.parameters?.value;
      if (Array.isArray(collection)) {
        return collection.some((item) => _.isEqual(item, value));
      }
      if (typeof collection === 'string') {
        return typeof value === 'string' ? collection.includes(value) : false;
      }
      if (collection && typeof collection === 'object') {
        return Object.values(collection).some((item) => _.isEqual(item, value));
      }
      return false;
    },
    signature: {
      description: 'Checks if an item exists inside an array, string, or object values.',
      parameters: [
        { name: 'collection', type: 'any', required: true },
        { name: 'value', type: 'any', required: true },
      ],
      returns: { type: 'boolean' },
    },
  };
}

export function coreLengthClosure(): ClosureDefinition {
  return {
    name: 'core.length',
    handler: async (state: any, context: any) => {
      const targetPath = context.parameters?.target as string | undefined;
      const value = targetPath ? _.get(state, targetPath) : context.parameters?.value;
      if (Array.isArray(value) || typeof value === 'string') {
        return value.length;
      }
      if (value && typeof value === 'object') {
        return Object.keys(value).length;
      }
      return 0;
    },
    signature: {
      description: 'Calculates the length of an array/string/object.',
      parameters: [
        { name: 'target', type: 'string', description: 'State path to read. If omitted, use `value`.' },
        { name: 'value', type: 'any', description: 'Literal collection to measure.' },
      ],
      allowAdditionalParameters: false,
      returns: { type: 'number' },
    },
  };
}

export function coreForEachClosure(): ClosureDefinition {
  return {
    name: 'core.for-each',
    handler: async (state: any, context: any) => {
      const items = context.parameters?.collection as unknown;
      const steps = context.parameters?.steps as FlowStep[] | undefined;
      if (!Array.isArray(items) || !steps || steps.length === 0) {
        return state;
      }

      const engine = context.runtime.engine as RuleLoomEngine | undefined;
      if (!engine) {
        throw new Error('core.for-each requires runtime.engine to be available.');
      }

      for (let index = 0; index < items.length; index += 1) {
        const value = items[index];
        state.currentItem = value;
        state.currentIndex = index;
        await engine.runSteps(steps, state, context.runtime);
      }

      delete state.currentItem;
      delete state.currentIndex;
      return state;
    },
    signature: {
      description: 'Iterates over each entry in `collection` and executes nested steps.',
      parameters: [
        { name: 'collection', type: 'any', required: true, description: 'Array to iterate over.' },
        { name: 'steps', type: 'flowSteps', required: true, description: 'Inline steps to execute for each item.' },
      ],
      returns: { type: 'any', description: 'The mutated state after iteration.' },
      mutates: ['state.currentItem', 'state.currentIndex'],
    },
  };
}

export function coreBranchClosure(): ClosureDefinition {
  return {
    name: 'core.branch',
    implicitFields: ['cases'],
    handler: async (state: any, context: any) => {
      const engine = context.runtime.engine as RuleLoomEngine | undefined;
      if (!engine) {
        throw new Error('core.branch requires runtime.engine to be available.');
      }

      const cases = (context.parameters?.cases as FlowBranchCase[] | undefined) ?? [];
      const otherwise = context.parameters?.otherwise as FlowStep[] | undefined;

      for (const branchCase of cases) {
        const whenBlock = branchCase.when;
        const thenBlock = branchCase.then;
        const last = await engine.runSteps(whenBlock, state, context.runtime);
        const shouldRun = Boolean(last);
        if (shouldRun) {
          return engine.runSteps(thenBlock, state, context.runtime);
        }
      }

      if (otherwise) {
        return engine.runSteps(otherwise, state, context.runtime);
      }

      return undefined;
    },
    signature: {
      description: 'Branches execution based on conditional cases.',
      parameters: [
        {
          name: 'cases',
          type: 'array',
          skipTemplateResolution: true,
          required: true,
          itemLabelKey: 'label',
          labelTemplate: '{itemLabel} {name}',
          description: 'Array of branch cases; each entry must include `when: FlowStep[]` and `then: FlowStep[]`.',
          children: [
            { name: 'label', type: 'string', required: false, description: 'Optional UI label for this branch case.' },
            { name: 'when', type: 'flowSteps', required: true, description: 'Step array evaluated for truthiness (last result).' },
            { name: 'then', type: 'flowSteps', required: true, description: 'Step array executed when `when` is truthy.' },
          ],
        },
        {
          name: 'otherwise',
          type: 'flowSteps',
          description: 'Fallback steps when no case matches.',
        },
      ],
      returns: { type: 'any', description: 'Result of the executed branch steps.' },
    },
  };
}

export function coreRunnerCallClosure(): ClosureDefinition {
  return {
    name: 'core.runner-call',
    handler: async (state: any, context: any) => {
      const params = context.parameters ?? {};
      const flow = params.flow as string | undefined;
      if (!flow) {
        throw new Error('core.runner-call requires a "flow" parameter.');
      }
      const response = await callRuleLoomRunner({
        url: params.url as string | undefined,
        host: params.host as string | undefined,
        flow,
        state: params.state,
        payload: params.payload,
        auth: params.auth as any,
        timeoutMs: params.timeoutMs as number | undefined,
        retries: params.retries as number | undefined,
        simulate: params.simulate as boolean | undefined,
        trace: params.trace as boolean | undefined,
      });
      mergeRunnerState(state, response, params.mergeState);
      return response;
    },
    signature: {
      description: 'Invokes another RuleLoom runner through its HTTP runner endpoint.',
      parameters: [
        { name: 'url', type: 'string', description: 'Full runner endpoint URL. If omitted, host + /__ruleloom/run is used.' },
        { name: 'host', type: 'string', description: 'Runner host/base URL used to build /__ruleloom/run.' },
        { name: 'flow', type: 'string', required: true, description: 'Downstream flow name to execute.' },
        { name: 'state', type: 'any', description: 'Initial downstream state. Takes precedence over payload.' },
        { name: 'payload', type: 'any', description: 'Convenience payload stored as downstream state.payload.' },
        { name: 'auth', type: 'any', description: 'Bearer token string or auth/header object.' },
        { name: 'timeoutMs', type: 'number', description: 'Request timeout in milliseconds. Defaults to 5000.' },
        { name: 'retries', type: 'number', description: 'Number of retry attempts after the initial request.' },
        { name: 'simulate', type: 'boolean', description: 'Ask the downstream runner to execute in simulation mode when supported.' },
        { name: 'trace', type: 'boolean', description: 'Ask the downstream runner to return recorder trace. Defaults to true.' },
        { name: 'mergeState', type: 'any', description: 'true to merge downstream state into current state, or a state path to store it.' },
      ],
      returns: { type: 'object', description: 'Downstream runner response with state, lastResult, and optional trace.' },
    },
  };
}

function mergeRunnerState(state: any, response: RunnerCallResponse, mergeState: unknown): void {
  if (!mergeState || !response.state || typeof response.state !== 'object') return;
  if (mergeState === true) {
    _.merge(state, response.state);
    return;
  }
  if (typeof mergeState === 'string') {
    _.set(state, mergeState, response.state);
  }
}

function withCoreNamespace(closure: ClosureDefinition): ClosureDefinition {
  return {
    ...closure,
    namespace: closure.namespace ?? 'core',
    version: closure.version ?? '0.1.0',
  };
}

export function createCoreClosures(): ClosureDefinition[] {
  return [
    coreAssignClosure(),
    coreRespondClosure(),
    coreLogClosure(),
    coreTruthyClosure(),
    coreEqualsClosure(),
    coreGreaterThanClosure(),
    coreLessThanClosure(),
    coreIncludesClosure(),
    coreLengthClosure(),
    coreForEachClosure(),
    coreBranchClosure(),
    coreRunnerCallClosure(),
    ...createUtilityClosures(),
  ].map(withCoreNamespace);
}
