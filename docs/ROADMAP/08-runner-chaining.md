# Runner chaining

## Overview
Allow a flow to invoke another RuleLoom runner (local or remote) as a first-class closure/input.

## Theory / Intent
Supports federated orchestration and reuse of flows across environments/teams without duplicating configs.

## Implementation Plan
- Add `core.runner-call` closure with parameters: `url|host`, `flow`, `payload`, `auth`, `timeout`, `simulate?`.
- Optional runner input type for push-style (webhook/queue) bridging.
- Reuse recorder: include downstream trace IDs if available.
- UI: palette item for “Runner Call” with param editor; display chained trace when returned.

## Code Touchpoints
- `rule-loom-core` new closure implementation.
- `rule-loom-engine` unchanged (closure does work); recorder could tag nested calls.
- `rule-loom-runner` outbound client helper; config for auth/secrets.
- UI palette + inspector metadata.

## Acceptance Criteria
- A flow can call a secondary runner flow and merge its result/state; errors bubble with clear message.
- Timeout/retry supported; chained run is visible in trace (at least as a single node with duration).

## Code Cleanliness
- Keep the closure thin: delegate HTTP client to shared utility; avoid embedding networking in UI.
