import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.DATA_DIR ?? join(here, '../../../data'));
const webRoot = resolve(process.env.WEB_ROOT ?? join(here, '../../web/dist'));
mkdirSync(dataDir, { recursive: true });

const app = await buildApp({
  dbFile: join(dataDir, 'power-tycoon.db'),
  webRoot,
  logger: true,
  trustProxy: process.env.TRUST_PROXY !== 'false',
});

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '127.0.0.1' });
