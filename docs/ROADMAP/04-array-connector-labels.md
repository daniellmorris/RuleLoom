# Array/dynamic connector labeling

## Overview
Improve labeling of dynamic connectors (arrays, branch cases, flowSteps) with array-level metadata so edges stay readable.

## Theory / Intent
Current labels like `case[0].then` or implicit indexes are hard to parse. Adding metadata enables stable, human-friendly labels.

## Implementation Plan
- Extend parameter metadata to allow `labelTemplate`/`itemLabelKey` on array/dynamic params.
- Store optional `$meta.connectorLabels` on steps/params to override auto-generated labels.
- Graph builder: use metadata to name connectors; include index when absent.
- UI: allow editing labels for dynamic connectors (e.g., branch case name).

## Code Touchpoints
- `catalogStore` manifest parsing to include new metadata.
- `graph.ts` connector generation logic.
- `Inspector` to edit labels for array/dynamic params.
- `appStore` to persist labels in `$meta`.

## Acceptance Criteria
- Branch/array connectors render with meaningful labels (e.g., `in-stock`, `backorder`).
- Labels persist through export/import.
- No duplicate connector IDs when labels are customized.

## Code Cleanliness
- Keep connector ID separate from display label to avoid breaking references.
- Derive labels from metadata first, fall back to index to prevent collisions.
