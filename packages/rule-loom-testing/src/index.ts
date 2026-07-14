import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import _ from 'lodash';
import { z } from 'zod';
import { assertSafeObject, assertSafePath, type ClosureDefinition, type ClosureHandler, type RecorderEvent } from 'rule-loom-engine';
import { createRunner } from 'rule-loom-runner';
import { resetClosureRegistry } from 'rule-loom-runner/closureRegistry';
import { resetLoadedPlugins } from 'rule-loom-runner/pluginLoader';

const patchSchema = z.record(z.any()).optional();

const mockSchema = z.object({
  name: z.string().min(1),
  id: z.string().min(1).optional(),
  callIndex: z.number().int().positive().optional(),
  output: z.any().optional(),
  sequence: z.array(z.any()).optional(),
  error: z.string().optional(),
  passthrough: z.boolean().optional(),
  when: z.record(z.any()).optional(),
  set: patchSchema,
  patchAfter: patchSchema,
});

const nodeExpectationSchema = z.object({
  id: z.string().min(1),
  callIndex: z.number().int().positive().optional(),
  output: z.any().optional(),
  state: z.any().optional(),
});

const testSchema = z.object({
  name: z.string().min(1),
  flow: z.string().min(1),
  state: z.record(z.any()).optional(),
  seed: z.record(z.any()).optional(),
  mocks: z.array(mockSchema).optional(),
  expect: z.object({
    match: z.enum(['partial', 'exact']).optional().default('partial'),
    nodes: z.array(nodeExpectationSchema).optional(),
    response: z.any().optional(),
    state: z.any().optional(),
  }).optional(),
});

const testsFileSchema = z.object({
  tests: z.array(testSchema).default([]),
}).passthrough();

export type RuleLoomYamlTest = z.infer<typeof testSchema>;
export type RuleLoomYamlMock = z.infer<typeof mockSchema>;

export interface RuleLoomTestFailure {
  message: string;
  expected?: unknown;
  actual?: unknown;
  path?: string;
  trace?: RecorderEvent[];
}

export interface RuleLoomTestResult {
  name: string;
  flow: string;
  passed: boolean;
  failures: RuleLoomTestFailure[];
  trace: RecorderEvent[];
  state?: Record<string, unknown>;
  output?: unknown;
  error?: string;
}

export interface RuleLoomTestRunResult {
  configPath: string;
  passed: boolean;
  results: RuleLoomTestResult[];
}

export interface RunYamlTestsOptions {
  configPath: string;
}

type ActiveStep = { step?: string; closure?: string };

export async function runYamlTests(options: RunYamlTestsOptions): Promise<RuleLoomTestRunResult> {
  const configPath = path.resolve(options.configPath);
  const raw = await fs.readFile(configPath, 'utf8');
  const parsed = testsFileSchema.parse((yaml.load(raw) ?? {}) as unknown);
  const tests = parsed.tests;
  const results: RuleLoomTestResult[] = [];

  for (const test of tests) {
    results.push(await runSingleYamlTest(configPath, test));
  }

  return {
    configPath,
    passed: results.every((result) => result.passed),
    results,
  };
}

async function runSingleYamlTest(configPath: string, test: RuleLoomYamlTest): Promise<RuleLoomTestResult> {
  resetLoadedPlugins();
  resetClosureRegistry();

  const runner = await createRunner(configPath);
  const trace: RecorderEvent[] = [];
  const activeSteps: ActiveStep[] = [];
  const recorder = {
    onEvent: (event: RecorderEvent) => {
      trace.push(event);
      if (event.kind === 'enter') {
        activeSteps.push({ step: event.step, closure: event.closure });
      } else if (event.kind === 'exit' || event.kind === 'error') {
        const idx = findActiveStepIndex(activeSteps, event);
        if (idx >= 0) activeSteps.splice(idx, 1);
      }
    },
  };
  const restore = installMocks(runner.engine, test.mocks ?? [], activeSteps);

  try {
    const initialState = _.cloneDeep(test.state ?? test.seed ?? {});
    const result = await runner.engine.execute(test.flow, initialState, {
      recorder,
      recordLevel: 'full',
      testing: true,
      simulate: true,
    });
    const failures = evaluateExpectations(test, result.state, result.lastResult, trace);
    return {
      name: test.name,
      flow: test.flow,
      passed: failures.length === 0,
      failures,
      trace,
      state: result.state,
      output: result.lastResult,
    };
  } catch (err) {
    const failures = [{
      message: err instanceof Error ? err.message : String(err),
      trace,
    }];
    return {
      name: test.name,
      flow: test.flow,
      passed: false,
      failures,
      trace,
      error: failures[0].message,
    };
  } finally {
    restore();
    await runner.close();
  }
}

