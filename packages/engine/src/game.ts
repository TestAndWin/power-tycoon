import {
  AI_DEF,
  GAME_YEARS,
  PRICE_SEASON,
  REGION_KEYS,
  REGIONS,
  SITES_PER_REGION,
  START_CASH,
  START_YEAR,
} from './data.js';
import { rand, randomOf, type Random } from './rng.js';
import { emit, genOffers, updateSpread, worth } from './rules.js';
import type { GameState, Player, PlayerId, RegionKey, Site } from './types.js';

export interface CreateGameOptions {
  companyName: string;
  autoMinigames: boolean;
  seed: number;
}

function makeSite(r: Random, k: RegionKey, i: number): Site {
  const R = REGIONS[k];
  const s: Site = {
    id: k + i,
    r: k,
    i,
    owner: -1,
    type: null,
    permit: null,
    permitLeft: 0,
    built: false,
    fail: false,
    grid: false,
    eff: 1,
    fault: false,
    curtail: 0,
    invested: 0,
    age: 0,
    surveyed: [],
    wind: null,
    sun: null,
    hydro: false,
    lease: 0,
    killed: false,
  };
  s.wind = R.wind ? Math.round(rand(r, R.wind[0], R.wind[1]) * 10) / 10 : null;
  s.sun = R.sun ? Math.round(rand(r, R.sun[0], R.sun[1]) / 10) * 10 : null;
  s.hydro = R.hydro ? r() < R.hydro : false;
  let q = 0.5;
  if (k === 'ns' || k === 'nd') q = (s.wind! - R.wind![0]) / (R.wind![1] - R.wind![0]);
  else if (k === 'ib') q = (s.sun! - R.sun![0]) / (R.sun![1] - R.sun![0]);
  else q = (s.hydro ? 0.7 : 0.2) + r() * 0.3;
  s.lease = Math.round(((R.lease[0] + (R.lease[1] - R.lease[0]) * (0.5 * q + 0.5 * r())) * 1e6) / 5e4) * 5e4;
  return s;
}

function mkPlayer(id: PlayerId, name: string, human: boolean): Player {
  return {
    id,
    name,
    human,
    cash: START_CASH,
    loan: 0,
    out: false,
    hist: [],
    genLast: 0,
    co2: 0,
    revLast: 0,
    contracts: [],
    trickUsed: 0,
  };
}

/** Creates a new game. Port of legacy `newGame()`. */
export function createGame(opts: CreateGameOptions): GameState {
  const name = opts.companyName.trim().slice(0, 40) || 'Mein Konzern';
  const players = [mkPlayer(0, name, true), ...AI_DEF.map((a, i) => mkPlayer(i + 1, a.name, false))];
  const g: GameState = {
    v: 1,
    seed: opts.seed >>> 0,
    rng: opts.seed | 0,
    year: START_YEAR,
    q: 0,
    startYear: START_YEAR,
    endYear: START_YEAR + GAME_YEARS,
    turn: 0,
    players,
    sites: [],
    grid: { nd: 0, ns: 0, ib: 0, al: 0 },
    res: [],
    base: 85,
    target: 85,
    price: 85 * PRICE_SEASON[0]!,
    spread: 50,
    spreadAdd: 0,
    ppaBoost: 1,
    fx: null,
    priceHist: [],
    spreadHist: [],
    offers: [],
    news: [],
    nextId: 1,
    over: false,
    settings: { autoMinigames: !!opts.autoMinigames },
    challenge: null,
  };
  const r = randomOf(g);
  for (const k of REGION_KEYS) for (let i = 0; i < SITES_PER_REGION; i++) g.sites.push(makeSite(r, k, i));
  for (const k of REGION_KEYS) g.grid[k] = REGIONS[k].grid;
  updateSpread(g);
  g.priceHist.push(Math.round(g.price));
  g.spreadHist.push(Math.round(g.spread));
  genOffers(g);
  for (const p of players) p.hist.push(worth(g, p));
  emit(g, [], { type: 'gameStarted', playerId: 0, cash: START_CASH });
  return g;
}
