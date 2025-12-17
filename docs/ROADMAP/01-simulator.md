# Simulator (input-aware flow simulation)

This is a WIP: I don't think the following is complete or even really what we want for this feature. But it's a start.

## Overview
Add a simulator that executes flows without real side-effects by stubbing inputs/plugins, seeding state/facts, and returning a recorder trace.

## Theory / Intent
Simulating close to production logic finds config errors early and enables repeatable tests. Inputs often shape state; letting each input define `simulate()` keeps fidelity while staying safe.

## Implementation Plan
- Extend `ruleloom.manifest.yaml` schema with `simulationSchema` (zod/json-schema) per input/closure.
- Inputs: add optional `simulate(facts, options)` that mutates state like real `initialize/handle` would, but avoids network/IO.
- Engine: reuse existing recorder; add `simulate(flowName, facts, opts)` helper that sets runtime flags `simulate=true`, injects stub transports, and runs `execute`.
- Runner: add `POST /simulate` and CLI `--simulate` to accept facts and return `{ result, trace }`.
- UI: Simulator panel to paste/auto-generate facts from schema; display trace timeline and canvas heatmap.

## Code Touchpoints
- `packages/rule-loom-engine`: new `simulate` entry + recorder hooks already present.
- `packages/rule-loom-runner`: HTTP/CLI endpoints; pass `simulate` flag and recorder payload.
- `packages/rule-loom-core`: inputs declare `simulationSchema` and optional `simulate` method.
- `packages/ui-v2`: new Simulator panel; canvas overlay using trace.
- `docs`: describe schema additions and safe-side-effect policy.

## Acceptance Criteria
- `POST /simulate` returns trace events for a flow with at least one input providing `simulate`.
- UI can run a simulation, show per-node enter/exit, and mark nodes on the canvas.
- No real network/DB/file calls occur during simulation (verified by stubbing in tests).

## Code Cleanliness
- Centralize simulation flags in runtime to avoid “if simulate” scattering.
- Keep stubs in input plugins, not engine.
- Reuse recorder; no parallel tracing system.
