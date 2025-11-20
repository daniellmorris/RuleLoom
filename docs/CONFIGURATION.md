# RuleLoom Configuration How-To

This guide walks through the YAML schema understood by `rule-loom-runner`. It is designed to be precise enough for AI tooling (or humans) to generate valid configs.

> **Orchestrator persistence:** When these configs are loaded via `rule-loom-orchestrator`, the runner definitions are also stored in SQLite through Prisma. Set `RULE_LOOM_DATABASE_URL` to move the database file (defaults to `.ruleloom/orchestrator.db`) and run `npx prisma migrate deploy --schema prisma/schema.prisma` whenever the schema changes.

## Top-Level Structure

```yaml
version: 1                # optional; defaults to 1
logger:                   # optional
  level: info | debug | ...
inputs:                   # optional; defaults to []
  - type: http            # HTTP input (Express app)
    basePath: /           # optional prefix for orchestrator mounting
    bodyLimit: 1mb        # optional (string or number) for JSON/body parsers
    routes:
      - method: get | post | put | patch | delete (defaults to post)
        path: /example
        flow: flow-name   # name of a flow defined below
        respondWith:      # optional static response if flow fails to produce one
          status: 202
          headers:
            x-static: value
          body: {}
  - type: scheduler       # Bree-backed scheduler jobs
    jobs:
      - name: heartbeat
        flow: flow-name
        interval: "1m"
  - type: mqtt | amqp     # reserved for future transports
    options: {}           # arbitrary settings for custom adapters
closures:                 # optional; defaults to []
  - type: core | template | module | flow | core
flows:                    # required; ≥1 flow definition
  - name: flow-name
    description: optional
    steps: [...]          # see step definitions below
```

Inputs describe how events enter the runner. Today the HTTP input (Express server) and scheduler input (Bree jobs) are implemented in `rule-loom-inputs`; future transports like AMQP/MQTT can be added without changing the runner core. Omit the HTTP input if you only need background jobs.

### `type: http`

- `basePath` – optional hint for the orchestrator when mounting runners (defaults to `/`).
- `bodyLimit` – forwarded to Express body parsers (string like `1mb` or numeric byte value).
- `routes` – array of route descriptors:
  - `method` – HTTP verb (defaults to `post`).
  - `path` – Express path pattern.
  - `flow` – flow name to execute.
  - `respondWith` – optional fallback response if the flow does not set `state.response`.

### `type: scheduler`

Described in detail below; groups Bree job declarations.

### `type: mqtt` / `type: amqp`

Placeholders for upcoming transports. They currently accept an arbitrary `options` object so tooling can capture intent even before the adapter exists.

## Closure Entries

### `type: core`
Imports the default bundle from `rule-loom-core` (`core.assign`, `core.respond`, `core.log`, `core.truthy`, `core.equals`, `core.greater-than`, `core.less-than`, `core.includes`, `core.length`, `core.for-each`).

```yaml
closures:
  - type: core
```

### `type: template`
Creates a closure from predefined templates.

- `set-state`: requires `target`, optional `value`, `merge` flag.
- `respond`: optional `status` (default `200`), `body`, `headers`.

```yaml
closures:
  - type: template
    template: set-state
    name: capture-request
    target: payload
```

### `type: module`
Loads closures from a local module. The module can export a single closure, an array, or a factory function. An optional `config` object is passed to factories.

```yaml
closures:
  - type: module
    module: ./my-closures.js
    export: createClosures  # optional; defaults to default export
    config:
      featureFlag: true
```

### `type: flow`
Defines a closure whose body is itself a miniature flow (inline steps). Useful for reuse or closure parameters that expect other closures.

```yaml
closures:
  - type: flow
    name: respond-success
    steps:
      - closure: core.respond
        parameters:
          status: 200
          body:
            ok: true
```

## Step Definitions

Steps are validated using the same schema whether they appear inside a top-level flow, a `type: flow` closure, or inline parameter arrays (functional parameters).

### Invoke Step

