# UI plugin system (ui-v2)

## Overview
Introduce a lightweight plugin system for ui-v2 so teams can extend the editor without forking (e.g., custom panels, decorators, validators, import/export hooks).

## Theory / Intent
Different teams need bespoke UI affordances (domain-specific inspectors, analytics overlays, lint rules). A plugin API lets them add features safely while keeping the core slim.

## What plugins might do
- Add custom side panels or tabs (e.g., “Domain Inspector”, “Analytics”).
- Add canvas overlays/markers (e.g., SLA badges, risk flags).
- Register extra validators and surface errors/warnings.
- Provide import/export transformers (e.g., enforce naming conventions, redact fields).
- Add palette groups fed by external catalogs.

## Implementation Plan
- Define a plugin manifest for ui-v2 (static JSON/TS): `id`, `name`, `version`, `slots` implemented.
- Expose UI extension points (slots):
  - `panels`: right/left rail components
  - `canvasOverlays`: render-prop on top of Canvas
  - `paletteProviders`: add items/groups
  - `validators`: return issues keyed by `$meta.id`
  - `transformers`: `beforeImport`, `beforeExport`
- Plugin loading: allow local plugins (workspace path) and dynamic import; core app enumerates plugins and mounts slots.
- Live load: support a configurable plugin registry (directory/URL list). Provide a “Load plugin” action that fetches a manifest/bundle at runtime and registers slots without rebuilding. Cache by `id@version` and warn on conflicts.
- Provide a small, documented plugin API (selectors/actions, component hooks). Plugins run in the same JS context; no sandboxing—trust plugin code within the workspace.
- TypeScript: publish a small `@rule-loom/ui-plugin` types package for plugin authors.
- Configuration: `uiPlugins` array in a ui-v2 config file, or environment var pointing to plugin bundles.

## Code Touchpoints
- `packages/ui-v2/src`:
  - Add a plugin manager module to register/load plugins and expose slot APIs.
  - Canvas/panels/palette components to render slot content.
  - Validation pipeline to merge core + plugin validators.
- New types package: `packages/ui-plugin-types` (or publish from ui-v2) with slot interfaces and allowed actions/selectors.
- Build tooling: allow plugin bundles to be resolved in Vite config (alias or dynamic import); optional example plugin in `examples/ui-plugin`.

## Acceptance Criteria
- A sample plugin can add a right-rail panel and a canvas overlay without modifying core code.
- A plugin validator can raise an issue on a node, and it appears in the UI validation overlay.
- Export/import transformers from a plugin can modify YAML (e.g., enforce naming) and are applied in UI import/export flows.
- Disabling the plugin removes its UI with no errors; core UI still functions.

## Code Cleanliness
- Keep plugin API narrow and stable: expose selectors/actions and slot hooks, not raw internals.
- Enforce type-safe contracts; fail fast if a plugin requests unknown slots.
- Prefer explicit imports (workspace/local) even without sandboxing to keep provenance clear.
