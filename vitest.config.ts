import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        'vite.config.ts',
        'vitest.config.ts',
        '**/types.ts',
        '**/index.ts',
        '**/*.d.ts',
        'dist/',
        'build/',
        'coverage/',
        '*.config.*',
        'scripts/',
        'docs/',
        'examples/',
        'templates/'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 30000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});

