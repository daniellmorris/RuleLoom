# RuleLoom plugins

Plugins register closures and/or input adapters through the runner's registration context. Each plugin must ship a generated `ruleloom.manifest.yaml` beside its compiled entry point.

| Plugin | Provides |
| --- | --- |
| `rule-loom-core` | Pure state, response, branch, date, string, collection, math, and runner-call closures |
| `rule-loom-plugin-http` | HTTP routes and `http.request` |
| `rule-loom-plugin-scheduler` | Bree interval/cron inputs |
| `rule-loom-plugin-websocket` | WebSocket input |
| `rule-loom-plugin-mqtt` | MQTT input and publish closure |
| `rule-loom-plugin-ai` | Provider-neutral generate/extract/classify/embed closures |
| `rule-loom-plugin-google` | Sheets, Drive, and Gmail closures |
| `rule-loom-plugin-mysql` / `postgres` | Database query closures |
| `rule-loom-plugin-s3` | S3 object and presigned URL closures |
| `rule-loom-plugin-notion` / `slack` | Service-specific closures |
| `rule-loom-plugin-openai` | Legacy OpenAI-specific closure; prefer `rule-loom-plugin-ai` for new configs |

## Authoring contract

- Export an object with a `register(context)` function.
- Register closures with typed signatures and explicit `capabilities` (`pure`, `network`, `database`, `filesystem`, `message`, or `process`). Unknown capabilities fail closed in simulation.
- Register inputs with a Zod schema, metadata for UI forms, and idempotent cleanup.
- Do not start network listeners or clients during module import; initialize them through the input lifecycle.
- Run `npm run manifest` after changing registrations and commit the generated manifest.
- Validate untrusted payloads at input boundaries and accept secrets through resolved parameters/config, never source files.

Backend plugins execute in the runner process with its filesystem, network, and environment access. GitHub plugin build commands also execute locally. Treat every executable plugin as trusted code and prefer pinned commits plus integrity hashes.
