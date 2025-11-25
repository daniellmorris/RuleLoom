# Rule Loom Orchestrator UI v2

Fresh, isolated UI surface for building orchestrated flows. This package does not rely on the existing UI code. It includes:

- Canvas with distinct node types (Input, Plugin, Branch, Closure, $call) and colored connectors.
- Palette for adding nodes.
- Inspector for editing labels, input schemas, plugin IDs, branch conditions, closure details, and $call targets.
- Sample seeded flow to demonstrate previous/next connectors, closureParameter connector, and branching.
- Drag-to-reposition nodes and drop new nodes from the palette onto the canvas.
- Auto-layout button to tidy graph; imports auto-layout themselves.
- Import/Export runner YAML (version/inputs/closures/flows[].steps with cases/otherwise); preserves branch conditions, closure list, and $call targets.

## Scripts
- `npm run dev --workspace rule-loom-ui-v2` – start Vite dev server (port 4173).
- `npm run build --workspace rule-loom-ui-v2` – type-check then build.
- `npm run preview --workspace rule-loom-ui-v2` – preview production build.
- `npm run lint --workspace rule-loom-ui-v2`

## Next steps
- Wire to real plugin catalog and schema definitions.
- Add drag/drop and dynamic connector creation.
- Persist/import/export flow specs as JSON.
- Add simulation/run traces overlay.
