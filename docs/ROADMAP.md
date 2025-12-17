# Roadmap (feature-focused)

This roadmap captures major feature tracks without dates. Backward compatibility is **not** a constraint; we can reshape schemas and APIs as needed.

## Simulation & Testing
- **Simulator runtime**: Add per-input `simulate()` hooks so inputs can seed state/facts and mimic side effects safely. Extend `ruleloom.manifest.yaml` with `simulationSchema` to describe required/optional simulated parameters.
- **Recorder-first trace**: Reuse the engine recorder for live runs and simulations; surface traces (params, outputs, state diffs, timings) in the UI timeline/heatmap.
- **YAML test harness**: Define a test file format (or inline `$tests`) that describes fixtures, mocks (per-closure outputs/state mutations), expected responses by `$meta.id`, and final state/output assertions. Tests should run via CLI and in CI using the simulator.

## UI & Authoring
- **Validation highlights**: Canvas highlights nodes with missing required params or dangling connectors in red (live validation powered by catalog metadata).
- **Sticky notes**: Add freeform notes anchored at x/y positions on the canvas (persisted in `$meta`).
- **Connector labeling for arrays**: Improve dynamic connector labels (e.g., branch/array params) with array-level `$meta` hints to render indices/keys clearly.
- **Multiple input instances**: Allow configuring multiple inputs of the same type (e.g., two HTTP or AMQP inputs) from the UI, each with its own config/trigger set.

## Inputs & Plugins
- **Safe plugins**: YAML-only, side-effect-limited plugins marked as `safe`; enforce sandboxed execution and manifest-level allowlists.
- **YAML-defined inputs**: Compose new inputs from existing ones via YAML configuration (wrappers/adapters) so users can extend input behavior without code.
- **WebSocket input**: Add a real-time input plugin for bidirectional message handling.

## Engine & Composition
- **Flow/closure namespacing**: Introduce namespaces/modules (beyond the `core.` convention) for closure discovery, import/export, and collision avoidance.
- **Runner chaining**: Allow one runner to invoke another (remote/local) as a first-class closure/input for federated orchestration.
- **More core closures**: Expand built-ins for date/time manipulation, string utilities, collections, etc., with strong typing and catalog metadata.

## Documentation & Tooling
- **Manifest evolution**: Migrate UI metadata to `$meta` (done) and document new simulation/testing fields.
- **CLI flags**: Add runner flags for recording/simulation/test execution and expose traces over HTTP for UI consumption.
