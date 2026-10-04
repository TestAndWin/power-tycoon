import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  applyAction,
  canEndQuarter,
  createGame,
  endQuarter,
  eventsForViewer,
  playerView,
  opponentsFor,
  type Action,
  type ErrorCode,
  type GameState,
  type OpponentStrategy,
} from '@power-tycoon/engine';
import { bearerToken, hashToken, newGameId, newToken, tokenMatches } from './auth.js';
import { GameRepo, openDb, type Db, type GameRow } from './db.js';
import { KeyedLock } from './lock.js';
import { ActionBody, CreateGameBody, GameParams } from './schemas.js';

export interface AppOptions {
  /** SQLite file path (":memory:" for tests). */
  dbFile: string;
  /** Directory with the built web app; served under "/" if it exists. */
  webRoot?: string;
  logger?: boolean;
  /** Rivals for a game (default: by the game's difficulty). */
  opponents?: (state: GameState) => OpponentStrategy[];
  /** Max new games per IP per hour. */
  createLimit?: number;
  /** Max requests per IP per minute (all routes). */
  globalLimit?: number;
  /**
   * Number of proxies in front of the app (default 1, the ingress; 0 = none). Trusting all
   * proxies would take the left-most, client-controlled X-Forwarded-For entry as the IP.
   */
  trustProxy?: number;
  /** Delete games not updated for this many days. */
  retentionDays?: number;
}

const HUMAN = 0;
/**
 * The web app loads only its own bundle. Inline style attributes are used throughout the
 * rendered HTML, fonts are embedded as data URLs in the CSS, scripts stay strictly 'self'.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');
const CONFLICT_ERRORS = new Set<ErrorCode>(['challengeOpen', 'gameOver']);

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

const defaultOpponents = (state: GameState): OpponentStrategy[] => opponentsFor(state.settings.difficulty);

export async function buildApp(opts: AppOptions): Promise<FastifyInstance & { db: Db }> {
  const app = Fastify({
    logger: opts.logger ? { redact: ['req.headers.authorization'] } : false,
    trustProxy: (_addr: string, hop: number) => hop < (opts.trustProxy ?? 1),
    bodyLimit: 16 * 1024,
    // no type coercion: it would turn boolean minigame outcomes into 0/1 (number | boolean union)
    ajv: { customOptions: { coerceTypes: false } },
  }).withTypeProvider<TypeBoxTypeProvider>();
  const db = openDb(opts.dbFile);
  const repo = new GameRepo(db);
  const lock = new KeyedLock();
  const opponents = opts.opponents ?? defaultOpponents;
  const retention = opts.retentionDays ?? 180;

  app.decorate('db', db);
  app.addHook('onClose', async () => db.close());

  // cleanup of old games on startup and daily
  const cleanup = () => {
    const n = repo.cleanup(retention);
    if (n) app.log.info({ deleted: n }, 'deleted old games');
  };
  cleanup();
  const timer = setInterval(cleanup, 24 * 3600_000);
  timer.unref();
  app.addHook('onClose', async () => clearInterval(timer));

  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Content-Security-Policy', CSP);
    reply.header('Strict-Transport-Security', 'max-age=31536000');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    return payload;
  });

  await app.register(rateLimit, {
    max: opts.globalLimit ?? 600,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => ({ statusCode: ctx.statusCode, error: 'rateLimited' }),
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.code });
    // no validator message: it would reveal schema internals, the client only uses the code
    if (err.validation) return reply.status(400).send({ error: 'badRequest' });
    const status = err.statusCode ?? 500;
    if (status === 429) return reply.status(429).send({ error: 'rateLimited' });
    if (status >= 500) app.log.error(err);
    return reply.status(status).send({ error: status >= 500 ? 'internalError' : 'badRequest' });
  });

  /** Checks the bearer token for the game (401 missing/invalid, 404 unknown game). */
  function authorize(req: FastifyRequest, id: string): void {
    const token = bearerToken(req.headers.authorization);
    if (!token) throw new HttpError(401, 'unauthorized');
    const hash = repo.tokenHash(id);
    if (!hash) throw new HttpError(404, 'notFound');
    if (!tokenMatches(token, hash)) throw new HttpError(401, 'unauthorized');
  }

  /** Loads an authorized game (it may have been deleted in between). */
  function load(id: string): GameRow {
    const row = repo.get(id);
    if (!row) throw new HttpError(404, 'notFound');
    return row;
  }

  function save(row: GameRow, state: GameState): void {
    if (!repo.save(row.id, row.version, state)) throw new HttpError(409, 'conflict');
  }

  app.get('/api/health', async () => ({ ok: true }));

  app.post(
    '/api/games',
    {
      schema: { body: CreateGameBody },
      config: { rateLimit: { max: opts.createLimit ?? 10, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const state = createGame({
        companyName: req.body.companyName,
        autoMinigames: req.body.autoMinigames,
        difficulty: req.body.difficulty ?? 'normal',
        years: req.body.years,
        seed: randomInt(0, 2 ** 31),
      });
      const gameId = newGameId();
      const token = newToken();
      repo.insert(gameId, hashToken(token), state);
      return reply.status(201).send({ gameId, token, view: playerView(state, HUMAN) });
    },
  );

  app.get('/api/games/:id', { schema: { params: GameParams } }, async (req) => {
    authorize(req, req.params.id);
    return { view: playerView(load(req.params.id).state, HUMAN) };
  });

  app.post('/api/games/:id/actions', { schema: { params: GameParams, body: ActionBody } }, async (req) => {
    const id = req.params.id;
    authorize(req, id);
    return lock.run(id, () => {
      const row = load(id);
      const res = applyAction(row.state, HUMAN, req.body.action as Action);
      if (!res.ok) throw new HttpError(CONFLICT_ERRORS.has(res.error) ? 409 : 422, res.error);
      save(row, res.state);
      return {
        view: playerView(res.state, HUMAN),
        events: eventsForViewer(res.events, HUMAN),
        challenge: res.challenge,
      };
    });
  });

  app.post('/api/games/:id/end-quarter', { schema: { params: GameParams } }, async (req) => {
    const id = req.params.id;
    authorize(req, id);
    return lock.run(id, async () => {
      const row = load(id);
      const blocked = canEndQuarter(row.state);
      if (blocked) throw new HttpError(409, blocked);
      const result = await endQuarter(row.state, opponents(row.state));
      save(row, result.state);
      return { view: playerView(result.state, HUMAN), report: result.report, rivalActions: result.rivalActions };
    });
  });

  // web app
  const webRoot = opts.webRoot && existsSync(join(opts.webRoot, 'index.html')) ? opts.webRoot : undefined;
  if (webRoot) {
    await app.register(fastifyStatic, {
      root: webRoot,
      wildcard: false,
      // @fastify/static 10 passes the Fastify reply here
      setHeaders: (reply: unknown, path: string) => {
        (reply as FastifyReply).header(
          'Cache-Control',
          path.includes(join('/', 'assets', '/')) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    if (req.url.startsWith('/api/') || !webRoot || req.method !== 'GET') {
      return reply.status(404).send({ error: 'notFound' });
    }
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
  });

  return app as unknown as FastifyInstance & { db: Db };
}
