/**
 * Bot-vs-bot simulation: plays N full games and reports the average net worth per strategy.
 *
 *   pnpm simulate -- --games 200 --seat0 normal
 *
 * `--rivals mixed` (default): seats 1–3 get normal / hard, rotated over the games so that
 * the regional preferences of the rivals do not favour one strategy. `--rivals hard` etc. gives all
 * three rivals the same strategy. Seat 0 (the "human") is played by `--seat0`
 * (normal | hard | idle) with automatic minigames, or with `--skilled` like a practised human who wins
 * every minigame (layout 1.15, no failed assembly or connection).
 *
 * The game difficulty (it sets the rivals' automatic minigame outcomes) is `hard` with `--rivals hard`, else
 * `normal`, so that mixed strategies are compared on equal terms.
 */
import {
  applyAction,
  createGame,
  createRng,
  endQuarter,
  opponentFor,
  playTurn,
  playerView,
  rivalProfile,
  type GameState,
  type OpponentStrategy,
} from '../src/index.js';

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
const skilled = process.argv.includes('--skilled');

/** Seat 0's turn with every minigame won. */
async function skilledTurn(g: GameState, strategy: OpponentStrategy, seed: number): Promise<GameState> {
  const ctx = { playerId: 0 as const, profile: rivalProfile(0), random: createRng(seed) };
  for (const a of await strategy.decide(playerView(g, 0), [], ctx)) {
    let r = applyAction(g, 0, a);
    while (r.ok) {
      g = r.state;
      const ch = r.challenge;
      if (!ch) break;
      r = applyAction(g, 0, {
        type: 'minigameResult',
        challengeId: ch.id,
        outcome: ch.kind === 'layout' ? 1.15 : true,
      });
    }
  }
  return g;
}

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
  let g = createGame({
    companyName: 'Sim',
    autoMinigames: !skilled,
    seed: seed0 + i,
    difficulty: rivalsArg === 'hard' ? 'hard' : 'normal',
  });
  const names: Name[] = [0, 1, 2].map((k) => (rivalsArg === 'mixed' ? STRATS[(i + k) % 2]! : rivalsArg));
  const rivals: OpponentStrategy[] = names.map((n) => opponentFor(n));
  const human = seat0 === 'idle' ? null : opponentFor(seat0);
  while (!g.over) {
    if (human && skilled) g = await skilledTurn(g, human, g.seed + g.turn);
    else if (human) g = (await playTurn(g, 0, human)).state;
    g = (await endQuarter(g, rivals)).state;
  }
  const v = playerView(g, 0);
  const worths = v.players.map((p) => (p.out ? 0 : p.worth));
  const best = Math.max(...worths);
  add('seat0:' + seat0 + (skilled ? '+skill' : ''), worths[0]!, worths[0] === best, g.over === 'bankrupt');
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
