# RuleLoom Architecture

RuleLoom is organised as a set of focused packages layered on top of each other:

```
┌─────────────────────────────────────────────────────────┐
│                  rule-loom-orchestrator                  │
│        (mounts multiple runner instances per config)    │
└─────────────────────────────────────────────────────────┘
                ▲                       ▲
                │                       │
┌───────────────────────────┐   ┌───────────────────────────┐
│     rule-loom-inputs       │   │       External Config     │
│ (HTTP/Scheduler adapters) │   │  (YAML files referencing  │
└──────────────▲────────────┘   │        closures/flows)    │
               │                └───────────────────────────┘
┌──────────────┴────────────┐
│      rule-loom-runner      │
│ (loads YAML, wires inputs)│
└──────────────▲────────────┘
               │
┌──────────────┴────────────┐
│       rule-loom-engine      │
│  (closure execution core)  │
└──────────────▲────────────┘
               │
┌──────────────┴────────────┐
│  rule-loom-core / rule-loom-lib  │
│           (shared libs)        │
└───────────────────────────┘
```

## Package Roles

### rule-loom-lib
Shared utilities (currently a structured logger) that provide consistent interfaces for higher-level packages.

### rule-loom-engine
- Registers closures (`ClosureDefinition`) and flows (`FlowDefinition`).
- Executes steps sequentially, supporting `when` conditions, branching, and nested flow execution via `runSteps`.
- Resolves parameter templates (`${state.foo}`, `${runtime.requestId}`), `$call` directives (closure or inline steps), and honours `functionalParams` metadata for closures that expect raw `FlowStep[]` values.
- Provides execution context objects:
  - `state`: shared mutable data across the flow.
  - `runtime`: read-only metadata (logger, request info, active engine).
  - `parameters`: per-step arguments after template resolution.

### rule-loom-core
Supplies reusable closures (assign/respond/log/comparisons/iterators) that follow engine conventions. Closures can declare `functionalParams` when they need raw step arrays (e.g., `core.for-each`).

### rule-loom-inputs
- Encapsulates concrete input adapters (Express HTTP server, Bree scheduler, future AMQP/MQTT bridges).
- Each adapter exports factories so higher layers can opt-in without pulling heavy dependencies directly.
- Emits lifecycle events (e.g., scheduler job state transitions) consumed by the orchestrator for metrics.

### rule-loom-runner
- Parses YAML configs with Zod, builds closure lists (core/module/flow), and instantiates the selected inputs from `rule-loom-inputs`.
- HTTP adapters inject the request into `state.request` and pass route metadata through `runtime`.
- Provides CLI/programmatic APIs for running a single configuration.
- Starts scheduler inputs when declared, emitting events for observability.

### rule-loom-orchestrator
- Loads multiple runner configs, mounts their Express apps under configurable base paths.
- Exposes a combined health endpoint and shared logging.
- Persists runner definitions in SQLite via Prisma so API mutations survive orchestrator restarts. Configure the storage location with the `RULE_LOOM_DATABASE_URL` environment variable.

## Execution Flow

1. Runner (or custom code) calls `engine.execute(flowName, initialState, runtime)`.
2. Engine clones `initialState`, attaches itself to `runtime.engine`, and iterates steps.
3. For each step:
   - If `when` exists, evaluate conditions via registered closures.
   - If the step contains `cases` and no `closure`, treat it as a branch and evaluate each case in order.
   - Otherwise, resolve parameters (interpolate templates, execute `$call`, reinsert functional parameter blocks) and invoke the closure.
   - Handle `assign`/`mergeResult` to update state.
4. `$call` directives:
   - `{ $call: { name, parameters } }` executes another closure immediately.
   - `{ $call: { steps: [...] } }` evaluates the inline step bundle through `runtime.engine.runSteps` and returns its last result.
5. Flow completes; engine returns `{ state, lastResult }` to the caller.

## Data Model

- **State** – mutable object shared by all steps. Runners seed `state.request`. Core closures may add helper fields (`state.currentItem`, `state.response`, etc.).
- **Runtime** – contextual metadata (logger, requestId, route description, active engine). Intended to stay read-only.
- **Parameters** – closure arguments after interpolation and `$call` expansion. Closure definitions can tweak how they receive parameters via `functionalParams`.

## Extensibility Guidelines

- To add new reusable closures, export factories from `rule-loom-core` and register them in `createCoreClosures()`.
- When creating custom closures in applications, declare `functionalParams` if the closure should handle raw step arrays (iterators, retries, transactions, etc.).
- Enhance the engine’s resolution logic in `resolveDynamicValues`, `prepareParameters`, or `$call` handlers when introducing new parameter conventions.
- Use the runner schema (`packages/rule-loom-runner/src/config.ts`) as the canonical place to describe YAML structure; any new closure metadata should be reflected there for validation.
