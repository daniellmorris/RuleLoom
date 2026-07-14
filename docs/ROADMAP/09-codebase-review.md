# Codebase review and stabilization

**Status: Review complete; stabilization pass implemented.** This review reflects the repository after the runner workflow/UI tooling and stabilization work landed in July 2026. Items explicitly called out as follow-up remain roadmap work.

## Executive summary

RuleLoom has a capable engine, config-driven runner, plugin ecosystem, two UI generations, an orchestrator, and meaningful integration coverage. Recent work filled many roadmap gaps, but it also expanded the trusted runtime surface faster than the repository's isolation, security, test, and release disciplines. Stabilization should precede more plugin or editor features.

## P0: security and isolation

### Remove tracked environment files

- `.env` is tracked. Remove it from Git, ignore `.env` variants, and provide a redacted `.env.example`.
- Treat any value that has ever been committed as exposed and rotate it outside the repository if it was a real credential.

### Isolate runner plugin state

- Closure, input-plugin, loaded-plugin, and inventory registries are process globals.
- Creating multiple runners can leak registrations between runners, skip needed registration, or create duplicate-registration failures depending on load order.
- Replace globals with a runner-scoped plugin catalog/loader session. Tests must create two runners with disjoint plugin sets and prove isolation.

### Protect runner execution and orchestration APIs

- Every HTTP input currently mounts `POST /__ruleloom/run`; no authentication or explicit enablement is required.
- Orchestrator CRUD/config/metrics endpoints also have no authentication boundary.
- Make runner execution opt-in, support constant-time bearer-token verification, cap body/trace sizes, and avoid returning internal errors.
- Define an authentication middleware contract for orchestrator deployments and document trusted-network-only operation until it exists.

### Constrain outbound and remote code execution

- `core.runner-call` accepts arbitrary URLs, which is an SSRF capability by design. Add protocol validation, optional host allowlists, redirect policy, loop-depth limits, and correlation IDs.
- GitHub plugins can run configured shell commands and `npm install` with inherited environment variables. Require explicit trust, prefer pinned commits plus integrity, use an atomic cache update, and document that plugins are arbitrary code.
- UI plugins dynamically import remote JavaScript into the editor origin. Label them trusted-only, require HTTPS by default, validate duplicate IDs/versions, and add enable/disable controls.

## P1: correctness and reliability

### Make input initialization transactional

- If a later input fails during initialization, earlier input cleanup functions are not run.
- Wrap initialization in failure cleanup and preserve the original error.

### Make runner updates transactional

- The orchestrator closes and deletes the old runner before validating/starting its replacement.
- Start the replacement first, then swap records and persistence; retain the old runner if replacement startup fails.

### Fix HTTP server lifecycle and error handling

- Shared HTTP apps mount routes but do not install the JSON not-found/error middleware used by the standalone app path.
- Shared servers are process-local and cannot prevent test workers or other processes from racing for fixed ports.
- Use ephemeral ports in tests or serialize port-owning integration files. Ensure errors are consistently JSON and do not expose stacks.

### Define simulation semantics

- `runtime.simulate` currently does not stop side-effect closures.
- Add closure capability metadata (`pure`, `network`, `database`, `filesystem`, `message`, `process`) and a centralized execution policy.
- In simulation, pure closures run, declared simulators run for side-effect closures, and unmocked side effects fail closed.

### Improve config and parser safety

- YAML and JSON inputs need explicit size/depth/alias limits at external boundaries.
- State patch paths and template resolution should reject prototype-pollution keys.
- Replace `$executeRawUnsafe` schema bootstrapping with migrations or safe deployment initialization.

## P1: build, tests, and dependencies

- Add CI for install, build, all unit/plugin/UI tests, integration tests, generated-manifest consistency, and `git diff --check`.
- Commit `package-lock.json` and use `npm ci`; ignoring the lockfile makes builds non-reproducible.
- Root `npm test` currently runs only one engine file. Add aggregate `test:unit`, `test:plugins`, `test:ui`, `test:integration`, and `test:all` scripts.
- The MQTT plugin unit test is stale and fails because its context omits `registerInputPlugin`.
- Integration tests can contend for port 3000 under Vitest file parallelism.
- Production dependency audit reports critical/high vulnerabilities in transitive XML, HTTP, WebSocket, YAML, lodash, form-data, and related packages. Update the lock graph without forcing incompatible major downgrades, then keep audit visible in CI.
- There is no repository-wide lint configuration despite a UI lint script. Add consistent ESLint/format checks incrementally; do not block stabilization on eliminating every existing `any` at once.

