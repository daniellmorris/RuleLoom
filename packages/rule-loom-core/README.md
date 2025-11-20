# rule-loom-core

`rule-loom-core` ships a growing catalog of closures you can drop into any RuleLoom flow. Import `createCoreClosures()` (or `createBundleClosures('core')`) and pass the resulting array into the engine, or reference the `core` preset via `type: bundle` inside a runner config.

## Available Closures

| Closure | Description |
| --- | --- |
| `core.assign` | Write or merge values into `state` using JSON path syntax. |
| `core.respond` | Populate `state.response` (status/body/headers) for HTTP flows. |
| `core.log` | Log messages through the provided `RuleLoomLogger`. |
| `core.truthy` | Returns `true` if the supplied value is truthy. |
| `core.equals` | Deep equality comparison between `left` and `right`. |
| `core.greater-than` / `core.less-than` | Numeric comparisons (after coercion). |
| `core.includes` | Checks arrays/strings/object values for membership. |
| `core.length` | Returns the length/size of arrays, strings, or objects. |
| `core.for-each` | Iterates over a `collection` and runs inline `steps` for each item; exposes `state.currentItem` and `state.currentIndex`. |

## Usage from Code

```ts
import RuleLoomEngine from 'rule-loom-engine';
import { createCoreClosures } from 'rule-loom-core';

const engine = new RuleLoomEngine({
  closures: createCoreClosures(),
});

engine.registerFlow({
  name: 'demo',
  steps: [
    {
      closure: 'core.for-each',
      parameters: {
        collection: [1, 2, 3],
        steps: [
          {
            closure: 'core.log',
            parameters: { message: 'Processing ${state.currentItem}' },
          },
        ],
      },
    },
  ],
});
```

## Usage from YAML

Declare a `type: bundle` entry for the `core` preset inside the `closures` array:

```yaml
closures:
  - type: bundle
    preset: core
  - type: flow
    name: respond-success
    steps:
      - closure: core.respond
        parameters:
          status: 200
          body:
            ok: true
```

## Development

- To add a new reusable closure, export a factory (e.g., `coreRetryClosure`) and append it to `createCoreClosures()`.
- Mark any inline-step parameters via `functionalParams` if the closure should receive raw `FlowStep[]` arrays.
- Build with `npm run build --workspace rule-loom-core`.
