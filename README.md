# RuleLoom Monorepo

RuleLoom is a configuration-first execution platform for composing rules, closures, and service flows in TypeScript and YAML. This monorepo contains the core engine, reusable closure bundles, and tooling that turns YAML configs into running HTTP services or orchestrated multi-flow applications.

## Highlights

- **Closure-driven rules engine** – `rule-loom-engine` executes named closures in sequence, supports branch inference, condition chaining, and inline flow invocations.
- **Config-first authoring** – write YAML to define inputs, flows, inline steps, and `$call` expressions without touching TypeScript.
- **Core closure library** – `rule-loom-core` ships practical building blocks (`core.assign`, `core.respond`, `core.for-each`, comparisons, includes, length, …).
- **CLI runner + orchestrator** – run a single configuration via `ruleloom-runner`, or mount multiple configs behind one Express server with `ruleloom-orchestrator`.
- **Inline lambdas and closure references** – nest step arrays directly in parameters and call closures (or step bundles) inline with `$call`.
- **Scheduled flows** – run jobs on cron/intervals using Bree-backed scheduler.
- **OpenAPI orchestrator API** – create/destroy runners, inspect routes, and view scheduler state via REST.
- **SQLite-backed persistence** – orchestrator runner configs live in a Prisma-managed SQLite database so additions through the API survive restarts.

## Repository Layout

| Package | Description |
| --- | --- |
| [`rule-loom-lib`](packages/rule-loom-lib/README.md) | Shared utilities (loggers, future helpers) consumed by other packages. |
| [`rule-loom-engine`](packages/rule-loom-engine/README.md) | Core execution engine that processes flows, closures, branching, and `$call` directives. |
| [`rule-loom-core`](packages/rule-loom-core/README.md) | Reusable closure bundle (assign/respond/log/comparisons/iterators, etc.). |
| [`rule-loom-inputs`](packages/rule-loom-inputs/README.md) | Transport adapters (HTTP server, scheduler, future AMQP/MQTT) used by the runner/orchestrator. |
| [`rule-loom-runner`](packages/rule-loom-runner/README.md) | CLI + library for serving a single YAML config over HTTP. |
| [`rule-loom-orchestrator`](packages/rule-loom-orchestrator/README.md) | Aggregates multiple runner configs behind one Express app. |

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md) – high-level overview, data flow, and package interactions.
- [Configuration How-To](docs/CONFIGURATION.md) – detailed YAML schema, closure types, branching rules, `$call`, and inline lambdas.

## Getting Started

```bash
npm install
npx prisma migrate deploy --schema prisma/schema.prisma
npm run build --workspace rule-loom-orchestrator-ui
npm run build
```

Run the sample HTTP runner:

```bash
npm run dev              # ts-node entry for rule-loom-runner
# in another terminal
curl -X POST http://localhost:3000/echo -d '{"userId":"abc","items":["A","B"]}' -H 'Content-Type: application/json'
```

Run the orchestrator with the bundled example:

```bash
npx ruleloom-orchestrator --config packages/rule-loom-orchestrator/config/example.orchestrator.yaml --port 4100
```

## Database & Persistence

- Runner definitions managed through the orchestrator API are stored in SQLite. By default, the database file lives at `.ruleloom/orchestrator.db`; override the location with `RULE_LOOM_DATABASE_URL` (e.g., `RULE_LOOM_DATABASE_URL="file:/var/data/ruleloom.db"`).
- Apply schema changes using Prisma migrations:

```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

- Local development and tests automatically create the database directory if it does not exist. For production/container environments, ensure the target path is writable so orchestrator state survives restarts.

## Testing

```bash
npm run test
npm run test:integration
```

## Docker Compose (orchestrator + UI)

To build and run the orchestrator (serving the production UI and REST API) inside Docker:

```bash
./dev.sh
```

This uses `docker-compose.yml` together with `docker/orchestrator.yaml` (which you can edit to point at your own runner configs). Once started, visit <http://localhost:4100> for the UI and <http://localhost:4100/api/docs> for the API explorer.

## Development Notes

- TypeScript project references (see `tsconfig.base.json`) ensure packages build in dependency order (`lib` → `engine` → `core` → `runner` → `orchestrator`).
- Build outputs live under each package’s `dist/` directory.
- When adding new closure metadata (e.g., functional parameters), update `rule-loom-engine`’s `ClosureDefinition` and the runner schema to keep YAML parsing aligned.

Happy harvesting! 🚜
