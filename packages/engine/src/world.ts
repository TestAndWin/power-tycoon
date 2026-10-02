/** World events at the start of a quarter end: historic milestones and random market/weather events. */
import { HIST, REGION_KEYS, type HistoricKey } from './data.js';
import { emit } from './events.js';
import { pick, randomOf } from './rng.js';
import { operating } from './rules.js';
import type { GameEvent, GameState } from './types.js';

/** Resets the quarter's effects (`g.fx`), then applies the historic event of this quarter and maybe a random one. */
export function applyWorldEvents(g: GameState, out: GameEvent[]): void {
  g.fx = { wind: 1, solar: 1, hydro: 1, price: 1, spread: 0 };
  const h = HIST.find((e) => e.year === g.year && e.q === g.q);
  if (h) {
    applyHistoric(g, h.key);
    emit(g, out, { type: 'historicEvent', key: h.key });
  }
  if (randomOf(g)() < 0.32) randomEvent(g, out);
}

function randomEvent(g: GameState, out: GameEvent[]): void {
  const r = randomOf(g);
  const fx = g.fx!;
  const winter = g.q === 0 || g.q === 3;
  const E: [number, () => GameEvent][] = [
    [
      winter ? 4 : 0,
      () => {
        fx.wind = 0.6;
        fx.solar = 0.5;
        fx.price = 1.4;
        fx.spread = 40;
        return { type: 'worldEvent', key: 'darkDoldrums' };
      },
    ],
    [
      winter ? 0 : 3,
      () => {
        fx.solar = 1.15;
        fx.price = 0.85;
        return { type: 'worldEvent', key: 'recordSummer' };
      },
    ],
    [
      3,
      () => {
        fx.wind = 0.75;
        return { type: 'worldEvent', key: 'lull' };
      },
    ],
    [
      2,
      () => {
        fx.wind = 1.15;
        for (const x of g.sites) {
          if (operating(x) && x.type === 'off' && r() < 0.3) {
            x.fault = true;
            out.push({ type: 'plantFault', playerId: x.owner, siteId: x.id, cause: 'storm' });
          }
        }
        return { type: 'worldEvent', key: 'stormSeries' };
      },
    ],
    [
      2,
      () => {
        g.base *= 1.25;
        g.target *= 1.12;
        fx.price = 1.2;
        return { type: 'worldEvent', key: 'gasShock' };
      },
    ],
    [
      3,
      () => {
        const region = pick(r, REGION_KEYS);
        g.grid[region] += 150;
        return { type: 'worldEvent', key: 'gridExpansion', region };
      },
    ],
    [
      2,
      () => {
        fx.hydro = 0.6;
        return { type: 'worldEvent', key: 'drought' };
      },
    ],
    [
      2,
      () => {
        g.target *= 0.9;
        g.base *= 0.93;
        return { type: 'worldEvent', key: 'industryDip' };
      },
    ],
  ];
  const tot = E.reduce((s, e) => s + e[0], 0);
  let k = r() * tot;
  for (const [w, f] of E) {
    k -= w;
    if (w && k <= 0) {
      emit(g, out, f());
      return;
    }
  }
}

function applyHistoric(g: GameState, key: HistoricKey): void {
  switch (key) {
    case 'ets2':
      g.target *= 1.08;
      break;
    case 'grid2030':
      for (const r of REGION_KEYS) g.grid[r] += 150;
      break;
    case 'hydrogen':
      g.target *= 1.15;
      g.ppaBoost = 1.6;
      break;
    case 'coalExit':
      g.target *= 1.1;
      g.spreadAdd += 20;
      break;
    case 'eu2040':
      g.target *= 1.06;
      break;
  }
}
