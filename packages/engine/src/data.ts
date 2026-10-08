/**
 * Data tables ported 1:1 from legacy/src/core.js. Only numbers and identifiers live here;
 * German names and descriptions are in apps/web/src/texts.ts.
 */
import type {
  AwardKey,
  DecisionKey,
  Department,
  DetectiveLevel,
  ExecGrade,
  HqLevel,
  PlantClass,
  PlantSize,
  PlantType,
  RegionKey,
  TrickType,
  WorldEventKey,
} from './types.js';

export interface RegionDef {
  code: string;
  wind?: [number, number];
  sun?: [number, number];
  types: PlantType[];
  grid: number;
  lease: [number, number];
  hydro?: number;
  /** Extra rejection chance of permits in the region (local resistance). */
  reject: number;
}

export const REGION_KEYS: readonly RegionKey[] = ['nd', 'ns', 'ib', 'al'];

export const REGIONS: Record<RegionKey, RegionDef> = {
  nd: {
    code: 'ND',
    wind: [6.2, 8.2],
    sun: [950, 1150],
    types: ['wind', 'solar', 'batt'],
    grid: 300,
    lease: [0.4, 1.6],
    reject: 0.05,
  },
  ns: { code: 'NS', wind: [8.6, 10.4], types: ['off'], grid: 600, lease: [2, 6], reject: 0 },
  ib: {
    code: 'IB',
    wind: [5.2, 7.4],
    sun: [1500, 1850],
    types: ['solar', 'wind', 'batt'],
    grid: 400,
    lease: [0.3, 1.4],
    reject: 0.06,
  },
  al: {
    code: 'AL',
    sun: [1150, 1450],
    types: ['hydro', 'pump', 'solar', 'batt'],
    grid: 300,
    lease: [0.6, 2.2],
    hydro: 0.45,
    reject: 0.05,
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
    // onshore wind was permitted in 2–4 quarters: too slow for a short game against solar (1 quarter)
    permitQ: [1, 3],
    reject: 0.15,
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

export const PLANT_SIZE_KEYS: readonly PlantSize[] = ['std', 'large'];
/**
 * A large plant: more capacity (and storage volume) for a bit less than proportional build costs, but it
 * needs more capital and more grid capacity, and big projects meet more resistance: the permit takes a
 * quarter longer and is rejected more often.
 */
export const LARGE = { mw: 1.5, build: 1.45, permit: 1.5, grid: 1.5, opex: 1.45, permitQ: 1, reject: 0.08 };
/** Repowering a standard plant to large costs the difference of the build costs times this factor. */
export const REPOWER_FACTOR = 1.3;
/** Quarters a plant is offline while it is repowered. */
export const REPOWER_QUARTERS = 1;

/** Plant data for a size (`std` = the table above); the large variants are built once. */
export function plantDef(t: PlantType, size: PlantSize): PlantDef {
  return size === 'std' ? PLANTS[t] : (LARGE_DEFS[t] ??= largeDef(PLANTS[t]));
}
const LARGE_DEFS: Partial<Record<PlantType, PlantDef>> = {};
function largeDef(P: PlantDef): PlantDef {
  return {
    ...P,
    mw: Math.round(P.mw * LARGE.mw),
    mwh: P.mwh ? Math.round(P.mwh * LARGE.mw) : undefined,
    build: Math.round((P.build * LARGE.build) / 1e5) * 1e5,
    permit: Math.round((P.permit * LARGE.permit) / 1e4) * 1e4,
    grid: Math.round((P.grid * LARGE.grid) / 1e4) * 1e4,
    opex: Math.round((P.opex * LARGE.opex) / 1e3) * 1e3,
    permitQ: [P.permitQ[0] + LARGE.permitQ, P.permitQ[1] + LARGE.permitQ],
    reject: P.reject + LARGE.reject,
  };
}

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
/**
 * Solar cannibalisation: many solar parks in one region produce at the same hours and push the price down.
 * The solar capture rate drops by this share per 100 MW of operating solar in the region, scaled with the
 * season's solar output; a storage MW absorbs `SOLAR_STORE_RELIEF` MW of it. The drop is capped.
 */
export const SOLAR_CANNIBAL = 0.04;
export const SOLAR_STORE_RELIEF = 0.5;
export const SOLAR_CANNIBAL_MAX = 0.2;
export const PRICE_SEASON = [1.12, 0.92, 0.9, 1.06];
/** Price model: the target price drifts up per quarter, the base price follows it by this share. */
export const TARGET_DRIFT = 1.0025;
export const PRICE_FOLLOW = 0.15;

export const START_YEAR = 2026;
/** Default game length in years. */
export const GAME_YEARS = 10;
/** Game lengths the player can choose (stored games of 3 years keep their length). */
export const GAME_YEAR_OPTIONS: readonly number[] = [5, 10];
export const HOURS = 2190;
/**
 * Interest per quarter: a base rate, plus a risk premium once more than `INTEREST_FREE_SHARE` of the credit
 * line is used. The premium grows with the square of the used share above it and reaches `INTEREST_RISK` at
 * a full line; it applies to the whole loan.
 */
export const INTEREST = 0.01;
export const INTEREST_RISK = 0.015;
export const INTEREST_FREE_SHARE = 0.5;
export const MAX_CONTRACTS = 3;
export const CO2 = 0.4;
export const START_CASH = 30e6;
/**
 * Storage charged from the market instead of the owner's own plants in the region earns only this share of
 * the spread (grid fees, competing traders).
 */
export const STORE_MARKET_SHARE = 0.5;
export const SITES_PER_REGION = 16;
/**
 * Crowded regions meet more resistance: the rejection chance of a permit grows by this much per 100 MW of
 * approved or built plants (all players) in the region, up to `PERMIT_CROWD_MAX`.
 */
export const PERMIT_CROWD = 0.03;
export const PERMIT_CROWD_MAX = 0.15;
export const MAX_TRICKS = 2;
/** Yield surveys a player may order per quarter. */
export const MAX_SURVEYS = 4;
export const RESERVE_MW = 50;
export const RESERVE_COST = 0.8e6;
export const RESERVE_QUARTERS = 4;
export const SELF_REPAIR_COST = 0.1e6;
export const MIN_CREDIT = 20e6;
/** Credit limit: share of the book value of plants, sites and headquarters (cash does not count). */
export const CREDIT_ASSETS = 0.5;
/** Credit limit: multiple of the average power sales of the last `CREDIT_SALES_QUARTERS` quarters. */
export const CREDIT_SALES = 2;
export const CREDIT_SALES_QUARTERS = 4;
/** Development loan: share of the gap to the leader's net worth, from a gap of `CREDIT_BOOST_FROM` of it. */
export const CREDIT_BOOST = 0.3;
export const CREDIT_BOOST_FROM = 0.1;
export const NEWS_LIMIT = 80;
/** Probability that a failed trick with a fine is discovered (legacy: human 0.4, AI 0.35). */
export const TRICK_CAUGHT = 0.4;
/** Probability that suspicion falls on the actor of a successful trick. */
export const TRICK_SUSPECTED = 0.5;

export interface TrickDef {
  cost: number;
  chance: number;
  /** Paid to the state when the actor is caught. */
  fine: number;
  /** Paid to the victim when the actor is caught (court). */
  damages: number;
}
export const TRICK_KEYS: readonly TrickType[] = ['klage', 'bi', 'hack'];
export const TRICKS: Record<TrickType, TrickDef> = {
  klage: { cost: 0.5e6, chance: 0.7, fine: 0, damages: 0 },
  bi: { cost: 0.4e6, chance: 0.65, fine: 1.5e6, damages: 1e6 },
  hack: { cost: 0.8e6, chance: 0.6, fine: 5e6, damages: 3e6 },
};

/** A spy report on a rival: price and how many quarters it stays valid (the current one included). */
export const SPY_COST = 0.3e6;
export const SPY_QUARTERS = 4;

export interface DetectiveDef {
  /** Price for the whole term. */
  cost: number;
  /** Factor on the success chance of tricks against the client. */
  shield: number;
  /** Chance to catch the actor of a failed trick (instead of `TRICK_CAUGHT`). */
  catchFailed: number;
  /** Chance to catch the actor of a successful trick afterwards. */
  catchSucceeded: number;
  /** Chance to catch a spy (no report then). */
  catchSpy: number;
}
export const DETECTIVE_KEYS: readonly DetectiveLevel[] = ['basic', 'pro'];
/** Quarters a detective agency is hired for (the current one included). */
export const DETECTIVE_QUARTERS = 4;
export const DETECTIVES: Record<DetectiveLevel, DetectiveDef> = {
  basic: { cost: 0.6e6, shield: 0.6, catchFailed: 0.65, catchSucceeded: 0.2, catchSpy: 0.3 },
  pro: { cost: 1.5e6, shield: 0.4, catchFailed: 0.85, catchSucceeded: 0.4, catchSpy: 0.55 },
};

export interface AutoMinigameDef {
  /** Range of the layout efficiency. */
  layout: [number, number];
  /** Success chances. */
  rotor: number;
  cable: number;
  /** A cable duel against a rival is harder than the solo puzzle. */
  cableDuel: number;
  frequency: number;
}
/** Automatic minigame outcomes of the player with `autoMinigames`. */
export const AUTO_MINIGAME: AutoMinigameDef = {
  layout: [0.9, 1.08],
  rotor: 0.8,
  cable: 0.85,
  cableDuel: 0.55,
  frequency: 0.62,
};
/** Rivals play the minigames like a practised player (a good human reaches 1.15 and never fails). */
export const AUTO_MINIGAME_HARD: AutoMinigameDef = {
  layout: [1.0, 1.15],
  rotor: 0.95,
  cable: 0.95,
  cableDuel: 0.7,
  frequency: 0.85,
};

/**
 * Grid connection becomes a duel against a rival of the region when the free capacity is less than this
 * multiple of the plant's capacity.
 */
export const DUEL_SCARCITY = 2;
/** Share of the connection costs refunded when the duel is lost. */
export const DUEL_REFUND = 0.5;
/** Quarters the winning rival keeps the grid capacity it raced for (as a reservation). */
export const DUEL_RESERVE_QUARTERS = 2;
/** Seconds the rival needs per cable piece in the duel minigame. */
export const DUEL_PACE = 0.9;
/** Size of the cable puzzle: columns per region (offshore cables are longer) and rows. */
export const CABLE_COLS: Record<RegionKey, number> = { nd: 6, ns: 7, ib: 6, al: 6 };
export const CABLE_ROWS = 5;
/** Seconds the rival needs for the cable puzzle of region `r`. */
export const duelSeconds = (r: RegionKey): number => Math.round(DUEL_PACE * CABLE_COLS[r] * CABLE_ROWS);
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

export interface WorldEventDef {
  /** Selection weight in winter (Q1, Q4) and summer (Q2, Q3). */
  weight: [number, number];
  /** Factors for this quarter's generation and price, extra storage spread. */
  wind?: number;
  solar?: number;
  hydro?: number;
  price?: number;
  spread?: number;
  /** Lasting factors on the base and target price. */
  base?: number;
  target?: number;
  /** Extra grid capacity in one random region (MW). */
  grid?: number;
}
/** Chance per quarter that a random world event happens. */
export const WORLD_EVENT_CHANCE = 0.32;
export const WORLD_EVENTS: Record<WorldEventKey, WorldEventDef> = {
  darkDoldrums: { weight: [4, 0], wind: 0.6, solar: 0.5, price: 1.4, spread: 40 },
  recordSummer: { weight: [0, 3], solar: 1.15, price: 0.85 },
  lull: { weight: [3, 3], wind: 0.75 },
  stormSeries: { weight: [2, 2], wind: 1.15 },
  gasShock: { weight: [2, 2], base: 1.25, target: 1.12, price: 1.2 },
  gridExpansion: { weight: [3, 3], grid: 150 },
  drought: { weight: [2, 2], hydro: 0.6 },
  industryDip: { weight: [2, 2], base: 0.93, target: 0.9 },
};
/** Chance that an operating offshore park fails in a storm series. */
export const STORM_FAULT = 0.3;

export type HistoricKey = 'ets2' | 'grid2030' | 'hydrogen' | 'coalExit' | 'eu2040';
export interface HistoricDef {
  year: number;
  q: number;
  key: HistoricKey;
  /** Factor on the target price. */
  target?: number;
  /** Extra grid capacity in every region (MW). */
  grid?: number;
  /** Permanent addition to the storage spread. */
  spread?: number;
  /** New factor on PPA offer volumes. */
  ppaBoost?: number;
}
/**
 * Historic milestones, spread evenly over the 40 quarters (every 7 quarters from turn 6) of a 10-year game;
 * shorter games use `historicFor`. Public knowledge: they are political announcements, so strategies may
 * plan with them.
 */
export const HIST: readonly HistoricDef[] = [
  { year: 2027, q: 2, key: 'ets2', target: 1.08 },
  { year: 2029, q: 1, key: 'grid2030', grid: 150 },
  { year: 2031, q: 0, key: 'hydrogen', target: 1.15, ppaBoost: 1.6 },
  { year: 2032, q: 3, key: 'coalExit', target: 1.1, spread: 20 },
  { year: 2034, q: 2, key: 'eu2040', target: 1.06 },
];

/** The milestones of a game from `startYear` to `endYear`: the 10-year schedule squeezed into the game length. */
export function historicFor(startYear: number, endYear: number): HistoricDef[] {
  const quarters = (endYear - startYear) * 4;
  return HIST.map((h) => {
    const turn = Math.round((((h.year - START_YEAR) * 4 + h.q) * quarters) / (GAME_YEARS * 4));
    return { ...h, year: startYear + Math.floor(turn / 4), q: turn % 4 };
  });
}

/* ---------------- Headquarters (phase 8) ---------------- */

export const DEPARTMENT_KEYS: readonly Department[] = ['dev', 'grid', 'trade', 'law'];
export const EXEC_GRADE_KEYS: readonly ExecGrade[] = ['junior', 'senior'];

export interface ExecGradeDef {
  /** Signing fee. */
  fee: number;
  /** Salary per quarter. */
  salary: number;
  /** Strength of the department's effect (multiplies `EXEC_EFFECTS`). */
  power: number;
}
export const EXEC_GRADES: Record<ExecGrade, ExecGradeDef> = {
  junior: { fee: 0.5e6, salary: 0.2e6, power: 1 },
  senior: { fee: 1.5e6, salary: 0.45e6, power: 2 },
};
/**
 * Fee and salaries of board members scale with the game length (in years): a short game leaves less time
 * for them to pay off.
 */
export const EXEC_COST_SCALE: Record<number, number> = { 3: 0.4, 5: 0.65, 10: 1 }; // 3: stored games only
/** Severance when a board member is dismissed, in quarterly salaries. */
export const EXEC_SEVERANCE = 1;

/** Effects of the departments per point of power (a senior has two). */
export const EXEC_EFFECTS = {
  /** Project development: lower rejection chance of permits, extra yield surveys per quarter. */
  dev: { reject: 0.05, surveys: 1 },
  /** Grid & engineering: more time in the cable duel (and a better auto outcome), cheaper repowering. */
  grid: { duelTime: 0.1, duelChance: 0.05, repower: 0.08 },
  /** Trading: better price on new PPA contracts (€/MWh), more of the spread for storage charged from the market. */
  trade: { ppa: 3, storeShare: 0.08 },
  /** Legal & communication: higher court damages (paid by the actor), own tricks are caught less often. */
  law: { damages: 0.25, caught: 0.2 },
} as const;

export interface HqDef {
  /** Price of moving into this headquarters. */
  cost: number;
  /** Running costs per quarter. */
  upkeep: number;
  /** Board seats. */
  seats: number;
}
export const HQ_LEVEL_KEYS: readonly HqLevel[] = [0, 1, 2, 3];
export const HQ_LEVELS: Record<HqLevel, HqDef> = {
  0: { cost: 0, upkeep: 0.05e6, seats: 1 },
  1: { cost: 4e6, upkeep: 0.12e6, seats: 2 },
  2: { cost: 12e6, upkeep: 0.25e6, seats: 3 },
  3: { cost: 30e6, upkeep: 0.5e6, seats: 4 },
};
/** Share of the money paid for the headquarters that counts as book value. */
export const HQ_BOOK = 0.8;

/** Chance per quarter that a player without an open card gets a decision card. */
export const DECISION_CHANCE = 0.35;

export interface DecisionOptionDef {
  key: string;
  /** Needs this headquarters level. */
  minHq: HqLevel;
  default?: true;
}
export interface DecisionDef {
  /** Selection weight among the cards whose condition holds. */
  weight: number;
  options: readonly DecisionOptionDef[];
}
/** Decision cards; their conditions and effects are in `decisions.ts`, the texts in the web app. */
export const DECISIONS: Record<DecisionKey, DecisionDef> = {
  citizens: {
    weight: 3,
    options: [
      { key: 'talk', minHq: 0 },
      { key: 'ignore', minHq: 0, default: true },
      { key: 'report', minHq: 2 },
    ],
  },
  supplier: {
    weight: 2,
    options: [
      { key: 'order', minHq: 0 },
      { key: 'decline', minHq: 0, default: true },
      { key: 'frame', minHq: 3 },
    ],
  },
  heatwave: {
    weight: 2,
    options: [
      { key: 'join', minHq: 0 },
      { key: 'decline', minHq: 0, default: true },
    ],
  },
  grant: {
    weight: 2,
    options: [
      { key: 'apply', minHq: 0 },
      { key: 'skip', minHq: 0, default: true },
      { key: 'lobbyist', minHq: 1 },
    ],
  },
  poach: {
    weight: 2,
    options: [
      { key: 'raise', minHq: 0 },
      { key: 'release', minHq: 0, default: true },
      { key: 'options', minHq: 2 },
    ],
  },
  mayor: {
    weight: 2,
    options: [
      { key: 'lease', minHq: 0 },
      { key: 'decline', minHq: 0, default: true },
    ],
  },
};
/** Numbers of the decision cards. */
export const DECISION_DATA = {
  citizens: { talk: { cost: 0.5e6, reject: 0.1 }, report: { cost: 0.3e6, reject: 0.12 }, delay: 0.35 },
  supplier: { order: { cost: 1e6, pct: 0.1, quarters: 4 }, frame: { cost: 1.5e6, pct: 0.15, quarters: 6 } },
  /** The grid operator pays this share of the full-spread value of the storage capacity. */
  heatwave: { pay: 0.9 },
  grant: { amount: 3e6, apply: { cost: 0.2e6, chance: 0.5 }, lobbyist: { cost: 0.5e6, chance: 0.8 } },
  /** Keeping a poached board member: one-off payment in quarterly salaries. */
  poach: { raise: 2, options: 1 },
  /** The community leases a free site at this share of the lease. */
  mayor: { lease: 0.6 },
} as const;

export interface AwardDef {
  /** Threshold for the award (MW, t CO₂, MWh storage); 0 where the condition is not a number. */
  goal: number;
}
export const AWARD_KEYS: readonly AwardKey[] = ['firstPlant', 'offshore', 'europe', 'mw500', 'co2', 'storage', 'cup'];
export const AWARDS: Record<Exclude<AwardKey, 'cup'>, AwardDef> = {
  firstPlant: { goal: 0 },
  offshore: { goal: 0 },
  europe: { goal: 4 },
  mw500: { goal: 500 },
  co2: { goal: 1e6 },
  storage: { goal: 1000 },
};

/* ---------------- Book values ---------------- */

/**
 * Book value of a plant as a share of its build costs: it drops to `PLANT_BOOK` when built (a used plant
 * cannot be sold at its price), then by `PLANT_DEPRECIATION` per operating quarter, down to `PLANT_BOOK_MIN`.
 */
export const PLANT_BOOK = 0.9;
export const PLANT_DEPRECIATION = 0.01;
export const PLANT_BOOK_MIN = 0.35;

/** Climate bonus at the end of the game: euros per tonne of CO₂ avoided, added to the cash. */
export const CO2_BONUS = 20;
