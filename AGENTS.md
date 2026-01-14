# Repository Guidelines

## Project Structure & Modules
- Monorepo managed with npm workspaces; core packages live under `packages/` (`rule-loom-engine`, `rule-loom-core`, `rule-loom-lib`, `rule-loom-runner`, `rule-loom-orchestrator`, `rule-loom-orchestrator-ui`, `ui-v2`), and plugins under `plugins/` (Slack, S3, Postgres, etc.).
- Shared docs and diagrams are in `docs/`; runnable examples sit in `examples/`.
- Documentation lives primarily in `docs/` (e.g., `ARCHITECTURE.md`, `CONFIGURATION.md`, `SCREENSHOTS.md`, and `ROADMAP/`); package-specific guides live in each package's `README.md`.
- Prisma schema/database config is at `prisma/schema.prisma`; generated artifacts go to each package’s `dist/`.
- Top-level tests live in `tests/` with helpers under `tests/helpers` and integration suites in `tests/integration`.

## Build, Test, and Run
- `npm install` – install workspace dependencies.
- `npm run build` – build all workspaces in dependency order (emits `dist/` per package).
- `npm run dev` – start `rule-loom-runner` in watch/ts-node mode for local YAML configs.
- `npm run start` – launch the compiled runner.
- `npm run test` – execute the TypeScript unit suite (`tests/engine.spec.ts`) via `ts-node`.
- `npm run test:integration` – run Vitest integration suites using `vitest.config.ts`.
- `npx prisma migrate deploy --schema prisma/schema.prisma` – apply DB schema changes (required before orchestrator runs).
- Dockerized orchestrator+UI: `./dev.sh` (uses `docker-compose.yml` and `docker/orchestrator.yaml`).

## Coding Style & Naming
- TypeScript, ES modules, `strict` mode enforced via `tsconfig.base.json`; keep outputs typed.
- Prefer 2-space indentation, single quotes, and explicit return types for exported functions.
- Export small utilities from package `src/` index files; keep cross-package imports using workspace path aliases defined in `tsconfig.base.json`.
- Keep closures, flows, and schema types documented inline when adding metadata or new parameters.

## Testing Guidelines
- Co-locate fast specs near entry points or add to `tests/`; use `*.spec.ts` naming.
- Favor Vitest for new suites; mock external services and cover happy + error branches for closures and orchestrator routes.
- Integration tests should spin minimal configs and assert HTTP behavior; keep fixtures in `tests/setup` or `tests/helpers`.
- Aim to cover new public APIs and any change in flow parsing/validation logic.

## Commit & Pull Requests
- Use concise, imperative commit subjects (e.g., “Add closures tab”, “Fix Slack plugin auth”) and keep body wrapped at ~72 chars when needed.
- For PRs: include a short summary, linked issue/ticket, testing notes (`npm run test`, `npm run test:integration`), and screenshots for UI changes (`rule-loom-orchestrator-ui` / `ui-v2`).
- Highlight schema or migration changes and any new environment variables (e.g., `RULE_LOOM_DATABASE_URL`) in the description.

## Security & Configuration Tips
- Do not commit secrets; prefer environment variables and `.env` files excluded from VCS.
- When adding new plugins or inputs, validate untrusted payloads at the boundary and keep defaults non-destructive (read-only where possible).
- Ensure new Prisma migrations are idempotent for Docker and CI environments; document required ports or external services in the PR.
