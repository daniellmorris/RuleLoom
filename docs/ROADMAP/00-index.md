# Roadmap (feature-focused, no dates)

Each item lives in its own file with: Overview, Theory/Intent, Implementation Plan, Code Touchpoints, Acceptance Criteria, and Code Cleanliness notes.

## Current priorities

1. Replace the serialized registry-loading compatibility layer with fully runner-scoped plugin catalogs.
2. Add input-specific simulators and the editor simulator/trace experience.
3. Publish a stable UI plugin authoring API with enable/disable and trust controls.
4. Complete safe/declarative plugins and YAML-defined inputs.
5. Reduce the two editor implementations to one strategic UI and shared packages.

## Feature status

- **Implemented:** UI validation highlights, canvas notes, array connector labels, core utility closures, and closure namespacing.
- **Operational foundation:** side-effect-safe simulation, YAML testing, authenticated runner chaining, and multiple input instances.
- **Partial product surface:** simulator UI/input simulators and the UI plugin system.
- **Design stage:** safe plugins and YAML-defined inputs.

- 01-simulator.md
- 02-ui-validation-highlights.md
- 03-ui-notes.md
- 04-array-connector-labels.md
- 05-safe-plugins.md
- 06-yaml-defined-inputs.md
- 07-yaml-testing-framework.md
- 08-runner-chaining.md
- 09-codebase-review.md
- 10-multiple-input-instances.md
- 11-core-closures.md
- 12-namespacing.md
- 13-ui-plugin-system.md
