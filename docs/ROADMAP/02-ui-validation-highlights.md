# UI validation highlights

## Overview
Highlight nodes with missing required params or missing connectors directly on the canvas (e.g., red border/label).

## Theory / Intent
Inline validation reduces trial-and-error and prevents exporting invalid YAML. Catalog metadata already lists required params.

## Implementation Plan
- Validation pass in `appStore` after mutations: use catalog signatures to flag missing required params and missing flowSteps connections.
- Store validation state per node id; expose via `flowStore`.
- Canvas: render red border/glow + tooltip with missing fields/connectors.
- Optional toggle to show/hide validation overlays.

## Code Touchpoints
- `packages/ui-v2/src/state/appStore.ts`: compute and store validation errors per node.
- `packages/ui-v2/src/components/Canvas.tsx`: render error state.
- `packages/ui-v2/src/components/Inspector.tsx`: show field-level hints.
- `packages/ui-v2/src/state/catalogStore.ts`: ensure required info is available.

## Acceptance Criteria
- Node missing a required param is visibly marked; tooltip lists missing keys.
- Node missing required flowSteps connector is marked similarly.
- Export is blocked or warns when validation errors exist.

## Code Cleanliness
- Keep validation pure/deterministic; avoid ad-hoc checks in components.
- Centralize rule definitions; components consume read-only state.
