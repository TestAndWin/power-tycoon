import { defineConfig } from 'vitest/config';

const apiPort = process.env.API_PORT ?? '3000';

export default defineConfig({
  resolve: { conditions: ['source', 'module', 'browser', 'development|production'] },
  server: {
    port: 5173,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
  build: { outDir: 'dist', emptyOutDir: true },
  // Tests run in Node (SSR resolution): resolve the engine from its TypeScript sources, no build needed.
  ssr: { resolve: { conditions: ['source', 'import', 'module', 'node', 'default'] } },
  test: { environment: 'node' },
});
