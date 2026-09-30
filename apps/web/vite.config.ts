import { defineConfig } from 'vitest/config';

const apiPort = process.env.API_PORT ?? '3000';

export default defineConfig({
  resolve: { conditions: ['source', 'module', 'browser', 'development|production'] },
  server: {
    port: 5173,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { environment: 'node' },
});
