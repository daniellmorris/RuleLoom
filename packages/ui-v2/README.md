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

## Layout and block registry
- `src/config/layout.default.json` drives the page shell. It now supports `pages` (recommended) and the legacy top-level `regions` shape:
  - Each page declares `regions` (`header`, `sidebar`, `canvas`, `inspector`) with ordered blocks and optional `slot` keys.
  - If only `regions` is present, the shell treats it as a single default page.
- The component registry (`src/utils/componentRegistry.ts`) starts with core blocks: `ShellHeader`, `Palette`, `PluginLibrary`, `ImportExport`, `Canvas`, and `Inspector`.
- Plugins can override any block by name; the registry will replace the core registration with the plugin export. New blocks simply need a layout entry to render.
- The header now shows a page selector when multiple pages are defined.
- A simple JSON-based dashboard/layout editor is available on the “Dashboard” page; it lets you tweak the Puck layout JSON and re-render live.

## UI plugins
- Host plugin sources live in `src/config/plugins.json` (GitHub repo + ref + manifest path). In dev you can reload via the header button or by editing the config (HMR will refetch).
- Manifests must be reachable via `raw.githubusercontent.com` (or a compatible base) and reference ESM bundles with absolute or repo-relative paths:
  ```json
  {
    "id": "my-plugin",
    "version": "0.1.0",
    "blocks": [
      {
        "type": "sidebar",
        "name": "CustomPanel",
        "module": "org/repo/path/dist/plugin.js",
        "spec": { "slot": "primary", "order": 5, "export": "CustomPanel" }
      }
    ],
    "source": { "repo": "org/repo", "ref": "main", "entry": "path/dist/plugin.js" }
  }
  ```
- Blocks are resolved through the registry; missing entries render a clear fallback so the host does not crash.
- Plugins should rely on the stable `usePluginApi` surface (also exposed on `globalThis.RuleLoomPluginApi`) instead of importing internal stores directly.
- You can also ship plugins via npm and resolve them at runtime without external network calls. Add an entry like:
  ```json
  {
    "kind": "npm",
    "package": "@your-scope/your-plugin",
    "manifest": "dist/manifest.json",
    "moduleBase": "dist"
  }
  ```
  The loader will dynamically import the manifest and bundles from the installed package.

## Sample GitHub-ready plugin
- `packages/ui-v2/examples/ui-plugin-sample` ships a sidebar panel and inspector section. Run `npm run build` inside that folder to emit `dist/plugin.js` and `dist/manifest.json` ready for `raw.githubusercontent.com`.
- The sample manifest is already referenced in `src/config/plugins.json` for local experimentation; remote fetch errors are logged but do not break the host.

## Layout editing
- Layouts are defined in JSON today; there is no built-in visual Puck layout editor yet. You can edit `src/config/layout.default.json` (or your own layout file) directly, or swap it at runtime if you add your own editor/loader.

## Next steps
- Wire to real plugin catalog and schema definitions.
- Add drag/drop and dynamic connector creation.
- Persist/import/export flow specs as JSON.
- Add simulation/run traces overlay.
