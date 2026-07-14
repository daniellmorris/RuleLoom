# rule-loom-runner

`rule-loom-runner` loads a YAML configuration, registers closures/flows with the engine, and wires them up to the declared inputs (HTTP routes, scheduler jobs, etc.). It ships both a CLI (`ruleloom-runner`) and a programmatic API.

## Features

- HTTP executor with configurable routes, per-route flows, and automatic request snapshotting into `state.request`.
- Inline lambdas via `core.for-each` and other functional closures.
- `$call` expressions for evaluating closures (or inline steps) inside parameters.
- Bree-backed scheduler for running flows on intervals or cron expressions.
- Schema validation via Zod with helpful error messages.

## CLI Usage

```bash
npx ruleloom-runner --config path/to/config.yaml
npx ruleloom-runner validate --config path/to/config.yaml
```

Options:

- `--config, -c` – path to the YAML config (defaults to `config.yaml`).
HTTP ports are configured per input in YAML (`inputs[].config.port`).

## Library Usage

```ts
import { createRunner, startRunner } from 'rule-loom-runner';

const instance = await createRunner('config.yaml');
console.log(instance.config.flows.map((flow) => flow.name));
await instance.close();
```

`createRunner` returns the engine, parsed config, initialized services, runner-scoped plugin inventory, lifecycle events, logger, and `close()` cleanup function. HTTP inputs start listening during creation.

## Configuration Schema

High-level structure:

```yaml
version: 1
logger:
  level: info
inputs:
  - type: http
    config:
      port: 4000
      runnerEndpoint:
        enabled: false
    triggers:
      - method: post
        path: /echo
        flow: echo-request
  - type: scheduler
    triggers:
      - name: heartbeat
        flow: heartbeat
        interval: "1m"
closures:
  - type: module           # optional custom closures
  - type: flow             # config-defined closure flows
  # Load core/http plugins explicitly in the top-level plugins array.
flows:
  - name: echo-request
    steps:
      - closure: capture-request
      - when:
          closure: core.truthy
          parameters:
            value: "${state.payload}"
      - closure: core.respond
        parameters:
          status: 200
          body: "${state.payload}"
```

See [Configuration How-To](../../docs/CONFIGURATION.md) for the full schema, examples of `$call`, branches, inline steps, and closure types.

### Scheduler Example

```yaml
inputs:
  - type: scheduler
    triggers:
      - name: heartbeat
        flow: heartbeat-flow
        interval: "1m"
        runtime:
          source: scheduler
```

Each job executes the named flow using the runner’s engine; scheduler services expose job state for orchestration and testing.

## Development

- `npm run dev` (at repo root) launches the runner via `ts-node` with `packages/rule-loom-runner/config/example.http.yaml`.
- TypeScript build: `npm run build --workspace rule-loom-runner`.
- Tests covering runner/engine features live in `tests/engine.spec.ts` and `tests/integration/`.
