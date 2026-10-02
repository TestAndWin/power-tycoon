import Database from 'better-sqlite3';
import type { GameState } from '@power-tycoon/engine';

export type Db = Database.Database;

/** Numbered migrations; index + 1 = schema version (`PRAGMA user_version`). */
const MIGRATIONS: string[] = [
  `CREATE TABLE games (
     id          TEXT PRIMARY KEY,
     token_hash  TEXT NOT NULL,
     state       TEXT NOT NULL,
     version     INTEGER NOT NULL,
     status      TEXT NOT NULL,
     created_at  TEXT NOT NULL,
     updated_at  TEXT NOT NULL
   );
   CREATE INDEX games_updated_at ON games(updated_at);`,
];

export function openDb(file: string): Db {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

export interface GameRow {
  id: string;
  tokenHash: string;
  state: GameState;
  version: number;
}

export const statusOf = (g: GameState): string => (g.over ? g.over : 'running');

export class GameRepo {
  constructor(private readonly db: Db) {}

  insert(id: string, tokenHash: string, state: GameState, now: Date = new Date()): void {
    const ts = now.toISOString();
    this.db
      .prepare(
        'INSERT INTO games (id, token_hash, state, version, status, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
      )
      .run(id, tokenHash, JSON.stringify(state), statusOf(state), ts, ts);
  }

  get(id: string): GameRow | null {
    const row = this.db.prepare('SELECT id, token_hash, state, version FROM games WHERE id = ?').get(id) as
      { id: string; token_hash: string; state: string; version: number } | undefined;
    if (!row) return null;
    return { id: row.id, tokenHash: row.token_hash, state: JSON.parse(row.state) as GameState, version: row.version };
  }

  /** Only the token hash, for the access check without loading the state. */
  tokenHash(id: string): string | null {
    const row = this.db.prepare('SELECT token_hash FROM games WHERE id = ?').get(id) as
      { token_hash: string } | undefined;
    return row?.token_hash ?? null;
  }

  /** Saves a new state if nobody else wrote in between (optimistic check on `version`). */
  save(id: string, expectedVersion: number, state: GameState, now: Date = new Date()): boolean {
    const res = this.db
      .prepare(
        'UPDATE games SET state = ?, version = version + 1, status = ?, updated_at = ? WHERE id = ? AND version = ?',
      )
      .run(JSON.stringify(state), statusOf(state), now.toISOString(), id, expectedVersion);
    return res.changes === 1;
  }

  /** Deletes games not updated for `days` days. Returns the number of deleted games. */
  cleanup(days: number, now: Date = new Date()): number {
    const cutoff = new Date(now.getTime() - days * 86400_000).toISOString();
    return this.db.prepare('DELETE FROM games WHERE updated_at < ?').run(cutoff).changes;
  }
}
