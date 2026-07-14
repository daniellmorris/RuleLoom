import _ from 'lodash';

const BLOCKED_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export function assertSafePath(path: string, label = 'path'): void {
  const segments = path.match(/[^.[\]]+/g) ?? [];
  const blocked = segments.find((segment) => BLOCKED_PATH_SEGMENTS.has(segment));
  if (blocked) throw new Error(`${label} contains blocked segment "${blocked}".`);
}

export function assertSafeObject(
  value: unknown,
  label = 'value',
  depth = 0,
  seen = new WeakSet<object>(),
): void {
  if (depth > 100) throw new Error(`${label} exceeds the maximum nesting depth.`);
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (BLOCKED_PATH_SEGMENTS.has(key)) throw new Error(`${label} contains blocked key "${key}".`);
    assertSafeObject((value as Record<string, unknown>)[key], label, depth + 1, seen);
  }
}

export interface TemplateContext {
  state: Record<string, unknown>;
  runtime: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

function getContextValue(path: string, context: TemplateContext): unknown {
  const trimmed = path.trim();
  assertSafePath(trimmed, 'Template path');
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
    assertSafeObject(value, 'Template value');
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      output[key] = resolveDynamicValues(val, context);
    }
    return output as T;
  }

  return value;
}
