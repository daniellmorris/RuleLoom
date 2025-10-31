# tree-exe-engine

`tree-exe-engine` is the heart of the TreeExe platform. It executes flows made of named closures, handles branching/conditions, supports inline step bundles, and resolves `$call` directives that run closures or nested flows inside parameter objects.

## Key Concepts

- **Closures** – named functions with access to `state`, `runtime`, and resolved `parameters`.
- **Flows** – ordered steps referencing closures. Each step may define `when` conditions, `assign`/`mergeResult` behaviour, or inline `$call` expressions.
- **State / Runtime / Parameters** – shared mutable state, read-only runtime context (logger, request data, active engine), and per-step arguments (templated before execution).
- **Functional Parameters** – closures can declare `functionalParams` so specific parameter keys bypass templating and stay as `FlowStep[]` (used by iterators like `core.for-each`).
- **`$call` directive** – embed `{ $call: { name, parameters } }` or `{ $call: { steps: [...] } }` inside parameters to execute another closure or step bundle and use the result inline.

## Usage

```ts
import TreeExeEngine, { type ClosureDefinition } from 'tree-exe-engine';

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

const engine = new TreeExeEngine({
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

- `new TreeExeEngine({ closures?, flows? })`
- `engine.registerClosure(definition)` / `registerClosures([...])`
- `engine.registerFlow(flow)` / `registerFlows([...])`
- `engine.execute(flowName, initialState?, runtimeContext?)`
- `engine.runSteps(steps, state, runtime)` – exposed for advanced scenarios (flow closures, iterators).

## Parameter Resolution

The engine automatically:

- Interpolates `${state.foo}` / `${runtime.bar}` / `${parameters.baz}` inside strings.
- Resolves pure `${…}` strings to non-string values (numbers, objects, arrays).
- Executes `$call` directives, either referencing another closure or an inline `steps` array (behaves like a lambda).
- Honors `functionalParams` declared on closures by skipping interpolation for those keys.

## Development Notes

- Implement new closures as `ClosureDefinition` objects; use `functionalParams` when your closure should receive raw step arrays.
- Changes to resolution or branching logic should be accompanied by tests in `tests/engine.spec.ts` (run via `npm run test`).
- Build with `npm run build --workspace tree-exe-engine` or from the repo root.
