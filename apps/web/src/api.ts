import type { Action, Challenge, GameEvent, PlayerView, QuarterReport, RivalActionLog } from '@power-tycoon/engine';
import { errorText } from './texts.js';

const STORE_KEY = 'wattmogul-game';

export interface StoredGame {
  gameId: string;
  token: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(errorText(code));
  }
}

export function loadStored(): StoredGame | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as StoredGame | null;
    if (s && typeof s.gameId === 'string' && typeof s.token === 'string') return s;
  } catch {
    /* ignore */
  }
  return null;
}
export function saveStored(g: StoredGame | null): void {
  try {
    if (g) localStorage.setItem(STORE_KEY, JSON.stringify(g));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

async function call<T>(method: string, path: string, token: string | null, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  let res: Response;
  try {
    res = await fetch('/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? 'internalError');
  return data as T;
}

export interface ActionResponse {
  view: PlayerView;
  events: GameEvent[];
  challenge: Challenge | null;
}
export interface QuarterResponse {
  view: PlayerView;
  report: QuarterReport;
  rivalActions: RivalActionLog[];
}

export const api = {
  create: (companyName: string, autoMinigames: boolean) =>
    call<StoredGame & { view: PlayerView }>('POST', '/games', null, { companyName, autoMinigames }),
  load: (g: StoredGame) => call<{ view: PlayerView }>('GET', '/games/' + encodeURIComponent(g.gameId), g.token),
  action: (g: StoredGame, action: Action) =>
    call<ActionResponse>('POST', '/games/' + encodeURIComponent(g.gameId) + '/actions', g.token, { action }),
  endQuarter: (g: StoredGame) =>
    call<QuarterResponse>('POST', '/games/' + encodeURIComponent(g.gameId) + '/end-quarter', g.token),
};
