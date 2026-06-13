/// vitest.config.ts — croo-core test configuration
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
      },
    },
  },
});
