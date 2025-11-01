# tree-exe-orchestrator

`tree-exe-orchestrator` composes multiple TreeExe Runner configurations behind a single Express server. Each runner is mounted under a base path, shares logging, and exposes a health endpoint.

## CLI Usage

```bash
npx treeexe-orchestrator --config orchestrator.yaml --port 4100
```

Options:

- `--config, -c` – path to the orchestrator YAML (defaults to `orchestrator.yaml`).
- `--port, -p` – override the configured port.

## Configuration Structure

```yaml
version: 1
server:
  port: 4000
runners:
  - name: echo
    config: ../tree-exe-runner/config/example.http.yaml
    basePath: /echo
```

Each entry is loaded with `tree-exe-runner`, and the Express app is mounted at `basePath` (default `/`). `tree-exe-orchestrator` also registers a health probe at `/__treeexe/health`.

## Programmatic Usage

```ts
import { createOrchestrator } from 'tree-exe-orchestrator';

const { app, runners, listen, close } = await createOrchestrator('orchestrator.yaml');
await listen(4100);
// ... later
await close();
```

## Development

- Depends on `tree-exe-runner` and `tree-exe-lib`; ensure both are built first (handled by workspace references).
- Build with `npm run build --workspace tree-exe-orchestrator`.
- Sample configuration lives at `config/example.orchestrator.yaml`.
