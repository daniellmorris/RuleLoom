import _ from 'lodash';
import RuleLoomEngine, { resolveDynamicValues, type ClosureDefinition, type ClosureContext } from 'rule-loom-engine';
import { createBundleClosures } from 'rule-loom-core';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { ClosureConfig } from './config.js';
import { importClosureModule } from './config.js';

function buildSetStateClosure(entry: Extract<ClosureConfig, { type: 'template'; template: 'set-state' }>): ClosureDefinition {
  const { name, target, value, merge } = entry;
  return {
    name,
    description: entry.description,
    handler: async (state, context) => {
      const templateContext = {
        state,
        runtime: context.runtime,
        parameters: context.parameters,
      };
      const parameterValue = context.parameters?.value;
      const resolvedValue = value !== undefined
        ? resolveDynamicValues(value, templateContext)
        : parameterValue !== undefined
          ? resolveDynamicValues(parameterValue, templateContext)
          : undefined;

      if (merge) {
        const current = _.get(state, target);
        if (_.isPlainObject(current) && _.isPlainObject(resolvedValue)) {
          _.set(state, target, _.merge({}, current, resolvedValue));
        } else {
          _.set(state, target, resolvedValue);
        }
      } else {
        _.set(state, target, resolvedValue);
      }

      return _.get(state, target);
    },
    signature: {
      description: entry.description ?? 'Assigns a static template value into state.',
      parameters: [{ name: 'value', type: 'any', description: 'Optional override for the configured template value.' }],
      allowAdditionalParameters: false,
      returns: { type: 'any' },
      mutates: ['state'],
    },
  };
}

function buildRespondClosure(entry: Extract<ClosureConfig, { type: 'template'; template: 'respond' }>): ClosureDefinition {
  const { name, status, headers, body } = entry;
  return {
    name,
    description: entry.description,
    handler: async (state, context) => {
      const templateContext = {
        state,
        runtime: context.runtime,
        parameters: context.parameters,
      };
      const bodySource = context.parameters?.body ?? body;
      const headersSource = context.parameters?.headers ?? headers;
      const statusSource = context.parameters?.status ?? status ?? 200;

      const resolvedBody = bodySource !== undefined ? resolveDynamicValues(bodySource, templateContext) : undefined;
      const resolvedHeaders = headersSource ? resolveDynamicValues(headersSource, templateContext) : undefined;
      const resolvedStatusValue = resolveDynamicValues(statusSource, templateContext);
      const resolvedStatus = Number(resolvedStatusValue ?? 200);

      const response = {
        status: resolvedStatus,
        body: resolvedBody,
        headers: resolvedHeaders,
      };

      _.set(state, 'response', response);
      return response;
    },
    signature: {
      description: entry.description ?? 'Responds with a static payload and status.',
      parameters: [
        { name: 'status', type: 'number', description: 'HTTP status override.', allowDynamicValue: true },
        { name: 'headers', type: 'object', description: 'Headers override map.' },
        { name: 'body', type: 'any', description: 'Body override.' },
      ],
      allowAdditionalParameters: false,
      returns: { type: 'object' },
      mutates: ['state.response'],
    },
  };
}

async function buildModuleClosures(
  entry: Extract<ClosureConfig, { type: 'module' }>,
  baseDir: string,
  logger?: RuleLoomLogger,
): Promise<ClosureDefinition[]> {
  const mod = await importClosureModule(entry.module, baseDir);
  const exportName = entry.export ?? 'default';
  const exported = exportName ? mod[exportName] : mod;

  if (!exported) {
    throw new Error(`Unable to load export "${exportName}" from module "${entry.module}"`);
  }

  let definitions: unknown;
  if (typeof exported === 'function') {
    definitions = await exported(entry.config ?? {}, logger);
  } else {
    definitions = exported;
  }

  const ensureClosure = (def: unknown, index: number): ClosureDefinition => {
    if (typeof def !== 'object' || !def) {
      throw new Error(`Export from module "${entry.module}" did not produce a closure at index ${index}`);
    }
    const closure = def as ClosureDefinition;
    if (!closure.name && entry.name) {
      closure.name = entry.name;
    }
    if (!closure.name) {
      throw new Error(`Closure definition from module "${entry.module}" is missing a name.`);
    }
    return closure;
  };

  if (Array.isArray(definitions)) {
    return definitions.map((def, idx) => ensureClosure(def, idx));
  }

  return [ensureClosure(definitions, 0)];
}

export async function buildClosures(
  closureConfigs: ClosureConfig[],
  baseDir: string,
  logger?: RuleLoomLogger,
): Promise<ClosureDefinition[]> {
  const closures: ClosureDefinition[] = [];

  for (const entry of closureConfigs) {
    if (entry.type === 'template') {
      if (entry.template === 'set-state') {
        closures.push(buildSetStateClosure(entry));
      } else if (entry.template === 'respond') {
        closures.push(buildRespondClosure(entry));
      }
    } else if (entry.type === 'module') {
      const moduleClosures = await buildModuleClosures(entry, baseDir, logger);
      closures.push(...moduleClosures);
    } else if (entry.type === 'bundle') {
      closures.push(...createBundleClosures(entry.preset, entry.options));
    } else if (entry.type === 'flow') {
      closures.push({
        name: entry.name,
        description: entry.description,
        handler: async (state, context) => {
          const engine = context.runtime.engine;
          if (!engine || !(engine instanceof RuleLoomEngine)) {
            throw new Error('Flow closures require execution within a RuleLoomEngine context.');
          }
          return engine.runSteps(entry.steps, state, context.runtime, context.parameters ?? undefined);
        },
        signature: {
          description: entry.description ?? `Flow closure ${entry.name}`,
          allowAdditionalParameters: true,
        },
      });
    }
  }

  return closures;
}
