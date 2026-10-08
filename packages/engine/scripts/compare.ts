// Paired comparison of the rivals' strategy with a variant:
//   npx tsx scripts/compare.ts <variant> [years] [games] [first seed]
// Per seed one game with three full rivals and one where seat (i % 3) plays the variant; prints the per-seed
// differences of that seat's net worth as JSON (stdout) and a summary (stderr).
import { createGame, endQuarter, playerView, SmartOpponent, SMART_PARAMS, type SmartParams } from '../src/index.js';
const variants: Record<string, SmartParams> = {
  plain: { ...SMART_PARAMS, foresight: false, lateGame: false, valueSurveys: false },
  noForesight: { ...SMART_PARAMS, foresight: false },
  noRepayIdle: { ...SMART_PARAMS, repayIdle: false },
  noSell: { ...SMART_PARAMS, sellStuck: false },
  noContracts: { ...SMART_PARAMS, contracts: false },
  noReserve: { ...SMART_PARAMS, reservations: false },
  noDiversify: { ...SMART_PARAMS, diversify: false },
  noLate: { ...SMART_PARAMS, lateGame: false },
  noValueSurveys: { ...SMART_PARAMS, valueSurveys: false },
};
const name = process.argv[2] ?? 'plain';
const years = Number(process.argv[3] ?? 10);
const N = Number(process.argv[4] ?? 40);
const seed0 = Number(process.argv[5] ?? 700);
const play = async (seed: number, params: SmartParams[]) => {
  let g = createGame({ companyName: 'X', autoMinigames: true, seed, years });
  const opp = params.map((p) => new SmartOpponent(p));
  while (!g.over) g = (await endQuarter(g, opp)).state;
  return playerView(g, 0).players.map((p) => (p.out ? 0 : p.worth));
};
const diffs: number[] = [];
let base = 0;
for (let i = 0; i < N; i++) {
  const k = i % 3;
  const full = await play(seed0 + i, [SMART_PARAMS, SMART_PARAMS, SMART_PARAMS]);
  const mixed = await play(
    seed0 + i,
    [0, 1, 2].map((j) => (j === k ? variants[name]! : SMART_PARAMS)),
  );
  diffs.push(full[k + 1]! - mixed[k + 1]!);
  base += full[k + 1]!;
}
const mean = diffs.reduce((a, b) => a + b, 0) / N;
const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (N - 1));
console.log(JSON.stringify({ name, years, diffs, base }));
console.error(
  `${name} ${years}y: full beats variant by ${(mean / 1e6).toFixed(1)} M€ (±${(sd / Math.sqrt(N) / 1e6).toFixed(1)} M€ s.e.), ${((mean / (base / N)) * 100).toFixed(1)} % of the full seat's worth`,
);
