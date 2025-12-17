# YAML testing framework

## Overview
Provide a test DSL in YAML (inline or separate files) to assert flow behavior using simulated inputs, mocks, and expected outputs/state.

## Theory / Intent
Config-first teams need regression tests without writing JS. Leveraging simulator + recorder enables deterministic assertions by `$meta.id` and final output.

## Implementation Plan
- Define test schema: `tests: [{ name, flow, facts, mocks, expect: { nodes: [{ id, output?, state? }], response?, state? }, seed? }]`.
- Runner CLI: `rule-loom test config.yaml` runs tests via simulator, applies mocks per closure (by name or `$meta.id`).
- Reporter: TAP/JSON for CI; summary with pass/fail and diffs.
- UI: test drawer to run selected tests and show trace highlights.

## Code Touchpoints
- Simulator (see 01) for execution.
- `rule-loom-runner` CLI command for tests.
- Test schema validation (zod) in `tests/helpers` or runner.
- UI integration for running and visualizing results.

## Acceptance Criteria
- A test file can mock a closure output, feed facts, and assert node outputs/state and final HTTP response; CLI exits non-zero on failure.
- Recorder trace is available for failed tests to aid debugging.

## Code Cleanliness
- Keep mocks declarative (no embedded JS); store in test YAML.
- Reuse recorder events to avoid custom trace formats.