```yaml
- closure: core.assign           # required when not using branch syntax
  parameters:                    # optional; defaults to {}
    target: order
    value: "${request.body}"
  assign: saved-order            # optional; store return value under state[saved-order]
  mergeResult: true | false      # optional; merge object return values into state
  when:                          # optional condition (single or array)
    closure: core.truthy
    parameters:
      value: "${state.payload}"
```

### Branch Step (implicit)

A step is treated as a branch when it defines `cases` and omits `closure`. Each case contains a `when` condition and a nested `steps` array. An optional `otherwise` array runs if no case matches.

```yaml
- cases:
    - when:
        closure: core.equals
        parameters:
          left: "${state.order.type}"
          right: subscription
      steps:
        - closure: handle-subscription
  otherwise:
    - closure: handle-default
```

### Conditions (`when`)

The `when` field accepts either a single object or an array. Each condition is expressed as:

```yaml
when:
  - closure: core.greater-than
    parameters:
      left: "${state.order.total}"
      right: 100
  - closure: core.truthy
    parameters:
      value: "${state.order.items}"
```

All conditions must evaluate truthy for the step to run.

## Parameter Interpolation

- `${state.foo}` / `${runtime.bar}` / `${parameters.baz}` are replaced before the closure runs.
- Strings containing only `${...}` are coerced to the underlying value type (numbers, objects, arrays).
- Arrays and objects are processed recursively.

## `$call` Directive

Embed `$call` to inject the result of another closure (or inline steps) into parameters:

```yaml
parameters:
  summary:
    $call:
      name: format-summary
      parameters:
        total: "${state.order.total}"
```

or inline steps:

```yaml
parameters:
  summary:
    $call:
      steps:
        - closure: core.assign
          parameters:
            target: temp.summary
            value: "Total ${state.order.total}"
```

When `steps` are provided, the inline flow runs via `runtime.engine.runSteps` and returns the last result.

`$call` also accepts arrays (execute each entry and gather results) or nested objects.

## Functional Parameters (Inline Lambdas)

Some closures (e.g., `core.for-each`) expect raw step arrays. In YAML you can pass them directly as sibling fields:

```yaml
- closure: core.for-each
  collection: "${state.order.items}"
  steps:
    - closure: core.log
      parameters:
        message: "item ${state.currentItem}"
    - closure: core.assign
      parameters:
        target: "processed.${state.currentIndex}"
        value: "${state.currentItem}"
```

The engine skips interpolation on `steps` because the closure declares it via `functionalParams`.

## Scheduler Jobs

Declare scheduled jobs by adding a `type: scheduler` entry to `inputs`:

```yaml
inputs:
  - type: scheduler
    jobs:
      - name: heartbeat
        flow: heartbeat-flow
        interval: "1m"
        initialState:
          counter: 0
        runtime:
          source: scheduler
```

Job fields:

- `name` – unique identifier.
- `flow` – name of the flow to execute.
- `interval` / `cron` / `timeout` – scheduling hints; at least one must be provided. Strings like `"5m"` are parsed with human-interval support. Numbers use milliseconds. `timeout` represents a one-off delay.
- `initialState` – optional object cloned before each execution.
- `runtime` – merged into the execution runtime; the engine automatically adds `scheduler.job` and `scheduler.triggeredAt`.
- `enabled` – set to `false` to skip the job without removing it from the config.

Scheduler runs are tracked on the runner instance (`runner.scheduler.jobStates`) for observability and testing.

## Inline Flow Closures

`type: flow` closures can be invoked like normal closures in subsequent steps:

```yaml
closures:
  - type: flow
    name: enrich-order
    steps:
      - closure: core.assign
        parameters:
          target: metadata.total
          value: "${state.order.total}"

flows:
  - name: process-order
    steps:
      - closure: enrich-order
      - closure: core.respond
        parameters:
          status: 200
          body: "${state.metadata}"
```

## Putting It All Together

A minimal yet expressive configuration combining these features is provided at `packages/rule-loom-runner/config/example.http.yaml`. The test suite under `tests/engine.spec.ts` contains further examples you can mirror when generating configs programmatically.

Feel free to extend the schema (e.g., new closure presets or input adapters) by updating `packages/rule-loom-runner/src/config.ts` and documenting the change in this guide.
