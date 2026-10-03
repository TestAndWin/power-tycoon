/**
 * Bot-vs-bot simulation: plays N full games and reports the average net worth per strategy.
 *
 *   pnpm simulate -- --games 200 --seat0 normal
 *
 * `--rivals mixed` (default): seats 1–3 get normal / hard, rotated over the games so that
 * the regional preferences of the rivals do not favour one strategy. `--rivals hard` etc. gives all
 * three rivals the same strategy. Seat 0 (the "human") is played by `--seat0`
 * (normal | hard | idle) with automatic minigames.
 */
import { createGame, endQuarter, opponentFor, playTurn, playerView, type OpponentStrategy } from '../src/index.js';

type Name = 'normal' | 'hard';
const STRATS: Name[] = ['normal', 'hard'];

function arg(name: string, def: string): string {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : def;
}

const games = Number(arg('games', '100'));
const seed0 = Number(arg('seed', '1000'));
const seat0 = arg('seat0', 'normal') as Name | 'idle';
const rivalsArg = arg('rivals', 'mixed') as Name | 'mixed';

interface Stat {
  worth: number;
  wins: number;
  out: number;
  n: number;
}
const stats = new Map<string, Stat>();
const add = (k: string, worth: number, win: boolean, out: boolean) => {
  const s = stats.get(k) ?? { worth: 0, wins: 0, out: 0, n: 0 };
  s.worth += worth;
  s.wins += win ? 1 : 0;
  s.out += out ? 1 : 0;
  s.n++;
  stats.set(k, s);
};

const t0 = performance.now();
for (let i = 0; i < games; i++) {
  let g = createGame({ companyName: 'Sim', autoMinigames: true, seed: seed0 + i });
  const names: Name[] = [0, 1, 2].map((k) => (rivalsArg === 'mixed' ? STRATS[(i + k) % 2]! : rivalsArg));
  const rivals: OpponentStrategy[] = names.map((n) => opponentFor(n));
  const human = seat0 === 'idle' ? null : opponentFor(seat0);
  while (!g.over) {
    if (human) g = (await playTurn(g, 0, human)).state;
    g = (await endQuarter(g, rivals)).state;
  }
  const v = playerView(g, 0);
  const worths = v.players.map((p) => (p.out ? 0 : p.worth));
  const best = Math.max(...worths);
  add('seat0:' + seat0, worths[0]!, worths[0] === best, g.over === 'bankrupt');
  names.forEach((n, k) => add(n, worths[k + 1]!, worths[k + 1] === best, v.players[k + 1]!.out));
}

const fmt = (x: number) => (x / 1e6).toFixed(1).padStart(8) + ' M€';
console.log(
  `${games} games, rivals ${rivalsArg}, seeds ${seed0}…${seed0 + games - 1}, ${((performance.now() - t0) / 1000).toFixed(1)} s\n`,
);
console.log('strategy        avg worth   wins   bankrupt');
for (const [k, s] of stats)
  console.log(
    `${k.padEnd(14)} ${fmt(s.worth / s.n)}  ${((s.wins / s.n) * 100).toFixed(0).padStart(4)} %  ${String(s.out).padStart(6)}`,
  );
