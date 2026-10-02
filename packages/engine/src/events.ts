/** Game events: recording, the news feed and what each player may see of an event. */
import { NEWS_LIMIT } from './data.js';
import type { GameEvent, GameState, PlayerId } from './types.js';

function isNews(g: GameState, e: GameEvent): boolean {
  const human = (pid: PlayerId) => !!g.players[pid]?.human;
  switch (e.type) {
    case 'gameStarted':
    case 'historicEvent':
    case 'worldEvent':
    case 'playerBankrupt':
    case 'trickSucceeded':
    case 'gridReserved':
      return true;
    case 'trickFailed':
      return e.caught;
    case 'siteLeased':
      return human(e.playerId) || e.amount >= 1.5e6;
    case 'plantBuilt':
    case 'gridConnected':
    case 'siteSold':
    case 'contractAccepted':
      return human(e.playerId);
    default:
      return false;
  }
}

/** Records an event and, if newsworthy, adds it to the news feed. */
export function emit(g: GameState, out: GameEvent[], e: GameEvent): void {
  out.push(e);
  if (isNews(g, e)) {
    g.news.unshift({ year: g.year, q: g.q, event: e });
    if (g.news.length > NEWS_LIMIT) g.news.pop();
  }
}

/** What a player may see of an event (null = hidden). */
export function eventForViewer(e: GameEvent, viewer: PlayerId): GameEvent | null {
  switch (e.type) {
    case 'siteSurveyed':
    case 'loanTaken':
    case 'loanRepaid':
    case 'actionRejected':
      return e.playerId === viewer ? e : null;
    case 'permitApplied':
      if (e.playerId === viewer) return e;
      return { ...e, quarters: undefined };
    case 'trickFailed':
      return e.actorId === viewer || e.caught ? e : null;
    case 'trickSucceeded':
      return e.actorId === viewer || e.suspected ? e : { ...e, actorId: null };
    default:
      return e;
  }
}

export const eventsForViewer = (events: GameEvent[], viewer: PlayerId): GameEvent[] =>
  events.map((e) => eventForViewer(e, viewer)).filter((e): e is GameEvent => e !== null);

/** Is this event of interest for player `pid`'s quarterly report? */
export function concerns(e: GameEvent, pid: PlayerId): boolean {
  switch (e.type) {
    case 'historicEvent':
    case 'worldEvent':
    case 'playerBankrupt':
      return true;
    case 'trickSucceeded':
    case 'trickFailed':
      return e.targetId === pid;
    default:
      return 'playerId' in e && e.playerId === pid;
  }
}
