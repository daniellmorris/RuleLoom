# Plugin repositories + runtime plugin UI integration

## Overview
Combine two needs: (a) browsing/loading plugins from repository manifests (manifest-of-manifests) and (b) surfacing runtime-loaded plugins in ui-v2 so the catalog matches the runner. Goal: discover, load, and refresh plugins purely from the UI.

## Theory / Intent
- Repository manifests (static YAML/JSON) make plugins discoverable without backend changes.
- Runtime plugin inventory keeps the UI in sync with what the runner actually loaded.
- Users can add plugins from repos, refresh, and see them immediately in palette/inspector.

## Repository manifest shape (draft)
```yaml
version: 1
repo:
  name: "Acme Plugins"
  description: "Internal plugin catalog"
plugins:
  - id: slack
    name: "Slack Plugin"
    description: "Send and receive Slack messages"
    manifest: https://raw.githubusercontent.com/acme/rule-loom-plugin-slack/main/ruleloom.manifest.yaml
  - id: payments
    name: "Payments"
    description: "Core payments closures"
    manifest: ruleloom.manifest.yaml   # relative paths resolve from the repo manifest URL's directory
```

**Conventions**
- Repository manifest must be named `ruleloom.plugins.yaml` (or `.json`) and sit at the repository root; discovery assumes the root location (e.g., `https://raw.githubusercontent.com/org/repo/main/ruleloom.plugins.yaml`).
- `plugins[].manifest` supports either an absolute URL that starts with `https://` or a path relative to the repository manifest’s own URL (root example: `ruleloom.manifest.yaml`; nested example: `plugins/slack/ruleloom.manifest.yaml`).
- Rooted, fixed naming keeps lookup deterministic for both humans and UI and works for any GitHub ref/branch/tag.

## Implementation Plan
- UI config: accept one or more repository URLs (static hosting is fine—GitHub raw works). Store in a small config/env.
- Fetch path: UI fetches repos client-side; lists plugins with name/desc and “Load” action. Loading fetches the plugin manifest and merges closures/inputs into catalog, tagged with `repoId/pluginId`.
- Runtime sync: add/read runner endpoint that lists currently loaded plugins (name, version, manifest). UI “Refresh runtime plugins” pulls this and tags entries as `source: runtime:<id>`.
- Caching/version: cache by `id@manifestURL`; allow manual refresh per repo and for runtime inventory.
- Error handling: per-repo/per-plugin errors displayed without blocking others.
- Palette/inspector: group by source (core/runtime/repo), show badges/tooltips; inspector shows metadata from manifest.

## Acceptance Criteria
- UI can configure multiple repositories; lists plugins and loads selected ones into palette/inspector without rebuild.
- UI can fetch runtime plugin inventory from runner and reflect loaded plugins.
- Refresh updates lists and catalog; errors are surfaced per repo/plugin.
- Works with public static hosting (e.g., GitHub raw) without a backend proxy (subject to CORS).

## Code Touchpoints
- Runner: expose plugin inventory endpoint if not already present.
- UI: repository fetcher module; catalog store merges repo/runtime plugins with provenance tags; palette/inspector badges.
- Config: repo URLs + optional runtime endpoint URL/auth.

## Code Cleanliness
- Keep repository fetching isolated; catalog only consumes parsed manifests with provenance.
- Provenance tags (`core`, `runtime:<id>`, `repo:<id>/<pluginId>`) to avoid collisions.
- Avoid tight coupling: repo loading and runtime inventory are additive sources into catalog.
