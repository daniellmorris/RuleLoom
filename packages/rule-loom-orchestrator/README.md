# rule-loom-orchestrator

`rule-loom-orchestrator` composes multiple RuleLoom Runner configurations behind a single Express server. Each runner is mounted under a base path, shares logging, exposes a health endpoint, and can be managed dynamically via an OpenAPI-first API.

## Features

- Load multiple static runner configs via YAML.
- Dynamic runner management API (`/api`) for create/list/delete operations.
- Health probe at `/__ruleloom/health` plus per-runner health endpoints.
- Scheduler awareness (surface configured jobs and last run state).

## CLI Usage

```bash
npx ruleloom-orchestrator --config orchestrator.yaml --port 4100
```

Options:

- `--config, -c` – path to the orchestrator YAML (defaults to `orchestrator.yaml`).
- `--port, -p` – port to listen on (defaults to `$PORT` env var or `8080`).

## Configuration Structure

```yaml
version: 1
runners:
  - name: echo
    config: ../rule-loom-runner/config/example.http.yaml
    basePath: /echo
```

Each entry is loaded with `rule-loom-runner`, and the Express app is mounted at `basePath` (default `/`). `rule-loom-orchestrator` also registers a health probe at `/__ruleloom/health`.

## Management API

An OpenAPI 3.0 spec is served at `/api/docs` (Swagger UI). Core endpoints include:

- `GET /api/runners` – list current runner instances.
- `POST /api/runners` – create a runner from a YAML config path (optionally specify `id`/`basePath`).
- `GET /api/runners/{id}` – inspect routes, scheduler jobs, and metadata.
- `DELETE /api/runners/{id}` – stop and remove a runner.
- `GET /api/runners/{id}/routes`, `/jobs`, `/health` – inspect configuration and runtime state.

## Web UI

If the `rule-loom-orchestrator-ui` package has been built (`npm run build --workspace rule-loom-orchestrator-ui`), the orchestrator serves the static bundle at the root path. The UI consumes the `/api` endpoints to list runners, create/remove instances, and render route/scheduler graphs.

## Programmatic Usage

```ts
import { createOrchestrator } from 'rule-loom-orchestrator';

const { app, registry, listen, close } = await createOrchestrator('orchestrator.yaml');
await listen(4100);
console.log(registry.list().map((runner) => runner.id));
// ... later
await close();
```

## Development

- Depends on `rule-loom-runner` and `rule-loom-lib`; ensure both are built first (handled by workspace references).
- Build with `npm run build --workspace rule-loom-orchestrator`.
- Sample configuration lives at `config/example.orchestrator.yaml`.
