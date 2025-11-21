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
npx ruleloom-runner --config path/to/config.yaml --port 4000
```

Options:

- `--config, -c` – path to the YAML config (defaults to `config.yaml`).
- `--port, -p` – port to listen on (defaults to `3000` when omitted).

## Library Usage

```ts
import { createRunner, startRunner } from 'rule-loom-runner';

const instance = await createRunner('config.yaml');
await instance.listen();
// ... later
await instance.close();
```

`createRunner` returns the underlying `RuleLoomEngine`, Express app, resolved config metadata, and convenience `listen/close` helpers.

## Configuration Schema

High-level structure:

```yaml
version: 1
logger:
  level: info
inputs:
  - type: http
    routes:
      - method: post
        path: /echo
        flow: echo-request
  - type: scheduler
    jobs:
      - name: heartbeat
        flow: heartbeat
        interval: "1m"
closures:
  - type: bundle           # built-in bundles (preset: core/http/...)
    preset: core
  - type: module           # optional custom closures
  - type: flow             # config-defined closure flows
flows:
  - name: echo-request
    steps:
      - closure: capture-request
      - when:
          closure: core.truthy
          parameters:
            value: "${state.payload}"
        steps:
          - closure: respond-success
        otherwise:
          - closure: respond-empty
```

See [Configuration How-To](../../docs/CONFIGURATION.md) for the full schema, examples of `$call`, branches, inline steps, and closure types.

### Scheduler Example

```yaml
inputs:
  - type: scheduler
    jobs:
      - name: heartbeat
        flow: heartbeat-flow
        interval: "1m"
        runtime:
          source: scheduler
```

Each job executes the named flow using the runner’s engine; results are recorded on `runner.scheduler.jobStates`.

## Development

- `npm run dev` (at repo root) launches the runner via `ts-node` with `packages/rule-loom-runner/config/example.http.yaml`.
- TypeScript build: `npm run build --workspace rule-loom-runner`.
- Tests covering runner/engine features live in `tests/engine.spec.ts`.
