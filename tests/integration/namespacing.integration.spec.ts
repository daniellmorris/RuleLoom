import { describe, expect, it } from 'vitest';
import RuleLoomEngine, { type ClosureDefinition } from 'rule-loom-engine';
import { validateRunnerConfig } from '../../packages/rule-loom-runner/src/validator.ts';

function teamClosure(): ClosureDefinition {
  return {
    namespace: 'teamA',
    name: 'double',
    aliases: ['legacy.double'],
    handler: async (_state, context) => Number(context.parameters?.value) * 2,
    signature: {
      description: 'Doubles a number.',
      parameters: [{ name: 'value', type: 'number', required: true }],
      allowAdditionalParameters: false,
      returns: { type: 'number' },
    },
  };
}

describe('closure namespacing', () => {
  it('registers canonical names and invokes aliases unambiguously', async () => {
    const engine = new RuleLoomEngine({ closures: [teamClosure()] });

    expect(engine.getClosure('teamA.double')?.name).toBe('teamA.double');
    expect(engine.getClosure('double')?.name).toBe('teamA.double');
    expect(engine.getClosure('legacy.double')?.name).toBe('teamA.double');

    engine.registerFlow({
      name: 'namespaced-flow',
      steps: [
        { closure: 'teamA.double', assign: 'fqn', parameters: { value: 3 } },
        { closure: 'legacy.double', assign: 'legacy', parameters: { value: 4 } },
        { closure: 'double', assign: 'short', parameters: { value: 5 } },
      ],
    });

    const { state } = await engine.execute('namespaced-flow');

    expect(state).toMatchObject({ fqn: 6, legacy: 8, short: 10 });
  });

  it('rejects ambiguous short aliases at registration time', () => {
    const engine = new RuleLoomEngine();
    engine.registerClosure(teamClosure());

    expect(() =>
      engine.registerClosure({
        namespace: 'teamB',
        name: 'double',
        handler: async () => 0,
      }),
    ).toThrow('Closure alias "double" is already registered');
  });

  it('validates YAML references by canonical name or alias', () => {
    const closure = teamClosure();
    const validation = validateRunnerConfig(
      {
        version: 1,
        plugins: [],
        inputs: [],
        closures: [],
        flows: [
          {
            name: 'alias-flow',
            steps: [
              { closure: 'teamA.double', parameters: { value: 2 } },
              { closure: 'legacy.double', parameters: { value: 3 } },
            ],
          },
        ],
      },
      [closure],
    );

    expect(validation.issues).toEqual([]);
    expect(validation.valid).toBe(true);
  });
});
