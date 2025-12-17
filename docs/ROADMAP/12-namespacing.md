# Closure namespacing / modules

## Overview
Introduce namespaces/modules for closures beyond the informal `core.` prefix to organize discovery, versioning, and collision avoidance.

## Theory / Intent
As plugins and teams grow, flat names collide. Namespaces enable clarity (`core.http`, `teamA.payments`), controlled exports, and future version pinning.

## Implementation Plan
- Extend manifest schema with `namespace` + optional `version` for closures; derive fully qualified names.
- Engine: treat FQNs as canonical; allow aliases for backward compatibility during migration.
- Runner/UI: display namespace badges; palette grouped by namespace; search by short or FQN.
- Import/export: include namespace in YAML flows; provide linter to flag ambiguous names.

## Code Touchpoints
- `rule-loom-core` manifest and closure registration.
- `rule-loom-engine` lookup by FQN and alias map.
- UI catalog/palette search and grouping.
- Validation tooling (lint) to enforce namespace presence.

## Acceptance Criteria
- Closures can be registered and invoked with namespaces; lookups are unambiguous.
- Palette groups closures by namespace; search works with short or FQN.
- Existing configs migrated to FQN with a clear strategy (even without backward compat, provide a script/linter to update names).

## Code Cleanliness
- Central alias map for migration; avoid hardcoded fallbacks.
- Keep namespace handling in registry layer, not sprinkled through UI components.
