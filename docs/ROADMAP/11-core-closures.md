# More core closures (date/string/collection utils)

## Overview
Expand the core closure set with common utility operations (date/time, string, collection helpers) backed by strong metadata.

## Theory / Intent
Reduces user boilerplate and external plugin needs; improves validation/UX via richer signatures.

## Implementation Plan
- Identify high-value closures: date add/format/parse; string replace/split/slugify; collection map/filter/reduce; math helpers.
- Add signatures with parameter types, defaults, and examples to manifest.
- Provide pure implementations with no side effects.
- Update UI catalog to expose them in palette; add icons/colors per category.

## Code Touchpoints
- `rule-loom-core/src/closures.ts` (implementations + manifest generation).
- `rule-loom-core/ruleloom.manifest.yaml` (generated).
- UI palette uses catalog to show new items.

## Acceptance Criteria
- New closures appear in the palette with correct parameter forms.
- Execution matches documented behavior; unit tests cover edge cases (e.g., timezone handling, empty arrays).

## Code Cleanliness
- Keep each closure small/pure; group helpers in modules to avoid a monolithic file.
- Reuse shared utility libs where available to prevent duplication.
