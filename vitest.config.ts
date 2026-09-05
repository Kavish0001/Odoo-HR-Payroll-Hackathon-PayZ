import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['{shared,server}/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['shared/src/**', 'server/src/**'],
    },
  },
});
