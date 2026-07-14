import _ from 'lodash';
import type { ClosureDefinition, ClosureParameterDefinition } from 'rule-loom-engine';

type Unit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

function requiredParam(name: string, type: ClosureParameterDefinition['type'], description?: string): ClosureParameterDefinition {
  return { name, type, required: true, description };
}

function optionalParam(name: string, type: ClosureParameterDefinition['type'], description?: string, defaultValue?: unknown): ClosureParameterDefinition {
  return { name, type, description, ...(defaultValue !== undefined ? { defaultValue } : {}) };
}

function parseDate(value: unknown): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value as any);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }
  return date;
}

function canonicalUnit(unit: unknown): Unit {
  const normalized = String(unit ?? 'millisecond').toLowerCase().replace(/s$/, '') as Unit;
  if (['millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'year'].includes(normalized)) {
    return normalized;
  }
  throw new Error(`Unsupported date unit "${String(unit)}".`);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function addDate(date: Date, amount: number, unit: Unit): Date {
  switch (unit) {
    case 'millisecond':
      return new Date(date.getTime() + amount);
    case 'second':
      return new Date(date.getTime() + amount * 1000);
    case 'minute':
      return new Date(date.getTime() + amount * 60_000);
    case 'hour':
      return new Date(date.getTime() + amount * 3_600_000);
    case 'day':
      return new Date(date.getTime() + amount * 86_400_000);
    case 'week':
      return new Date(date.getTime() + amount * 604_800_000);
    case 'month':
      return addMonths(date, amount);
    case 'year':
      return addMonths(date, amount * 12);
  }
}

function dateOutput(date: Date, output: unknown): string | number {
  switch (String(output ?? 'iso')) {
    case 'timestamp':
    case 'epochMs':
      return date.getTime();
    case 'date':
      return date.toISOString().slice(0, 10);
    case 'iso':
    default:
      return date.toISOString();
  }
}

export function coreDateAddClosure(): ClosureDefinition {
  return {
    name: 'core.date-add',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const date = parseDate(params.date);
      const amount = Number(params.amount ?? 0);
      if (!Number.isFinite(amount)) {
        throw new Error('core.date-add requires a finite numeric "amount".');
      }
      return dateOutput(addDate(date, amount, canonicalUnit(params.unit)), params.output);
    },
    signature: {
      description: 'Adds a date/time amount and returns an ISO string, date string, or timestamp.',
      parameters: [
        requiredParam('date', 'any', 'Date, ISO string, or timestamp to add to.'),
        requiredParam('amount', 'number', 'Amount to add. Negative values subtract.'),
        optionalParam('unit', 'string', 'millisecond, second, minute, hour, day, week, month, or year.', 'millisecond'),
        optionalParam('output', 'string', 'iso, date, or timestamp.', 'iso'),
      ],
      allowAdditionalParameters: false,
      returns: { type: ['string', 'number'], description: 'Formatted date result.' },
    },
  };
}

export function coreDateParseClosure(): ClosureDefinition {
  return {
    name: 'core.date-parse',
    handler: async (_state, context) => {
      const value = context.parameters?.date;
      const date = value instanceof Date ? new Date(value.getTime()) : new Date(value as any);
      if (Number.isNaN(date.getTime())) {
        return { valid: false };
      }
      return { valid: true, iso: date.toISOString(), timestamp: date.getTime() };
    },
    signature: {
      description: 'Parses a date-like value without throwing; invalid inputs return `{ valid: false }`.',
      parameters: [requiredParam('date', 'any', 'Date, ISO string, or timestamp to parse.')],
      allowAdditionalParameters: false,
      returns: { type: 'object', description: 'Parse result with valid, iso, and timestamp fields.' },
    },
  };
}

export function coreDateFormatClosure(): ClosureDefinition {
  return {
    name: 'core.date-format',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const date = parseDate(params.date);
      const locale = String(params.locale ?? 'en-US');
      const options = (_.isPlainObject(params.options) ? params.options : {}) as Intl.DateTimeFormatOptions;
      return new Intl.DateTimeFormat(locale, {
        timeZone: typeof params.timeZone === 'string' ? params.timeZone : undefined,
        ...options,
      }).format(date);
    },
    signature: {
      description: 'Formats a date with Intl.DateTimeFormat.',
      parameters: [
        requiredParam('date', 'any', 'Date, ISO string, or timestamp to format.'),
        optionalParam('locale', 'string', 'BCP 47 locale.', 'en-US'),
        optionalParam('timeZone', 'string', 'IANA timezone, e.g. America/Chicago.'),
        optionalParam('options', 'object', 'Intl.DateTimeFormat options.'),
      ],
      allowAdditionalParameters: false,
      returns: { type: 'string', description: 'Localized date/time string.' },
    },
  };
}

