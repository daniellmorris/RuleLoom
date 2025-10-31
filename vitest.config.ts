import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.{spec,test}.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    globals: true,
    reporters: 'default',
  },
});
