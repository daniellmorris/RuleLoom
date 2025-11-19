import { strict as assert } from 'node:assert';
import RuleLoomEngine from 'rule-loom-engine';
import { createCoreClosures } from 'rule-loom-core';

async function testBranchInference() {
  const engine = new RuleLoomEngine({
    closures: createCoreClosures(),
  });

  engine.registerFlow({
    name: 'order-evaluation',
    steps: [
      {
        closure: 'core.assign',
        parameters: {
          target: 'order.total',
          value: '${state.request.body.total}',
        },
      },
      {
        cases: [
          {
            when: {
              closure: 'core.greater-than',
              parameters: {
                left: '${state.order.total}',
                right: 100,
              },
            },
            steps: [
              {
                closure: 'core.log',
                parameters: {
                  level: 'info',
                  message: 'High value order for ${state.request.body.userId}',
                },
              },
              {
                cases: [
                  {
                    when: {
                      closure: 'core.truthy',
                      parameters: {
                        value: '${state.request.body.items}',
                      },
                    },
                    steps: [
                      {
                        closure: 'core.respond',
                        parameters: {
                          status: 202,
                          body: {
                            status: 'queued',
                            category: 'vip',
                          },
                        },
                      },
                    ],
                  },
                ],
                otherwise: [
                  {
                    closure: 'core.respond',
                    parameters: {
                      status: 400,
                      body: { error: 'missing items' },
                    },
                  },
                ],
              },
            ],
          },
        ],
        otherwise: [
          {
            closure: 'core.respond',
            parameters: {
              status: 200,
              body: {
                status: 'accepted',
                category: 'standard',
              },
            },
          },
        ],
      },
    ],
  });

  const { state } = await engine.execute(
    'order-evaluation',
    {
      request: {
        body: {
          userId: 'abc-123',
          total: 150,
          items: ['A1'],
        },
      },
    },
    { requestId: 'REQ-1' },
  );

  assert.equal(state.response?.status, 202);
  assert.equal(state.response?.body?.category, 'vip');
}

async function testFlowClosure() {
  const engine = new RuleLoomEngine({
    closures: createCoreClosures(),
  });

  engine.registerClosure({
    name: 'flow.respond-standard',
    handler: (state, context) => {
      const runtimeEngine = context.runtime.engine ?? engine;
      return runtimeEngine.runSteps(
        [
          {
            closure: 'core.respond',
            parameters: {
              status: 200,
              body: {
                status: 'accepted',
                total: '${state.order.total}',
              },
            },
          },
        ],
        state,
        context.runtime,
      );
    },
  });

  engine.registerFlow({
    name: 'flow-wrapper',
    steps: [
      {
        closure: 'core.assign',
        parameters: {
          target: 'order.total',
          value: '${runtime.payload.total}',
        },
      },
      {
        closure: 'flow.respond-standard',
      },
    ],
  });

  const { state } = await engine.execute(
    'flow-wrapper',
    {},
    {
      payload: { total: 42 },
      requestId: 'REQ-2',
    },
  );

  assert.equal(state.response?.status, 200);
  assert.equal(state.response?.body?.total, 42);
}

async function testForEachClosure() {
  const engine = new RuleLoomEngine({
    closures: createCoreClosures(),
  });

  engine.registerFlow({
    name: 'collection-handler',
    steps: [
      {
        closure: 'core.assign',
        parameters: {
          target: 'items',
          value: ['A', 'B', 'C'],
        },
      },
      {
        closure: 'core.for-each',
        parameters: {
          collection: '${state.items}',
          steps: [
            {
              type: 'invoke',
              closure: 'core.assign',
              parameters: {
                target: 'processed.${state.currentIndex}',
                value: '${state.currentItem}',
              },
            },
          ],
        },
      },
    ],
  });

  const { state } = await engine.execute('collection-handler');

  assert.deepEqual(state.processed, ['A', 'B', 'C']);
  assert.ok(!('currentItem' in state));
  assert.ok(!('currentIndex' in state));
}

async function testClosureParameterReference() {
  const engine = new RuleLoomEngine({
    closures: createCoreClosures(),
  });

  engine.registerFlow({
    name: 'closure-parameter-flow',
    steps: [
      {
        closure: 'core.assign',
        parameters: {
          target: 'order.amount',
          value: 50,
        },
      },
      {
        closure: 'core.assign',
        parameters: {
          target: 'formatted',
          value: {
            $call: {
              steps: [
                {
                  closure: 'core.assign',
                  parameters: {
                    target: 'result',
                    value: 'Value:${state.order.amount}',
                  },
                },
              ],
            },
          },
        },
      },
    ],
  });

  const { state } = await engine.execute('closure-parameter-flow');
  assert.equal(state.formatted, 'Value:50');
}

async function run() {
  await testBranchInference();
  await testFlowClosure();
  await testForEachClosure();
  await testClosureParameterReference();
  // eslint-disable-next-line no-console
  console.log('All engine tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