## P2: architecture and product completion

### Consolidate orchestrator v2

- `packages/orchestrator-v2` is only a second OpenAPI document while `rule-loom-orchestrator` already implements the service.
- Merge useful v2 API concepts into the existing package or create a real package; do not maintain two drifting specifications.
- Add health/meta endpoints, conformance tests, authentication, transactional updates, and documented persistence/restart behavior.

### Finish YAML testing

- Add package documentation, conditional mock matching, useful structural diffs, explicit exact/partial matching modes, and safe simulator integration.
- Avoid mutating shared closure definitions when tests can run concurrently.

### Finish UI plugins

- Publish a narrow typed plugin API, validate manifests with a schema, detect conflicts, apply import/export transformers, and expose plugin status controls.
- Keep safe/declarative plugins separate from trusted executable plugins.

### Reduce UI duplication

- Decide whether `rule-loom-orchestrator-ui` or `ui-v2` is the strategic editor.
- Share catalog/flow types and avoid implementing simulation, validation, and builder behavior twice.

## Documentation findings

- Root documentation references removed packages (`packages/rule-loom-inputs` and `packages/rule-loom-core`).
- New namespacing, runner chaining, AI, testing, multiple-input, and plugin behavior is under-documented.
- `rule-loom-testing`, orchestrator UI, and many plugins have no README.
- Roadmap files described implemented features as future work; status annotations now correct that.

## Completion sequence

1. Repository hygiene: environment file, lockfile, generated outputs.
2. Test aggregation, MQTT fixture repair, port reliability, CI.
3. Runner-scoped plugin catalogs and transactional cleanup/update behavior.
4. Authenticated opt-in runner endpoint and chaining protections.
5. Capability-based safe simulation and testing integration.
6. Dependency upgrades and ongoing audit policy.
7. Documentation consolidation and package READMEs.
8. Orchestrator/API and UI-plugin completion.

## Stabilization completed in this pass

- Removed the tracked `.env`, added a safe example, and excluded environment files from Git and Docker build contexts.
- Committed the npm lockfile, added aggregate tests and CI, fixed stale plugin tests, and serialized fixed-port integration files.
- Added isolated/serialized plugin-loading sessions, per-runner plugin inventory, transactional input cleanup, and transactional orchestrator runner replacement.
- Made the runner execution endpoint opt-in and authenticated, with request/depth/trace limits and hardened outbound chaining policy.
- Added capability-based fail-closed simulation and integrated it into YAML tests.
- Added orchestrator auth, health/meta endpoints, JSON async error handling, API tests, and consolidated the duplicate v2 OpenAPI document.
- Hardened GitHub plugin installation/build trust and remote UI plugin loading/conflict detection.
- Added config size/depth/key validation, safe state paths and merges, and replaced unsafe raw SQL execution helpers.
- Corrected primary documentation and recorded the remaining product/architecture work below.

## Remaining follow-up

- Replace the serialized compatibility layer around legacy global plugin registries with catalog instances passed explicitly through every plugin API.
- Upgrade remaining vulnerable dependencies where the fixes require compatible major-version work; keep audit output visible in CI.
- Add a repository-wide lint/format baseline and generated-manifest drift check that is practical for contributors.
- Finish input simulators, simulator UI, safe plugins, YAML-defined inputs, UI plugin controls/types, and editor consolidation.
- Move schema bootstrapping entirely to Prisma migrations; the runtime bootstrap now uses safe static queries but remains a compatibility path.

## Definition of stabilized

- A clean clone installs reproducibly with `npm ci`.
- One command runs all unit, plugin, UI, and integration tests reliably.
- CI builds and tests from scratch and checks manifests/source cleanliness.
- Two runners can load different plugins without shared registry state.
- Failed input initialization and failed runner replacement leave no leaked services or downtime.
- Remote execution is disabled by default or authenticated when enabled.
- Simulation cannot perform undeclared external side effects.
- No tracked environment/secrets files remain.
- Roadmap and primary docs describe the shipped behavior accurately.
