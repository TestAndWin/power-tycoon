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
    case 'hqUpgraded':
    case 'awardWon':
    case 'climateBonus':
      return true;
    case 'trickFailed':
      // the human learns about attempts on own sites (whose actor stays unknown unless caught)
      return e.caught || human(e.targetId);
    case 'spied':
      return e.caught;
    case 'gridDuel':
      return human(e.playerId) || human(e.rivalId);
    case 'siteLeased':
      return human(e.playerId) || e.amount >= 1.5e6;
    case 'plantBuilt':
    case 'repowered':
    case 'gridConnected':
    case 'siteSold':
    case 'contractAccepted':
    case 'executiveHired':
      return human(e.playerId);
    case 'executiveLeft':
      return human(e.playerId) && e.poached;
    default:
      return false;
  }
}

/**
 * Confrontations between players (tricks, spies, cable duels): they concern the target too, and the web app
 * shows them as complete sentences.
 */
export const isConfrontation = (e: GameEvent): boolean =>
  e.type === 'trickSucceeded' || e.type === 'trickFailed' || e.type === 'spied' || e.type === 'gridDuel';

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
    case 'detectivesHired':
    case 'detectivesExpired':
    case 'executiveHired':
    case 'executiveLeft':
    case 'decisionOffered':
    case 'decisionTaken':
      return e.playerId === viewer ? e : null;
    case 'spied':
      return e.playerId === viewer || e.caught ? e : null;
    case 'permitApplied':
      if (e.playerId === viewer) return e;
      return { ...e, quarters: undefined };
    case 'trickFailed':
      if (e.actorId === viewer || e.caught) return e;
      return e.targetId === viewer ? { ...e, actorId: null } : null;
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
    case 'spied':
      return e.playerId === pid || (e.targetId === pid && e.caught);
    case 'gridDuel':
      return e.playerId === pid || e.rivalId === pid;
    default:
      return 'playerId' in e && e.playerId === pid;
  }
}
