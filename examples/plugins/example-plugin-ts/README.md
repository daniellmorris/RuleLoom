# TypeScript example plugin

This folder shows how to author a RuleLoom plugin in TypeScript with full type safety from `rule-loom-runner`.

## Build

```bash
cd examples/plugins/example-plugin-ts
npm install
npm run build
```

The compiled plugin lives in `dist/plugin.js` and is referenced by `examples/plugin-runner-ts.yml`.

## Run with the sample config

From the repository root after building:

```bash
npx ruleloom-runner --config examples/plugin-runner-ts.yml
```

The config mirrors the JavaScript example but loads the TypeScript-built plugin instead.