export function coreStringReplaceClosure(): ClosureDefinition {
  return {
    name: 'core.string-replace',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const value = String(params.value ?? '');
      const search = String(params.search ?? '');
      const replacement = String(params.replacement ?? '');
      if (search === '') {
        return value;
      }
      if (params.regex) {
        return value.replace(new RegExp(search, String(params.flags ?? 'g')), replacement);
      }
      return params.all === false ? value.replace(search, replacement) : value.split(search).join(replacement);
    },
    signature: {
      description: 'Replaces text using a literal search string or regular expression.',
      parameters: [
        requiredParam('value', 'string', 'Input text.'),
        requiredParam('search', 'string', 'Literal search string or regex pattern. Empty search returns input unchanged.'),
        optionalParam('replacement', 'string', 'Replacement text.', ''),
        optionalParam('all', 'boolean', 'Replace all literal matches. Set false to replace the first match only.', true),
        optionalParam('regex', 'boolean', 'Treat search as a regular expression.', false),
        optionalParam('flags', 'string', 'Regex flags when regex is true.', 'g'),
      ],
      allowAdditionalParameters: false,
      returns: { type: 'string' },
    },
  };
}

export function coreStringSplitClosure(): ClosureDefinition {
  return {
    name: 'core.string-split',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const value = String(params.value ?? '');
      const separator = Object.prototype.hasOwnProperty.call(params, 'separator') ? String(params.separator) : '';
      const limit = params.limit === undefined ? undefined : Number(params.limit);
      return value.split(separator, Number.isFinite(limit) ? limit : undefined);
    },
    signature: {
      description: 'Splits text into an array. Omit separator to split into characters.',
      parameters: [
        requiredParam('value', 'string', 'Input text.'),
        optionalParam('separator', 'string', 'Separator string. Defaults to empty string.'),
        optionalParam('limit', 'number', 'Maximum number of parts.'),
      ],
      allowAdditionalParameters: false,
      returns: { type: 'array' },
    },
  };
}

export function coreStringSlugifyClosure(): ClosureDefinition {
  return {
    name: 'core.string-slugify',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const separator = String(params.separator ?? '-') || '-';
      const lower = params.lower !== false;
      const ascii = String(params.value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '');
      const cleaned = ascii
        .replace(/[^a-zA-Z0-9]+/g, separator)
        .replace(new RegExp(`${_.escapeRegExp(separator)}+`, 'g'), separator)
        .replace(new RegExp(`^${_.escapeRegExp(separator)}|${_.escapeRegExp(separator)}$`, 'g'), '');
      return lower ? cleaned.toLowerCase() : cleaned;
    },
    signature: {
      description: 'Converts text into a URL-safe slug.',
      parameters: [
        requiredParam('value', 'string', 'Input text.'),
        optionalParam('separator', 'string', 'Separator to place between words.', '-'),
        optionalParam('lower', 'boolean', 'Lowercase the output.', true),
      ],
      allowAdditionalParameters: false,
      returns: { type: 'string' },
    },
  };
}

function collectionValues(collection: unknown): unknown[] {
  if (Array.isArray(collection)) return collection;
  if (collection && typeof collection === 'object') return Object.values(collection);
  return [];
}

function valueAt(item: unknown, path: unknown): unknown {
  return typeof path === 'string' && path ? _.get(item, path) : item;
}

function compareValues(left: unknown, operator: unknown, right: unknown): boolean {
  switch (String(operator ?? 'equals')) {
    case 'not-equals':
      return !_.isEqual(left, right);
    case 'truthy':
      return Boolean(left);
    case 'falsy':
      return !left;
    case 'greater-than':
      return Number(left) > Number(right);
    case 'less-than':
      return Number(left) < Number(right);
    case 'includes':
      if (Array.isArray(left)) return left.some((item) => _.isEqual(item, right));
      return typeof left === 'string' && typeof right === 'string' ? left.includes(right) : false;
    case 'equals':
    default:
      return _.isEqual(left, right);
  }
}

export function coreCollectionMapClosure(): ClosureDefinition {
  return {
    name: 'core.collection-map',
    handler: async (_state, context) => collectionValues(context.parameters?.collection).map((item) => valueAt(item, context.parameters?.path)),
    signature: {
      description: 'Maps an array or object values to a field path, or returns each item when path is omitted.',
      parameters: [
        requiredParam('collection', 'any', 'Array or object to read.'),
        optionalParam('path', 'string', 'Item path to pluck. Omit to return each item.'),
      ],
      allowAdditionalParameters: false,
      returns: { type: 'array' },
    },
  };
}

