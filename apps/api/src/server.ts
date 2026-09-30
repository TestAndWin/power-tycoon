import Fastify from 'fastify';
import { ENGINE_VERSION } from '@power-tycoon/engine';

const app = Fastify({ logger: true });
app.get('/api/health', async () => ({ ok: true, engine: ENGINE_VERSION }));

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
