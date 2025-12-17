# YAML-defined inputs

This is a WIP: More thinking is needed on this

## Overview
Let users define new inputs in YAML by composing existing inputs/closures (adapters/wrappers) without code changes.

## Theory / Intent
Extensibility for teams that can’t ship code: e.g., wrap HTTP input to add auth/validation, or chain AMQP→flow without writing TS.

## Implementation Plan
- Extend manifest schema with `inputs.yamlDefined[]` that references base input type and transforms.
- Runner: at load time, materialize these into real input plugins (e.g., decorators on handler/payload mapping).
- Provide built-in transformers: header injection, payload mapping, schema validation, rate limiting.
- UI: form to create YAML-defined inputs; preview generated config.

## Code Touchpoints
- `rule-loom-core` input schema to include composition fields.
- `rule-loom-runner` input loader to build decorators around base inputs.
- UI input editor to author and manage composed inputs.

## Acceptance Criteria
- A YAML-defined input can be created that wraps HTTP and injects static headers plus schema validation, and it functions identically to a coded input.
- Errors surface during config validation, not at runtime.

## Code Cleanliness
- Keep composition pipeline declarative; avoid special-case branches per base input.
- Reuse existing validation/mapping utilities; no ad-hoc transform code paths.
