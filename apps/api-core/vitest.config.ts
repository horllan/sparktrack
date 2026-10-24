import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: './src',
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@intelligence': path.resolve(__dirname, 'src/intelligence-core'),
      '@platform': path.resolve(__dirname, 'src/platform-modules'),
      '@common': path.resolve(__dirname, 'src/common'),
    },
  },
});
