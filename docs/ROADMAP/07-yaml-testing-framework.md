# YAML testing framework

## Overview
Provide a test DSL in YAML (inline or separate files) to assert flow behavior using simulated inputs, mocks, and expected outputs/state.

## Theory / Intent
Config-first teams need regression tests without writing JS. Leveraging simulator + recorder enables deterministic assertions by `$meta.id` and final output.

## Implementation Plan
- Split into a new package `rule-loom-testing` that depends on engine/runner but is not required for prod use. It provides CLI/JS API for running YAML tests.
- Define test schema: `tests: [{ name, flow, state, mocks, expect: { nodes: [{ id, output?, state? }], response?, state? }, seed?, callIndex?, when? }]`.
  - `state`: initial execution state seed (e.g., what inputs would have placed into `state.request`).
  - `mocks`: declarative closure mocks (match by `name` and optional `$meta.id`/`callIndex`, behaviors: static return, sequence, error, passthrough) plus optional state patches (`set`, `patchAfter`).
- Testing CLI: `rule-loom-testing test config.yaml` loads the config, runs via simulator, applies mocks, and emits results.
- Reporter: TAP/JSON for CI; summary with pass/fail and diffs.
- UI-v2: optional test drawer that calls the testing package service/API when present; not a hard dependency of orchestrator.

## Code Touchpoints
- `rule-loom-testing` (new package): owns CLI, schema validation, mock injection, and execution orchestration atop simulator.
- Simulator (see 01) for execution.
- Optional integration point in UI-v2 to trigger tests if the package is installed.

## Acceptance Criteria
- A test file can mock a closure output, feed facts, and assert node outputs/state and final HTTP response; CLI exits non-zero on failure.
- Recorder trace is available for failed tests to aid debugging.

## Code Cleanliness
- Keep mocks declarative (no embedded JS); store in test YAML.
- Reuse recorder events to avoid custom trace formats.
