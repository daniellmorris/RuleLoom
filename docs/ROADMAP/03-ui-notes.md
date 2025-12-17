# Canvas sticky notes

## Overview
Allow authors to drop notes at x/y positions on the canvas; store content and position in `$meta`.

## Theory / Intent
Notes capture intent, TODOs, or warnings near relevant logic without external docs.

## Implementation Plan
- Extend flow `$meta.notes?: { id, x, y, text }[]`.
- `appStore`: CRUD for notes, id generation, persistence to YAML export/import.
- Canvas: layer to render draggable note cards; click to edit text; delete button.
- Optional filter to hide/show notes.

## Code Touchpoints
- `appStore` (meta schema, mutations, export/import).
- `Canvas` component (render/edit/drag notes).
- `yaml` utils to serialize notes under `$meta.notes`.

## Acceptance Criteria
- User can add, move, edit, delete notes; positions persist across reload/export/import.
- Notes do not affect flow execution/validation.

## Code Cleanliness
- Treat notes as separate collection (not Steps) to keep traversal/index logic unchanged.
- Encapsulate note rendering in a small component to avoid bloating Canvas.
