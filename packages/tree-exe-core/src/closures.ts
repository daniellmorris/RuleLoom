import _ from 'lodash';
import type { ClosureDefinition, FlowStep } from 'tree-exe-engine';
import TreeExeEngine from 'tree-exe-engine';
import type { TreeExeLogger } from 'tree-exe-lib';

export function coreAssignClosure(): ClosureDefinition {
  return {
    name: 'core.assign',
    handler: async (state, context) => {
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
  };
}

export function coreRespondClosure(): ClosureDefinition {
  return {
    name: 'core.respond',
    handler: async (state, context) => {
      const params = context.parameters ?? {};
      const status = Number(params.status ?? 200);
      const headers = params.headers as Record<string, string> | undefined;
      const body = params.body;

      const response = { status, headers, body };
      _.set(state, 'response', response);
      return response;
    },
  };
}

export function coreLogClosure(): ClosureDefinition {
  return {
    name: 'core.log',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const level = (params.level as keyof TreeExeLogger | undefined) ?? 'info';
      const message = params.message ?? 'TreeExe log';
      const logger = context.runtime.logger as TreeExeLogger | undefined;
      const loggerFn = logger && typeof logger[level] === 'function' ? logger[level] : undefined;
      const logFn = (loggerFn ?? console.log.bind(console)) as (...args: unknown[]) => void;
      logFn(message, { state: context.state, runtime: context.runtime });
      return message;
    },
  };
}

export function coreTruthyClosure(): ClosureDefinition {
  return {
    name: 'core.truthy',
    handler: async (_state, context) => {
      const value = context.parameters?.value;
      return Boolean(value);
    },
  };
}

export function coreEqualsClosure(): ClosureDefinition {
  return {
    name: 'core.equals',
    handler: async (_state, context) => {
      const left = context.parameters?.left;
      const right = context.parameters?.right;
      return _.isEqual(left, right);
    },
  };
}

export function coreGreaterThanClosure(): ClosureDefinition {
  return {
    name: 'core.greater-than',
    handler: async (_state, context) => {
      const left = Number(context.parameters?.left);
      const right = Number(context.parameters?.right);
      return left > right;
    },
  };
}

export function coreLessThanClosure(): ClosureDefinition {
  return {
    name: 'core.less-than',
    handler: async (_state, context) => {
      const left = Number(context.parameters?.left);
      const right = Number(context.parameters?.right);
      return left < right;
    },
  };
}

export function coreIncludesClosure(): ClosureDefinition {
  return {
    name: 'core.includes',
    handler: async (_state, context) => {
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
  };
}

export function coreLengthClosure(): ClosureDefinition {
  return {
    name: 'core.length',
    handler: async (state, context) => {
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
  };
}

export function coreForEachClosure(): ClosureDefinition {
  return {
    name: 'core.for-each',
    functionalParams: [{ name: 'steps', mode: 'array' }],
    handler: async (state, context) => {
      const items = context.parameters?.collection as unknown;
      const steps = context.parameters?.steps as FlowStep[] | undefined;
      if (!Array.isArray(items) || !steps || steps.length === 0) {
        return state;
      }

      const engine = context.runtime.engine as TreeExeEngine | undefined;
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
  ];
}
