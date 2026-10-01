/**
 * Data tables ported 1:1 from legacy/src/core.js. Only numbers and identifiers live here;
 * German names and descriptions are in apps/web/src/texts.ts.
 */
import type { PlantClass, PlantType, RegionKey, TrickType } from './types.js';

export interface RegionDef {
  code: string;
  wind?: [number, number];
  sun?: [number, number];
  types: PlantType[];
  grid: number;
  lease: [number, number];
  hydro?: number;
}

export const REGION_KEYS: readonly RegionKey[] = ['nd', 'ns', 'ib', 'al'];

export const REGIONS: Record<RegionKey, RegionDef> = {
  nd: {
    code: 'ND',
    wind: [5.8, 7.8],
    sun: [950, 1150],
    types: ['wind', 'solar', 'batt'],
    grid: 300,
    lease: [0.4, 1.6],
  },
  ns: { code: 'NS', wind: [8.6, 10.4], types: ['off'], grid: 600, lease: [2, 6] },
  ib: {
    code: 'IB',
    wind: [5.2, 7.4],
    sun: [1550, 1950],
    types: ['solar', 'wind', 'batt'],
    grid: 400,
    lease: [0.3, 1.4],
  },
  al: {
    code: 'AL',
    sun: [1150, 1450],
    types: ['hydro', 'pump', 'solar', 'batt'],
    grid: 300,
    lease: [0.6, 2.2],
    hydro: 0.45,
  },
};

export interface PlantDef {
  mw: number;
  mwh?: number;
  cycles?: number;
  eta?: number;
  build: number;
  permit: number;
  grid: number;
  opex: number;
  permitQ: [number, number];
  reject: number;
  learn: number;
  cls: PlantClass;
}

export const PLANT_TYPE_KEYS: readonly PlantType[] = ['wind', 'off', 'solar', 'batt', 'hydro', 'pump'];

export const PLANTS: Record<PlantType, PlantDef> = {
  wind: {
    mw: 24,
    build: 20e6,
    permit: 0.3e6,
    grid: 1.2e6,
    opex: 0.12e6,
    permitQ: [2, 4],
    reject: 0.2,
    learn: 0.015,
    cls: 'wind',
  },
  off: {
    mw: 80,
    build: 110e6,
    permit: 1.2e6,
    grid: 8e6,
    opex: 0.7e6,
    permitQ: [2, 4],
    reject: 0.1,
    learn: 0.02,
    cls: 'wind',
  },
  solar: {
    mw: 30,
    build: 15e6,
    permit: 0.15e6,
    grid: 0.8e6,
    opex: 0.06e6,
    permitQ: [1, 1],
    reject: 0.05,
    learn: 0.04,
    cls: 'solar',
  },
  batt: {
    mw: 50,
    mwh: 100,
    cycles: 150,
    eta: 0.85,
    build: 24e6,
    permit: 0.1e6,
    grid: 0.6e6,
    opex: 0.08e6,
    permitQ: [1, 1],
    reject: 0.03,
    learn: 0.07,
    cls: 'store',
  },
  hydro: {
    mw: 12,
    build: 18e6,
    permit: 0.4e6,
    grid: 0.5e6,
    opex: 0.1e6,
    permitQ: [3, 5],
    reject: 0.25,
    learn: 0,
    cls: 'hydro',
  },
  pump: {
    mw: 120,
    mwh: 800,
    cycles: 80,
    eta: 0.75,
    build: 60e6,
    permit: 0.8e6,
    grid: 1.5e6,
    opex: 0.3e6,
    permitQ: [3, 5],
    reject: 0.25,
    learn: 0,
    cls: 'store',
  },
};

/** Seasonal generation factors per quarter (Q1..Q4). */
export const SEASON: Record<'wind' | 'solar' | 'hydro', [number, number, number, number]> = {
  wind: [1.3, 0.85, 0.7, 1.15],
  solar: [0.55, 1.35, 1.45, 0.65],
  hydro: [0.8, 1.3, 1.1, 0.8],
};
/** Capture rate: share of the average price a technology earns per quarter. */
export const CAPTURE: Record<'wind' | 'solar' | 'hydro', [number, number, number, number]> = {
  wind: [0.92, 0.9, 0.9, 0.92],
  solar: [0.95, 0.8, 0.78, 0.95],
  hydro: [1, 1, 1, 1],
};
export const PRICE_SEASON = [1.12, 0.92, 0.9, 1.06];

export const START_YEAR = 2026;
export const GAME_YEARS = 10;
export const HOURS = 2190;
export const INTEREST = 0.012;
export const MAX_CONTRACTS = 3;
export const CO2 = 0.4;
export const START_CASH = 30e6;
export const SITES_PER_REGION = 16;
export const MAX_TRICKS = 2;
export const RESERVE_MW = 50;
export const RESERVE_COST = 0.8e6;
export const RESERVE_QUARTERS = 4;
export const SELF_REPAIR_COST = 0.1e6;
export const MIN_CREDIT = 20e6;
export const NEWS_LIMIT = 80;
/** Probability that a failed trick with a fine is discovered (legacy: human 0.4, AI 0.35). */
export const TRICK_CAUGHT = 0.4;
/** Probability that suspicion falls on the actor of a successful trick. */
export const TRICK_SUSPECTED = 0.5;

export interface TrickDef {
  cost: number;
  chance: number;
  fine: number;
}
export const TRICK_KEYS: readonly TrickType[] = ['klage', 'bi', 'hack'];
export const TRICKS: Record<TrickType, TrickDef> = {
  klage: { cost: 0.5e6, chance: 0.7, fine: 0 },
  bi: { cost: 0.4e6, chance: 0.65, fine: 1.5e6 },
  hack: { cost: 0.8e6, chance: 0.6, fine: 5e6 },
};

/** Automatic minigame outcomes (rivals always, the player with `autoMinigames`). */
export const AUTO_MINIGAME = { layout: [0.9, 1.08] as [number, number], rotor: 0.8, cable: 0.85, frequency: 0.62 };
/** Allowed range for a client-reported layout efficiency. */
export const LAYOUT_RANGE: [number, number] = [0.8, 1.15];

export const BUYERS: readonly string[] = [
  'Stahlwerk Qualmstedt',
  'Rechenzentrum Byteburg',
  'Chemiepark Rührbach',
  'Bahnstrom Schienenhausen',
  'Aluhütte Blechingen',
  'Elektrolyse Blubberhafen',
  'Glaswerk Scherbenau',
  'Kühlhaus Frosthagen',
  'Papierfabrik Knitterfeld',
  'Batteriewerk Akkuwitz',
];

export interface RivalDef {
  name: string;
  pref: RegionKey[];
}
export const AI_DEF: readonly RivalDef[] = [
  { name: 'Möwenkraft AG', pref: ['nd', 'nd', 'ns', 'ns', 'ib'] },
  { name: 'Siestasol S.A.', pref: ['ib', 'ib', 'ib', 'al', 'nd'] },
  { name: 'Gletscherwerk Holding', pref: ['al', 'al', 'nd', 'ib', 'ns'] },
];

export type HistoricKey = 'ets2' | 'grid2030' | 'hydrogen' | 'coalExit' | 'eu2040';
export const HIST: readonly { year: number; q: number; key: HistoricKey }[] = [
  { year: 2028, q: 0, key: 'ets2' },
  { year: 2030, q: 0, key: 'grid2030' },
  { year: 2031, q: 2, key: 'hydrogen' },
  { year: 2033, q: 0, key: 'coalExit' },
  { year: 2035, q: 0, key: 'eu2040' },
];
