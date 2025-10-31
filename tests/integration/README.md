# Integration Tests

These tests exercise the major configuration features of TreeExe using the `tree-exe-runner` and `tree-exe-orchestrator` packages. Each feature is expressed as a YAML file under `tests/integration/configs` and verified with Vitest + Supertest.

## Feature Matrix

| Config | Highlights |
| --- | --- |
| `branching.yaml` | Core closures, conditional branching without explicit `type: branch`, `$call` to compute derived values. |
| `call-inline.yaml` | `$call` referencing another closure and inline step bundles inside parameters. |
| `functional.yaml` | Functional parameters via `core.for-each`, inline steps as lambdas. |
| `flow-closure.yaml` | `type: flow` closures reused across flows. |
| `module.yaml` | Module-sourced closures invoked via `$call`. |
| `orchestrator.yaml` | Multiple runner configs mounted through the orchestrator with distinct base paths. |
| `scheduler.yaml` | Bree-based scheduler executing flows on a fixed interval. |

## Running the Tests

```bash
npm install
npm run test:integration
```

The integration suite complements the engine unit tests (`npm run test`), providing end-to-end validation of configuration semantics.
