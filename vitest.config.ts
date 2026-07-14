import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.{spec,test}.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    globals: true,
    reporters: 'default',
    setupFiles: ['tests/setup/http-bind-check.ts', 'tests/setup/supertest-host.ts'],
    // Several integration fixtures intentionally bind the same fixed ports.
    // Run files serially so one worker cannot race another process-local server.
    fileParallelism: false,
  },
});
