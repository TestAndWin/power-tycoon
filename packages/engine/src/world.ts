/** World events at the start of a quarter end: historic milestones and random market/weather events. */
import { HIST, REGION_KEYS, STORM_FAULT, WORLD_EVENT_CHANCE, WORLD_EVENTS, type HistoricDef } from './data.js';
import { emit } from './events.js';
import { pick, randomOf } from './rng.js';
import { operating } from './rules.js';
import type { GameEvent, GameState, WorldEventKey } from './types.js';

/** Resets the quarter's effects (`g.fx`), then applies the historic event of this quarter and maybe a random one. */
export function applyWorldEvents(g: GameState, out: GameEvent[]): void {
  g.fx = { wind: 1, solar: 1, hydro: 1, price: 1, spread: 0 };
  const h = HIST.find((e) => e.year === g.year && e.q === g.q);
  if (h) {
    applyHistoric(g, h);
    emit(g, out, { type: 'historicEvent', key: h.key });
  }
  if (randomOf(g)() < WORLD_EVENT_CHANCE) randomEvent(g, out);
}

function randomEvent(g: GameState, out: GameEvent[]): void {
  const r = randomOf(g);
  const season = g.q === 0 || g.q === 3 ? 0 : 1;
  const keys = Object.keys(WORLD_EVENTS) as WorldEventKey[];
  const tot = keys.reduce((s, k) => s + WORLD_EVENTS[k].weight[season], 0);
  let n = r() * tot;
  const key = keys.find((k) => {
    const w = WORLD_EVENTS[k].weight[season];
    n -= w;
    return w > 0 && n <= 0;
  });
  if (!key) return;
  const E = WORLD_EVENTS[key];
  const fx = g.fx!;
  for (const f of ['wind', 'solar', 'hydro', 'price', 'spread'] as const) if (E[f] !== undefined) fx[f] = E[f];
  if (E.base) g.base *= E.base;
  if (E.target) g.target *= E.target;
  if (key === 'stormSeries')
    for (const x of g.sites) {
      if (operating(x) && x.type === 'off' && r() < STORM_FAULT) {
        x.fault = true;
        out.push({ type: 'plantFault', playerId: x.owner, siteId: x.id, cause: 'storm' });
      }
    }
  if (E.grid) {
    const region = pick(r, REGION_KEYS);
    g.grid[region] += E.grid;
    emit(g, out, { type: 'worldEvent', key, region });
  } else emit(g, out, { type: 'worldEvent', key });
}

function applyHistoric(g: GameState, h: HistoricDef): void {
  if (h.target) g.target *= h.target;
  if (h.grid) for (const r of REGION_KEYS) g.grid[r] += h.grid;
  if (h.spread) g.spreadAdd += h.spread;
  if (h.ppaBoost) g.ppaBoost = h.ppaBoost;
}
