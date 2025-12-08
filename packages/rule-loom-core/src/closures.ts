import _ from 'lodash';
import type { ClosureDefinition, FlowBranchCase, FlowStep } from 'rule-loom-engine';
import RuleLoomEngine from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';

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
    implicitFields: ['cases', 'otherwise'],
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
          description: 'Array of branch cases; each entry must include `when: FlowStep[]` and `then: FlowStep[]`.',
          children: [
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
  ];
}
