import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/ui-v2/src/**/*.{spec,test}.{ts,tsx}'],
    environment: 'node'
  }
});
