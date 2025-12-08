# rule-loom-engine

`rule-loom-engine` is the heart of the RuleLoom platform. It executes flows made of named closures, handles branching/conditions, supports inline step bundles, and resolves `$call` directives that run closures or nested flows inside parameter objects.

## Key Concepts

- **Closures** – named functions with access to `state`, `runtime`, and resolved `parameters`.
- **Flows** – ordered steps referencing closures. Each step may define `when` conditions, `assign`/`mergeResult` behaviour, or inline `$call` expressions.
- **State / Runtime / Parameters** – shared mutable state, read-only runtime context (logger, request data, active engine), and per-step arguments (templated before execution).
- **Step Parameters** – parameters typed as `flowSteps` in a closure signature bypass templating and are delivered as raw `FlowStep[]` (used by iterators like `core.for-each` and branching).
- **`$call` directive** – embed `{ $call: { name, parameters } }` or `{ $call: { steps: [...] } }` inside parameters to execute another closure or step bundle and use the result inline.

## Usage

```ts
import RuleLoomEngine, { type ClosureDefinition } from 'rule-loom-engine';

const closures: ClosureDefinition[] = [
  {
    name: 'assign-total',
    handler: (state, context) => {
      state.total = context.parameters?.value;
      return state.total;
    },
  },
  {
    name: 'format-total',
    handler: (_state, context) => `Total:${context.parameters?.value}`,
  },
];

const engine = new RuleLoomEngine({
  closures,
  flows: [
    {
      name: 'demo',
      steps: [
        { closure: 'assign-total', parameters: { value: 42 } },
        {
          closure: 'assign-total',
          parameters: {
            value: {
              $call: {
                name: 'format-total',
                parameters: { value: '${state.total}' },
              },
            },
          },
        },
      ],
    },
  ],
});

const result = await engine.execute('demo');
console.log(result.state.total); // "Total:42"
```

## API Surface

- `new RuleLoomEngine({ closures?, flows? })`
- `engine.registerClosure(definition)` / `registerClosures([...])`
- `engine.registerFlow(flow)` / `registerFlows([...])`
- `engine.execute(flowName, initialState?, runtimeContext?)`
- `engine.runSteps(steps, state, runtime)` – exposed for advanced scenarios (flow closures, iterators).

## Parameter Resolution

The engine automatically:

- Interpolates `${state.foo}` / `${runtime.bar}` / `${parameters.baz}` inside strings.
- Resolves pure `${…}` strings to non-string values (numbers, objects, arrays).
- Executes `$call` directives, either referencing another closure or an inline `steps` array (behaves like a lambda).
- Skips interpolation for parameters typed `flowSteps` in the closure signature.

## Development Notes

- Implement new closures as `ClosureDefinition` objects; declare step-array parameters in the signature with type `flowSteps` when you need raw step arrays.
- Changes to resolution or branching logic should be accompanied by tests in `tests/engine.spec.ts` (run via `npm run test`).
- Build with `npm run build --workspace rule-loom-engine` or from the repo root.