export function coreCollectionFilterClosure(): ClosureDefinition {
  return {
    name: 'core.collection-filter',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      return collectionValues(params.collection).filter((item) => {
        if (typeof params.path === 'string' && params.path && !_.has(item, params.path) && !params.includeMissing) {
          return false;
        }
        return compareValues(valueAt(item, params.path), params.operator, params.value);
      });
    },
    signature: {
      description: 'Filters an array or object values by item value or path.',
      parameters: [
        requiredParam('collection', 'any', 'Array or object to filter.'),
        optionalParam('path', 'string', 'Item path to compare. Omit to compare the item itself.'),
        optionalParam('operator', 'string', 'equals, not-equals, truthy, falsy, greater-than, less-than, or includes.', 'equals'),
        optionalParam('value', 'any', 'Comparison value. False, 0, and empty strings are preserved.'),
        optionalParam('includeMissing', 'boolean', 'Allow items missing the path to be compared as undefined.', false),
      ],
      allowAdditionalParameters: false,
      returns: { type: 'array' },
    },
  };
}

export function coreCollectionReduceClosure(): ClosureDefinition {
  return {
    name: 'core.collection-reduce',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const values = collectionValues(params.collection).map((item) => valueAt(item, params.path));
      const numericValues = values.map(Number).filter((value) => Number.isFinite(value));
      switch (String(params.operation ?? 'sum')) {
        case 'count':
          return values.length;
        case 'join':
          return values.map((item) => (item == null ? '' : String(item))).join(String(params.separator ?? ','));
        case 'product':
          return numericValues.reduce((acc, item) => acc * item, Number(params.initial ?? 1));
        case 'min':
          return numericValues.length ? Math.min(...numericValues) : params.initial ?? null;
        case 'max':
          return numericValues.length ? Math.max(...numericValues) : params.initial ?? null;
        case 'sum':
        default:
          return numericValues.reduce((acc, item) => acc + item, Number(params.initial ?? 0));
      }
    },
    signature: {
      description: 'Reduces a collection with common operations.',
      parameters: [
        requiredParam('collection', 'any', 'Array or object to reduce.'),
        optionalParam('operation', 'string', 'sum, product, min, max, count, or join.', 'sum'),
        optionalParam('path', 'string', 'Item path to reduce. Omit to reduce each item.'),
        optionalParam('initial', 'number', 'Initial value for sum/product, or empty min/max fallback.'),
        optionalParam('separator', 'string', 'Join separator.', ','),
      ],
      allowAdditionalParameters: false,
      returns: { type: 'any' },
    },
  };
}

function numbersFrom(params: Record<string, unknown>): number[] {
  const raw = Array.isArray(params.values) ? params.values : [params.left, params.right].filter((value) => value !== undefined);
  return raw.map(Number);
}

function mathClosure(
  name: string,
  description: string,
  operation: (values: number[], params: Record<string, unknown>) => number,
  options?: { precision?: boolean },
): ClosureDefinition {
  return {
    name,
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const values = numbersFrom(params);
      if (values.some((value) => !Number.isFinite(value))) {
        throw new Error(`${name} requires finite numeric inputs.`);
      }
      return operation(values, params);
    },
    signature: {
      description,
      parameters: [
        optionalParam('values', 'array', 'Numeric values. Takes precedence over left/right.'),
        optionalParam('left', 'number', 'Left operand when values is omitted.'),
        optionalParam('right', 'number', 'Right operand when values is omitted.'),
        ...(options?.precision ? [optionalParam('precision', 'number', 'Decimal places for rounding.', 0)] : []),
      ],
      allowAdditionalParameters: false,
      returns: { type: 'number' },
    },
  };
}

export function createUtilityClosures(): ClosureDefinition[] {
  return [
    coreDateAddClosure(),
    coreDateParseClosure(),
    coreDateFormatClosure(),
    coreStringReplaceClosure(),
    coreStringSplitClosure(),
    coreStringSlugifyClosure(),
    coreCollectionMapClosure(),
    coreCollectionFilterClosure(),
    coreCollectionReduceClosure(),
    mathClosure('core.math-add', 'Adds numeric values.', (values) => values.reduce((acc, value) => acc + value, 0)),
    mathClosure('core.math-subtract', 'Subtracts numeric values from the first value.', (values) =>
      values.length ? values.slice(1).reduce((acc, value) => acc - value, values[0]) : 0,
    ),
    mathClosure('core.math-multiply', 'Multiplies numeric values.', (values) => values.reduce((acc, value) => acc * value, 1)),
    mathClosure('core.math-divide', 'Divides the first numeric value by remaining values.', (values, _params) => {
      if (values.slice(1).some((value) => value === 0)) {
        throw new Error('core.math-divide cannot divide by zero.');
      }
      return values.length ? values.slice(1).reduce((acc, value) => acc / value, values[0]) : 0;
    }),
    mathClosure('core.math-round', 'Rounds a number to optional decimal precision.', (values, params) => {
      const precision = Number(params.precision ?? 0);
      const factor = 10 ** precision;
      return Math.round((values[0] ?? 0) * factor) / factor;
    }, { precision: true }),
  ];
}
