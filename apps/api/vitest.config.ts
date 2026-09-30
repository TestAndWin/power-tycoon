import { defineConfig } from 'vitest/config';

// Resolve the engine from its TypeScript sources (no build needed for tests).
export default defineConfig({
  resolve: { conditions: ['source', 'import', 'module', 'node', 'default'] },
  ssr: { resolve: { conditions: ['source', 'import', 'module', 'node', 'default'] } },
});
