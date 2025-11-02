# TreeExe Monorepo

TreeExe is a configuration-first execution platform for composing rules, closures, and service flows in TypeScript and YAML. This monorepo contains the core engine, reusable closure bundles, and tooling that turns YAML configs into running HTTP services or orchestrated multi-flow applications.

## Highlights

- **Closure-driven rules engine** – `tree-exe-engine` executes named closures in sequence, supports branch inference, condition chaining, and inline flow invocations.
- **Config-first authoring** – write YAML to define inputs, flows, inline steps, and `$call` expressions without touching TypeScript.
- **Core closure library** – `tree-exe-core` ships practical building blocks (`core.assign`, `core.respond`, `core.for-each`, comparisons, includes, length, …).
- **CLI runner + orchestrator** – run a single configuration via `treeexe-runner`, or mount multiple configs behind one Express server with `treeexe-orchestrator`.
- **Inline lambdas and closure references** – nest step arrays directly in parameters and call closures (or step bundles) inline with `$call`.
- **Scheduled flows** – run jobs on cron/intervals using Bree-backed scheduler.
- **OpenAPI orchestrator API** – create/destroy runners, inspect routes, and view scheduler state via REST.

## Repository Layout

| Package | Description |
| --- | --- |
| [`tree-exe-lib`](packages/tree-exe-lib/README.md) | Shared utilities (loggers, future helpers) consumed by other packages. |
| [`tree-exe-engine`](packages/tree-exe-engine/README.md) | Core execution engine that processes flows, closures, branching, and `$call` directives. |
| [`tree-exe-core`](packages/tree-exe-core/README.md) | Reusable closure bundle (assign/respond/log/comparisons/iterators, etc.). |
| [`tree-exe-runner`](packages/tree-exe-runner/README.md) | CLI + library for serving a single YAML config over HTTP. |
| [`tree-exe-orchestrator`](packages/tree-exe-orchestrator/README.md) | Aggregates multiple runner configs behind one Express app. |

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md) – high-level overview, data flow, and package interactions.
- [Configuration How-To](docs/CONFIGURATION.md) – detailed YAML schema, closure types, branching rules, `$call`, and inline lambdas.

## Getting Started

```bash
npm install
npm run build
```

Run the sample HTTP runner:

```bash
npm run dev              # ts-node entry for tree-exe-runner
# in another terminal
curl -X POST http://localhost:3030/echo -d '{"userId":"abc","items":["A","B"]}' -H 'Content-Type: application/json'
```

Run the orchestrator with the bundled example:

```bash
npx treeexe-orchestrator --config packages/tree-exe-orchestrator/config/example.orchestrator.yaml --port 4100
```

## Testing

The `tests/` directory contains engine-focused unit tests (branch inference, inline lambdas, `$call`). Run them with:

```bash
npm run test
```

## Development Notes

- TypeScript project references (see `tsconfig.base.json`) ensure packages build in dependency order (`lib` → `engine` → `core` → `runner` → `orchestrator`).
- Build outputs live under each package’s `dist/` directory.
- When adding new closure metadata (e.g., functional parameters), update `tree-exe-engine`’s `ClosureDefinition` and the runner schema to keep YAML parsing aligned.

Happy harvesting! 🚜
