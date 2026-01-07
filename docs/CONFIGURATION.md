# RuleLoom Configuration How-To

This guide walks through the YAML schema understood by `rule-loom-runner`. It is designed to be precise enough for AI tooling (or humans) to generate valid configs.

> **Orchestrator persistence:** When these configs are loaded via `rule-loom-orchestrator`, the runner definitions are also stored in SQLite through Prisma. Set `RULE_LOOM_DATABASE_URL` to move the database file (defaults to `.ruleloom/orchestrator.db`) and run `npx prisma migrate deploy --schema prisma/schema.prisma` whenever the schema changes.

## Top-Level Structure

```yaml
version: 1                # optional; defaults to 1
logger:                   # optional
  level: info | debug | ...
plugins:                  # optional; defaults to []
  - source: github
    repo: daniellmorris/RuleLoom
    ref: main
    path: plugins/rule-loom-plugin-http
inputs:                   # optional; defaults to []
  - type: http            # HTTP input (Express app)
    config:
      basePath: /api      # optional prefix for all routes
      bodyLimit: 1mb      # optional (string or number) for JSON/body parsers
      corsOrigins: http://localhost
      corsMethods: GET, POST
      corsAllowedHeaders: Authorization, Content-Type
    triggers:
      - method: get | post | put | patch | delete (defaults to post)
        path: /example
        flow: flow-name   # name of a flow defined below
        respondWith:      # optional static response if the flow does not set state.response
          status: 202
          headers:
            x-static: value
          body: {}
  - type: scheduler       # Bree-backed scheduler jobs
    triggers:
      - name: heartbeat
        flow: flow-name
        interval: "1m"
  - type: mqtt            # MQTT input (plugin)
    config:
      url: mqtt://localhost:1883
    triggers:
      - topic: sensors/+
        flow: flow-name
        json: true
  - type: websocket       # WebSocket input (plugin)
    config:
      url: wss://example.com/ws
    triggers:
      - flow: flow-name
        json: true
closures:                 # optional; defaults to []
  - type: template | module | flow
flows:                    # required; ≥1 flow definition
  - name: flow-name
    description: optional
    steps: [...]          # see step definitions below
```

Inputs describe how events enter the runner. Inputs are registered by plugins, so the available `type:` values depend on which plugins you load. The built-in plugins in this repo currently provide `http`, `scheduler`, `mqtt`, and `websocket`.

Plugins load before validation so custom closures/inputs are available to the schema. You can also ship “safe” config-only plugins (no JS) by pointing a plugin at a YAML/JSON file that contains just a `closures:` array (or is itself an array of closures):

```yaml
plugins:
  - source: config
    path: ./plugins/sanitized-closures.yaml
```

The runner parses and registers those closures as if they were inline, without executing arbitrary code.

### Plugin sources

Plugins can be loaded from these sources:

- `file` – local path to a plugin directory or file.
- `github` – GitHub repo + ref (branch/tag/commit) + optional path.
- `npm` / `store` – resolve from installed packages (by name/version).
- `config` – YAML/JSON with `closures:` (safe, no JS).

Example GitHub plugin spec:

```yaml
plugins:
  - source: github
    repo: daniellmorris/RuleLoom
    ref: main
    path: plugins/rule-loom-plugin-http
    name: HTTP Input & Closures
```

GitHub plugins are cached under `~/.rule-loom/plugins/<repo>@<ref>`. For branch/tag refs, the runner checks the latest commit and only re-downloads when it changes. If the check fails, it keeps the cached plugin. For pinned 40-char SHA refs, no update check is performed.

### Plugin repositories (ui-v2 catalog)

`ui-v2` can load plugin catalogs from `ruleloom.plugins.yaml` / `.json` files hosted at a URL. Each entry points at a plugin manifest URL, and relative paths are resolved against the catalog URL.

```yaml
version: 1
repo:
  name: "RuleLoom Local Workspace"
  description: "Local plugin catalog for this monorepo."
plugins:
  - id: core
    name: "RuleLoom Core"
    description: "Core closures and init input."
    manifest: plugins/rule-loom-core/ruleloom.manifest.yaml
  - id: http
    name: "HTTP Input & Closures"
    description: "Express-based HTTP input plugin."
    manifest: plugins/rule-loom-plugin-http/ruleloom.manifest.yaml
```

When the manifest URL is hosted on `raw.githubusercontent.com`, the UI can derive a GitHub plugin spec automatically and add it to the runner config (`source: github`, with `repo/ref/path`). Non-GitHub hosts still load manifests for catalog display, but won’t auto-generate GitHub specs.

### `type: http`

- `config.basePath` – optional route prefix (defaults to `/`).
- `config.bodyLimit` – forwarded to Express body parsers (string like `1mb` or numeric byte value).
- `config.corsOrigins` / `config.corsMethods` / `config.corsAllowedHeaders` – optional CORS allowlists (string or array; comma-separated strings are accepted).
- `triggers` – array of route descriptors:
  - `method` – HTTP verb (defaults to `post`).
  - `path` – Express path pattern.
  - `flow` – flow name to execute.
  - `respondWith` – optional fallback response if the flow does not set `state.response`.

### `type: scheduler`

Described in detail below; groups Bree job triggers.

> **Example:** `examples/configs/home-assistant-toggle.yaml` combines the scheduler input with the `http.request` closure from the HTTP plugin and an inline `type: flow` closure to toggle a Home Assistant switch via REST.

### `type: mqtt`

MQTT input provided by `rule-loom-plugin-mqtt`:

- `config.url` – broker URL (required).
- `config.username` / `config.password` / `config.clientId` – optional connection settings.
- `config.options` – additional MQTT client options.
- `triggers`:
  - `topic` – subscription topic (required).
  - `flow` – flow name to execute (required).
  - `qos` – 0/1/2.
  - `json` – parse payload as JSON when true.

### `type: websocket`

WebSocket input provided by `rule-loom-plugin-websocket`:

- `config.url` – WebSocket URL (required).
- `config.protocols` – optional subprotocol string/array.
- `config.headers` – optional handshake headers.
- `config.connectMessages` – optional array of messages to send after connect (objects are JSON-encoded).
- `config.reconnect` – reconnect on disconnect (default true).
- `config.reconnectIntervalMs` – reconnect delay (default 5000).
- `triggers`:
  - `flow` – flow name to execute (required).
  - `json` – parse inbound messages as JSON when true.

## Closure Entries

Every closure must declare a schema (aka signature) describing its parameters and outputs. The core plugin auto-registers the `core.*` utilities, and other plugins (e.g., HTTP, MQTT) register their own closures. Custom modules should return closures with a `signature` property so the runner can validate flow steps before execution. Use `npm run validate -- --config path/to/config.yaml` (or `ruleloom-runner validate -c ...`) to lint a config offline; the orchestrator also exposes `POST /api/runners/validate` for the same check.

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

The engine skips interpolation on `steps` because the closure signature marks it as `flowSteps`.

## Scheduler Jobs

Declare scheduled jobs by adding a `type: scheduler` entry to `inputs`:

```yaml
inputs:
  - type: scheduler
    triggers:
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
- `interval` / `cron` / `timeout` – scheduling hints; at least one must be provided. Strings are passed directly to Bree; numbers use milliseconds. `timeout` represents a one-off delay.
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
