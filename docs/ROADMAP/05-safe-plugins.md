# Safe plugins (YAML-only, sandboxed)

This is a WIP: I don't think the following is complete or even really what we want for this feature. But it's a start.

## Overview
Introduce a “safe” plugin class that is declarative (YAML) and restricted to vetted closures/inputs with no arbitrary code.

## Theory / Intent
Allows third-party or user-provided extensions without risking code execution. Useful for regulated environments and sharing configs.

## Implementation Plan
- Manifest flag `safe: true` plus allowlist of permitted closures/inputs and capabilities (no network/FS unless declared).
- Runner loader: reject non-safe features when `safeOnly` mode is on; enforce schema validation and block dynamic imports.
- Provide a library of safe building blocks (pure transforms, mappings, filters).
- UI: badge safe plugins; allow enabling “safe-only” mode when assembling configs.

## Code Touchpoints
- `rule-loom-runner` plugin loader and validator.
- `rule-loom-core` manifest schema updates.
- `rule-loom-lib` logging to surface safety violations.
- UI indicator in plugin library panel.

## Acceptance Criteria
- Runner launched with `safeOnly` rejects any non-safe plugin; logs reason.
- Safe plugin manifest cannot declare custom JS; only references existing safe closures/inputs.
- UI surfaces safety status; export/import preserves `safe` flag.

## Code Cleanliness
- Keep safe-mode checks centralized in plugin loader/validator.
- Avoid scattered feature flags—one `safeOnly` gate with clear error messages.
