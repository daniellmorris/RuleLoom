# tree-exe-lib

Shared utilities for the TreeExe ecosystem. Right now it provides a lightweight logger implementation that adheres to the interfaces expected by `tree-exe-engine`, `tree-exe-core`, and higher-level packages.

## Installation

Within this monorepo the package is consumed via workspace references. If you publish it standalone:

```bash
npm install tree-exe-lib
```

## Exports

- `createLogger(level?: LogLevel)` → returns a structured logger that gates output by severity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`).
- `LogLevel`, `TreeExeLogger` types for TypeScript consumers.

```ts
import { createLogger } from 'tree-exe-lib';

const logger = createLogger('debug');
logger.info('Booting TreeExe Runner…');
```

## Usage in the Monorepo

- `tree-exe-engine` wires the logger into `runtime.logger` so closures can log without relying on `console`.
- `tree-exe-core` closures (e.g., `core.log`) expect a `TreeExeLogger` interface; importing from this package keeps everything aligned.

## Development

The package is TypeScript-only, compiled via `tsc -b`. See `package.json` for the build script.
