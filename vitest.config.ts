import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two projects: browser code under src/ runs in jsdom; the local API (server/) and scripts/ run in Node.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.mjs', 'scripts/**/*.test.mjs'],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
