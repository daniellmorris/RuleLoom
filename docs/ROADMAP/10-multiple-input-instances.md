# Multiple input instances of same type

## Overview
Support multiple configured instances of a given input type (e.g., two HTTP inputs, multiple AMQP brokers) with distinct configs and triggers.

## Theory / Intent
Real deployments often need separate endpoints/brokers; forcing one instance is limiting. Instances should be first-class and distinguishable.

## Implementation Plan
- Config schema: allow array of inputs of same `type`; ensure `id` is required to disambiguate.
- Runner: initialize each instance separately and register with unique identifiers; include `inputId` in runtime.
- UI: input editor lists instances; allow adding/removing/editing per instance; triggers bound to specific instance.
- Export/import: persist instance IDs and configs.

## Code Touchpoints
- `rule-loom-core` input schema to require `id` when multiple are present.
- `rule-loom-runner` initialization and routing logic to include `inputId` in state/runtime.
- UI inputs panel to manage multiple instances and show `inputId` on triggers.

## Acceptance Criteria
- Two HTTP inputs with different basePaths can coexist; both routes resolve correctly.
- Triggers include `inputId` in state so downstream closures can branch if needed.
- Export/import preserves multiple instances without collision.

## Code Cleanliness
- Avoid special cases per input; treat instances uniformly with IDs.
- Keep routing tables keyed by `inputId` + trigger, not by type.
