# rule-loom-lib

Shared utilities for the RuleLoom ecosystem. Right now it provides a lightweight logger implementation that adheres to the interfaces expected by `rule-loom-engine`, `rule-loom-core`, and higher-level packages.

## Installation

Within this monorepo the package is consumed via workspace references. If you publish it standalone:

```bash
npm install rule-loom-lib
```

## Exports

- `createLogger(level?: LogLevel)` → returns a structured logger that gates output by severity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`).
- `LogLevel`, `RuleLoomLogger` types for TypeScript consumers.

```ts
import { createLogger } from 'rule-loom-lib';

const logger = createLogger('debug');
logger.info('Booting RuleLoom Runner…');
```

## Usage in the Monorepo

- `rule-loom-engine` wires the logger into `runtime.logger` so closures can log without relying on `console`.
- `rule-loom-core` closures (e.g., `core.log`) expect a `RuleLoomLogger` interface; importing from this package keeps everything aligned.

## Development

The package is TypeScript-only, compiled via `tsc -b`. See `package.json` for the build script.
