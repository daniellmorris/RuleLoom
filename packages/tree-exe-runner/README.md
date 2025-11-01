# tree-exe-runner

`tree-exe-runner` loads a YAML configuration, registers closures/flows with the engine, and exposes them through an Express HTTP server. It ships both a CLI (`treeexe-runner`) and a programmatic API.

## Features

- HTTP executor with configurable routes, per-route flows, and automatic request snapshotting into `state.request`.
- Inline lambdas via `core.for-each` and other functional closures.
- `$call` expressions for evaluating closures (or inline steps) inside parameters.
- Schema validation via Zod with helpful error messages.

## CLI Usage

```bash
npx treeexe-runner --config path/to/config.yaml --port 4000
```

Options:

- `--config, -c` – path to the YAML config (defaults to `config.yaml`).
- `--port, -p` – override the port declared in the config.

## Library Usage

```ts
import { createRunner, startRunner } from 'tree-exe-runner';

const instance = await createRunner('config.yaml');
await instance.listen();
// ... later
await instance.close();
```

`createRunner` returns the underlying `TreeExeEngine`, Express app, resolved config metadata, and convenience `listen/close` helpers.

## Configuration Schema

High-level structure:

```yaml
version: 1
logger:
  level: info
server:
  http:
    port: 3030
    routes:
      - method: post
        path: /echo
        flow: echo-request
closures:
  - type: core             # import TreeExe Core bundle
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

## Development

- `npm run dev` (at repo root) launches the runner via `ts-node` with `packages/tree-exe-runner/config/example.http.yaml`.
- TypeScript build: `npm run build --workspace tree-exe-runner`.
- Tests covering runner/engine features live in `tests/engine.spec.ts`.
