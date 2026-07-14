# rule-loom-orchestrator-ui

Legacy React/Vite management UI served by `rule-loom-orchestrator`. It lists and inspects runner instances through `/api` and provides the original flow visualizer/builder.

```bash
npm run dev --workspace rule-loom-orchestrator-ui
npm run build --workspace rule-loom-orchestrator-ui
```

For new visual authoring features, `packages/ui-v2` is the strategic editor. Keep this package focused on orchestrator operations until the two surfaces are consolidated.
