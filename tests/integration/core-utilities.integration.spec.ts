import { describe, expect, it } from 'vitest';
import RuleLoomEngine from 'rule-loom-engine';
import { createCoreClosures } from '../../plugins/rule-loom-core/src/closures.ts';

function engineWithCore() {
  return new RuleLoomEngine({ closures: createCoreClosures() });
}

describe('core utility closures', () => {
  it('adds dates with month-end clamping and parses invalid dates without throwing', async () => {
    const engine = engineWithCore();
    engine.registerFlow({
      name: 'date-utils',
      steps: [
        {
          closure: 'core.date-add',
          assign: 'dates.nextMonth',
          parameters: { date: '2024-01-31T00:00:00.000Z', amount: 1, unit: 'month' },
        },
        {
          closure: 'core.date-parse',
          assign: 'dates.invalid',
          parameters: { date: 'not-a-date' },
        },
        {
          closure: 'core.date-format',
          assign: 'dates.chicagoDay',
          parameters: {
            date: '2024-01-01T03:30:00.000Z',
            locale: 'en-US',
            timeZone: 'America/Chicago',
            options: { year: 'numeric', month: '2-digit', day: '2-digit' },
          },
        },
      ],
    });

    const { state } = await engine.execute('date-utils');

    expect(state.dates).toEqual({
      nextMonth: '2024-02-29T00:00:00.000Z',
      invalid: { valid: false },
      chicagoDay: '12/31/2023',
    });
  });

  it('replaces, splits, and slugifies strings predictably', async () => {
    const engine = engineWithCore();
    engine.registerFlow({
      name: 'string-utils',
      steps: [
        {
          closure: 'core.string-replace',
          assign: 'strings.firstOnly',
          parameters: { value: 'one one one', search: 'one', replacement: 'two', all: false },
        },
        {
          closure: 'core.string-replace',
          assign: 'strings.emptySearch',
          parameters: { value: 'unchanged', search: '', replacement: 'x' },
        },
        {
          closure: 'core.string-split',
          assign: 'strings.parts',
          parameters: { value: 'a,b,c', separator: ',', limit: 2 },
        },
        {
          closure: 'core.string-slugify',
          assign: 'strings.slug',
          parameters: { value: ' Café & Rules! ' },
        },
      ],
    });

    const { state } = await engine.execute('string-utils');

    expect(state.strings).toEqual({
      firstOnly: 'two one one',
      emptySearch: 'unchanged',
      parts: ['a', 'b'],
      slug: 'cafe-rules',
    });
  });

  it('maps, filters, and reduces collections while preserving falsey comparison values', async () => {
    const engine = engineWithCore();
    engine.registerFlow({
      name: 'collection-utils',
      steps: [
        {
          closure: 'core.assign',
          parameters: {
            target: 'items',
            value: [
              { id: 'a', active: false, score: 0 },
              { id: 'b', active: true, score: 2 },
              { id: 'c', active: false, score: 3 },
              { id: 'd' },
            ],
          },
        },
        {
          closure: 'core.collection-map',
          assign: 'ids',
          parameters: { collection: '${state.items}', path: 'id' },
        },
        {
          closure: 'core.collection-filter',
          assign: 'inactive',
          parameters: { collection: '${state.items}', path: 'active', operator: 'equals', value: false },
        },
        {
          closure: 'core.collection-filter',
          assign: 'zeroScores',
          parameters: { collection: '${state.items}', path: 'score', operator: 'equals', value: 0 },
        },
        {
          closure: 'core.collection-reduce',
          assign: 'scoreSum',
          parameters: { collection: '${state.items}', path: 'score', operation: 'sum' },
        },
        {
          closure: 'core.collection-reduce',
          assign: 'emptyMin',
          parameters: { collection: [], operation: 'min' },
        },
      ],
    });

    const { state } = await engine.execute('collection-utils');

    expect(state.ids).toEqual(['a', 'b', 'c', 'd']);
    expect(state.inactive).toEqual([
      { id: 'a', active: false, score: 0 },
      { id: 'c', active: false, score: 3 },
    ]);
    expect(state.zeroScores).toEqual([{ id: 'a', active: false, score: 0 }]);
    expect(state.scoreSum).toBe(5);
    expect(state.emptyMin).toBeNull();
  });

  it('runs math helpers and rejects divide by zero', async () => {
    const engine = engineWithCore();
    engine.registerFlow({
      name: 'math-utils',
      steps: [
        { closure: 'core.math-add', assign: 'math.sum', parameters: { values: [1, 2, 3] } },
        { closure: 'core.math-multiply', assign: 'math.product', parameters: { values: [2, 3, 4] } },
        { closure: 'core.math-round', assign: 'math.rounded', parameters: { left: 3.14159, precision: 2 } },
      ],
    });

    const { state } = await engine.execute('math-utils');

    expect(state.math).toEqual({ sum: 6, product: 24, rounded: 3.14 });

    const divideEngine = engineWithCore();
    divideEngine.registerFlow({
      name: 'divide-by-zero',
      steps: [{ closure: 'core.math-divide', parameters: { values: [10, 0] } }],
    });

    await expect(divideEngine.execute('divide-by-zero')).rejects.toThrow('cannot divide by zero');
  });
});