function installMocks(engine: any, mocks: RuleLoomYamlMock[], activeSteps: ActiveStep[]): () => void {
  const restored: Array<() => void> = [];
  const byName = new Map<string, RuleLoomYamlMock[]>();
  mocks.forEach((mock) => {
    byName.set(mock.name, [...(byName.get(mock.name) ?? []), mock]);
  });
  const closureCallCounts = new Map<string, number>();
  const mockCallCounts = new WeakMap<RuleLoomYamlMock, number>();

  for (const [name, closureMocks] of byName.entries()) {
    const closure = engine.getClosure(name) as ClosureDefinition | undefined;
    if (!closure) {
      throw new Error(`Mock references unknown closure "${name}".`);
    }
    const original = closure.handler;
    const originalSimulator = closure.simulate;
    const mockHandler: ClosureHandler = async (state, context) => {
      const callIndex = (closureCallCounts.get(name) ?? 0) + 1;
      closureCallCounts.set(name, callIndex);
      const active = findActiveForClosure(activeSteps, name);
      const mock = closureMocks.find((candidate) => mockMatches(candidate, active, callIndex, context.parameters));
      if (!mock) return original(state, context);
      if (mock.passthrough && (closure.capabilities ?? ['process']).some((capability) => capability !== 'pure')) {
        throw new Error(`Mock passthrough is not allowed for side-effect closure "${name}" during simulation.`);
      }
      return executeMock(mock, original, state, context);
    };
    closure.handler = mockHandler;
    closure.simulate = mockHandler;
    restored.push(() => {
      closure.handler = original;
      closure.simulate = originalSimulator;
    });
  }

  async function executeMock(
    mock: RuleLoomYamlMock,
    original: ClosureHandler,
    state: Record<string, unknown>,
    context: Parameters<ClosureHandler>[1],
  ): Promise<unknown> {
    applyPatchMap(state, mock.set);
    let result: unknown;
    if (mock.error) {
      throw new Error(mock.error);
    }
    if (mock.passthrough) {
      result = await original(state, context);
    } else if (mock.sequence) {
      const idx = mockCallCounts.get(mock) ?? 0;
      mockCallCounts.set(mock, idx + 1);
      result = _.cloneDeep(mock.sequence[Math.min(idx, mock.sequence.length - 1)]);
    } else {
      result = _.cloneDeep(mock.output);
    }
    applyPatchMap(state, mock.patchAfter);
    return result;
  }

  return () => restored.reverse().forEach((fn) => fn());
}

function mockMatches(
  mock: RuleLoomYamlMock,
  active: ActiveStep | undefined,
  callIndex: number,
  parameters: Record<string, unknown> | undefined,
): boolean {
  if (mock.callIndex && mock.callIndex !== callIndex) return false;
  if (mock.id && mock.id !== active?.step) return false;
  if (mock.when && !objectContains(parameters ?? {}, mock.when)) return false;
  return true;
}

function findActiveForClosure(activeSteps: ActiveStep[], closure: string): ActiveStep | undefined {
  for (let i = activeSteps.length - 1; i >= 0; i -= 1) {
    if (activeSteps[i].closure === closure) return activeSteps[i];
  }
  return undefined;
}

function findActiveStepIndex(activeSteps: ActiveStep[], event: RecorderEvent): number {
  for (let i = activeSteps.length - 1; i >= 0; i -= 1) {
    if (activeSteps[i].step === event.step && activeSteps[i].closure === event.closure) return i;
  }
  return -1;
}

function applyPatchMap(state: Record<string, unknown>, patch?: Record<string, unknown>): void {
  if (!patch) return;
  assertSafeObject(patch, 'YAML test state patch');
  Object.entries(patch).forEach(([key, value]) => {
    assertSafePath(key, 'YAML test state patch path');
    _.set(state, key, _.cloneDeep(value));
  });
}

function evaluateExpectations(
  test: RuleLoomYamlTest,
  state: Record<string, unknown>,
  output: unknown,
  trace: RecorderEvent[],
): RuleLoomTestFailure[] {
  const failures: RuleLoomTestFailure[] = [];
  const expectation = test.expect;
  if (!expectation) return failures;
  const exact = expectation.match === 'exact';

  if ('response' in expectation) {
    addMatchFailure(failures, 'response', expectation.response, _.get(state, 'response'), trace, exact);
  }
  if ('state' in expectation) {
    addMatchFailure(failures, 'state', expectation.state, state, trace, exact);
  }

  (expectation.nodes ?? []).forEach((node) => {
    const event = findNodeExit(trace, node.id, node.callIndex);
    if (!event) {
      failures.push({ message: `No exit event recorded for node "${node.id}".`, path: `nodes.${node.id}`, trace });
      return;
    }
    if ('output' in node) {
      addMatchFailure(failures, `nodes.${node.id}.output`, node.output, (event as any).output, trace, exact);
    }
    if ('state' in node) {
      addMatchFailure(failures, `nodes.${node.id}.state`, node.state, (event as any).stateAfter, trace, exact);
    }
  });

  if (expectation.nodes?.length === 0 && output === undefined) {
    return failures;
  }
  return failures;
}

function findNodeExit(trace: RecorderEvent[], id: string, callIndex?: number): RecorderEvent | undefined {
  const matches = trace.filter((event) => event.kind === 'exit' && event.step === id);
  if (!matches.length) return undefined;
  if (callIndex) return matches[callIndex - 1];
  return matches[matches.length - 1];
}

function addMatchFailure(
  failures: RuleLoomTestFailure[],
  pathName: string,
  expected: unknown,
  actual: unknown,
  trace: RecorderEvent[],
  exact = false,
): void {
  if (matchesExpected(actual, expected, exact)) return;
  failures.push({
    message: `Expectation failed at ${pathName}.`,
    path: pathName,
    expected,
    actual,
    trace,
  });
}

function matchesExpected(actual: unknown, expected: unknown, exact = false): boolean {
  if (!exact && _.isPlainObject(expected) && _.isPlainObject(actual)) {
    return objectContains(actual as Record<string, unknown>, expected as Record<string, unknown>);
  }
  return _.isEqual(actual, expected);
}

function objectContains(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, expectedValue]) => {
    const actualValue = (actual as any)[key];
    if (_.isPlainObject(expectedValue) && _.isPlainObject(actualValue)) {
      return objectContains(actualValue as Record<string, unknown>, expectedValue as Record<string, unknown>);
    }
    if (Array.isArray(expectedValue)) return _.isEqual(actualValue, expectedValue);
    return _.isEqual(actualValue, expectedValue);
  });
}
