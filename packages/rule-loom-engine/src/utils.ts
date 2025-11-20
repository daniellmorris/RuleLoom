import _ from 'lodash';

export interface TemplateContext {
  state: Record<string, unknown>;
  runtime: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

function getContextValue(path: string, context: TemplateContext): unknown {
  const trimmed = path.trim();
  if (trimmed.startsWith('state.')) {
    return _.get(context.state, trimmed.slice(6));
  }
  if (trimmed.startsWith('runtime.')) {
    return _.get(context.runtime, trimmed.slice(8));
  }
  if (trimmed.startsWith('params.') || trimmed.startsWith('parameters.')) {
    return _.get(context.parameters ?? {}, trimmed.replace(/^parameters?\./, ''));
  }
  // Default to state lookup
  return _.get(context.state, trimmed);
}

function resolveString(value: string, context: TemplateContext): unknown {
  const fullMatch = value.match(/^\$\{([^}]+)\}$/);
  if (fullMatch) {
    return getContextValue(fullMatch[1], context);
  }

  return value.replace(/\$\{([^}]+)\}/g, (_, rawPath) => {
    const resolved = getContextValue(rawPath, context);
    if (resolved === undefined || resolved === null) {
      return '';
    }
    return String(resolved);
  });
}

export function resolveDynamicValues<T>(value: T, context: TemplateContext): T {
  if (typeof value === 'string') {
    return resolveString(value, context) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveDynamicValues(item, context)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      output[key] = resolveDynamicValues(val, context);
    }
    return output as T;
  }

  return value;
}
