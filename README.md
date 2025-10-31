# TreeExe Monorepo

A fresh monorepo that houses the TreeExe runtime stack:

- **tree-exe-engine** – a lightweight closure execution engine. It knows how to run flows composed of named closures, but ships without any built-in domain logic.
- **tree-exe-runner** – a CLI/library that loads a YAML config, registers closures (template or module-based), and exposes the flows via an HTTP server.
- **tree-exe-orchestrator** – aggregates multiple Runner configs under a single Express server so you can operate several flows behind one entrypoint.

## Packages

| Package | Description | Entry Points |
| --- | --- | --- |
| `tree-exe-lib` | Shared utilities (logging, future helpers). | `src/index.ts` |
| `tree-exe-engine` | Core execution primitives (closures + flows, branching, conditionals). | `src/index.ts` (`TreeExeEngine`) |
| `tree-exe-core` | Core closure bundle (assign/respond/log/boolean helpers). | `src/index.ts` |
| `tree-exe-runner` | Config loader, HTTP executor, CLI (`treeexe-runner`). | `src/index.ts`, `src/cli.ts` |
| `tree-exe-orchestrator` | Multi-config coordinator, CLI (`treeexe-orchestrator`). | `src/index.ts`, `src/cli.ts` |

All packages target ESM builds with generated type definitions.

## Getting Started

```bash
npm install
npm run build
```

### Run a single config

```
npx treeexe-runner --config packages/tree-exe-runner/config/example.http.yaml --port 4001
```

Once the CLI stands up, POST to `http://localhost:4001/echo` and the sample flow will echo the request body back.

### Orchestrate multiple configs

```
npx treeexe-orchestrator --config packages/tree-exe-orchestrator/config/example.orchestrator.yaml --port 4100
```

This mounts the sample runner under `/echo` on a shared Express app.

## Concepts

### Closures

Closures are plain async functions that mutate the shared state or return values. The engine exposes `TreeExeEngine` for registering closures and executing flows, and the runner can provision closures from configuration:

- **Core bundle** – `type: core` pulls in the TreeExe Core library (assign/respond/log/truthy/equals/greater-than/less-than/includes/length helpers) so you always have baseline functionality.
- **Template closures** – `set-state` and `respond` templates remain available for quick one-offs without writing code.
- **Flow closures** – `type: flow` lets you author a closure as a mini flow; the engine will evaluate those steps whenever the closure is invoked.
- **Module closures** – load custom closure factories/functions from local modules. The module can export a single closure, an array, or a factory that receives configuration.
A quick reference for the core bundle:

| Closure | Purpose |
| --- | --- |
| `core.assign` | Write or merge a value into `state` using a dot-path target. |
| `core.respond` | Populate `state.response` with status/body/headers for HTTP responses. |
| `core.log` | Log a message using the configured logger (or `console`). |
| `core.truthy` | Returns `true` when the supplied value is truthy. |
| `core.equals` | Deep equality comparison between `left` and `right`. |
| `core.greater-than` / `core.less-than` | Numeric comparisons between `left` and `right`. |
| `core.includes` | Checks for membership within arrays, strings, or object values. |
| `core.length` | Returns the length/size of arrays, strings, or objects. |
| `core.for-each` | Iterates over a collection and runs inline `steps` for each element. |

### Flows

Flows are ordered steps that call closures. Each invoke step can specify:

- `parameters` – interpolated via `${}` from state or runtime metadata.
- `assign` / `mergeResult` – write the return value back into state.
- `when` – run only when one or more condition closures evaluate truthy.

For richer branching, `type: branch` steps let you list condition → step blocks with an optional `otherwise`, giving you a “case/when” style control structure inside the flow definition.

### State vs Runtime vs Parameters

Every closure receives the same three objects:

- **`state`** – shared, mutable working data. The runner seeds it with the incoming HTTP request (under `state.request`) and any values you add during the flow stay available to later steps.
- **`runtime`** – read-only execution context (logger, route metadata, request ID, etc.). It also includes a reference to the `TreeExeEngine` so flow-based closures can call back into the engine.
- **`parameters`** – the arguments for the current step. The engine applies string templating before invoking the closure, so `${state.order.userId}` or `${runtime.requestId}` become concrete values.

A minimal flow that demonstrates the trio lives at `packages/tree-exe-runner/config/example.state-runtime.yaml` and contains this step sequence:

```yaml
flows:
  - name: demo-state-runtime
    steps:
      - closure: core.assign            # writes request body into state.order
        parameters:
          target: order
          value: "${request.body}"
      - closure: core.log               # reads both state and runtime
        parameters:
          level: info
          message: "processing ${state.order.userId} (req ${runtime.requestId})"
      - closure: core.respond           # uses parameter interpolation again
        parameters:
          status: 200
          body:
            ok: true
            echo: "${state.order}"
```

When the HTTP executor triggers this flow, `state` accumulates the `order`, `runtime` still exposes things like `runtime.requestId`, and each step gets its own resolved `parameters` bundle (e.g., the log message above).

The sample `packages/tree-exe-runner/config/example.http.yaml` shows conditional branching without explicitly setting `type: branch` by relying on the presence of `cases`.

Inline “lambda” steps are supported by closures like `core.for-each`. You can provide `steps` directly at the invocation site and the engine will run them for each element:

```yaml
- closure: core.for-each
  collection: "${state.payload.items}"
  steps:
    - closure: core.log
      parameters:
        message: "processing ${state.currentItem}"
    - closure: core.assign
      parameters:
        target: "processed.${state.currentIndex}"
        value: "${state.currentItem}"
```

See `packages/tree-exe-runner/config/example.http.yaml` for the full context.

### Orchestrator

The orchestrator parses its own YAML file pointing at one or more Runner configs. It creates each runner, mounts their Express apps under optional base paths, and exposes a health endpoint at `/__treeexe/health`.

## Development

- TypeScript configuration is shared via `tsconfig.base.json`.
- Packages use project references so `npm run build` compiles engine → runner → orchestrator in order.
- CLI entrypoints are emitted into `dist/cli.js` per package.
- Unit tests live under `tests/` and can be executed with `npm run test`. They cover inferred branch steps and flow-based closures.

Feel free to extend the runner with extra templates or add new executors (AMQP, MQTT, etc.) as the next step.
