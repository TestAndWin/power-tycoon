import type { HistoricDef } from './data.js';
import type { Random } from './rng.js';

export type PlayerId = number;
export type RegionKey = 'nd' | 'ns' | 'ib' | 'al';
export type PlantType = 'wind' | 'off' | 'solar' | 'batt' | 'hydro' | 'pump';
export type PlantClass = 'wind' | 'solar' | 'store' | 'hydro';
export type TrickType = 'klage' | 'bi' | 'hack';
/** `std`: the plant as in the data table; `large`: more capacity for more money and grid (see `LARGE`). */
export type PlantSize = 'std' | 'large';
export type DetectiveLevel = 'basic' | 'pro';
export type PermitState = 'pending' | 'approved' | 'rejected' | null;
export type GameOver = false | 'bankrupt' | 'time' | 'monopoly';
export type ChallengeKind = 'layout' | 'rotor' | 'cable' | 'frequency';
/** Board departments: project development, grid & engineering, trading, legal & communication. */
export type Department = 'dev' | 'grid' | 'trade' | 'law';
export type ExecGrade = 'junior' | 'senior';
/** Headquarters level: 0 site container, 1 old town floor, 2 office building, 3 glass tower. */
export type HqLevel = 0 | 1 | 2 | 3;
export type DecisionKey = 'citizens' | 'supplier' | 'heatwave' | 'grant' | 'poach' | 'mayor';
export type AwardKey = 'firstPlant' | 'offshore' | 'europe' | 'mw500' | 'co2' | 'storage' | 'cup';

export interface Site {
  id: string;
  r: RegionKey;
  i: number;
  owner: PlayerId | -1;
  type: PlantType | null;
  permit: PermitState;
  permitLeft: number;
  built: boolean;
  fail: boolean;
  grid: boolean;
  eff: number;
  fault: boolean;
  curtail: number;
  /** Book value parts: paid for building (and repowering), for the permit of the current plant, for the grid. */
  invested: number;
  permitPaid: number;
  gridPaid: number;
  age: number;
  /** Players that ordered a yield survey of this site. */
  surveyed: PlayerId[];
  wind: number | null;
  sun: number | null;
  hydro: boolean;
  lease: number;
  /** Set by a successful lawsuit: the pending permit will be rejected. Hidden from views. */
  killed: boolean;
  /**
   * Application for another plant type while the current permit stays valid. Granted, it replaces the
   * current type and permit; rejected, the current permit stays. Dropped when building starts.
   */
  alt: { type: PlantType; left: number; size: PlantSize } | null;
  /** Plant size. */
  size: PlantSize;
  /** Quarters the plant is still offline (repowering, or a storage lent to the grid operator). */
  offline: number;
  /** Change of the rejection chance of the running permit application (decision cards). */
  rejectMod: number;
}

export interface Offer {
  id: number;
  buyer: string;
  vol: number;
  quarters: number;
  price: number;
  expires: number;
}

export interface Contract {
  id: number;
  buyer: string;
  vol: number;
  quarters: number;
  price: number;
  left: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  human: boolean;
  cash: number;
  loan: number;
  out: boolean;
  hist: (number | null)[];
  genLast: number;
  /** Power sales (contracts, spot, storage) of the last quarters, oldest first (see `CREDIT_SALES_QUARTERS`). */
  sales: number[];
  co2: number;
  contracts: Contract[];
  trickUsed: number;
  /** Yield surveys ordered in the current quarter. */
  surveyUsed: number;
  /** Spy reports: rival id → last turn the report is valid. */
  intel: Record<string, number>;
  /** Hired detective agency, protecting until the end of turn `until`. */
  detectives: { level: DetectiveLevel; until: number } | null;
  /** Board members, at most one per department and `HQ_LEVELS[hq].seats` in total. */
  board: Executive[];
  /** Headquarters level and what was paid for the buildings (book value). */
  hq: HqLevel;
  hqPaid: number;
  /** Open decision card (dealt at the start of a quarter, decided by the default option at its end). */
  decision: DecisionCard | null;
  /** Discount on build costs from a supplier deal, valid until the end of turn `until`. */
  discount: { pct: number; until: number } | null;
  awards: Award[];
}

export interface Executive {
  dept: Department;
  grade: ExecGrade;
  /** Turn of hiring. */
  since: number;
}

export interface DecisionCard {
  key: DecisionKey;
  /** Turn the card was dealt. */
  turn: number;
  /** The site the card is about (citizens: own pending project; mayor: free site on offer). */
  siteId?: string;
  /** The board member a rival wants to poach. */
  dept?: Department;
}

export interface Award {
  key: AwardKey;
  /** Turn the award was won. */
  turn: number;
  /** The first company to reach it gets gold (several in the same quarter all get gold). */
  gold: boolean;
  /** Annual cup: the game year it was won for. */
  year?: number;
}

export interface Reservation {
  pid: PlayerId;
  r: RegionKey;
  mw: number;
  left: number;
}

export interface Fx {
  wind: number;
  solar: number;
  hydro: number;
  price: number;
  spread: number;
}

/** A skill minigame the client has to play (public part). */
export interface Challenge {
  id: number;
  kind: ChallengeKind;
  siteId: string;
  seed: number;
  /** Cable duel: the rival racing for the grid capacity and the seconds it needs for the whole puzzle. */
  rival?: { playerId: PlayerId; seconds: number };
}

export type ChallengeStep = 'build' | 'retry' | 'connect' | 'repair';

export interface OpenChallenge extends Challenge {
  playerId: PlayerId;
  step: ChallengeStep;
}

export interface NewsItem {
  year: number;
  q: number;
  event: GameEvent;
}

export interface GameState {
  v: 1;
  seed: number;
  rng: number;
  year: number;
  q: number;
  startYear: number;
  endYear: number;
  turn: number;
  players: Player[];
  sites: Site[];
  grid: Record<RegionKey, number>;
  res: Reservation[];
  base: number;
  target: number;
  price: number;
  spread: number;
  spreadAdd: number;
  ppaBoost: number;
  fx: Fx | null;
  priceHist: number[];
  spreadHist: number[];
  offers: Offer[];
  news: NewsItem[];
  nextId: number;
  over: GameOver;
  /** `players`: the human acts; `quarterEnd`: `endQuarter` runs and the rivals act, after the human. */
  phase: 'players' | 'quarterEnd';
  settings: { autoMinigames: boolean; difficulty: Difficulty };
  challenge: OpenChallenge | null;
}

/* ---------------- Actions ---------------- */

export type Action =
  | { type: 'survey'; siteId: string }
  | { type: 'lease'; siteId: string }
  | { type: 'applyPermit'; siteId: string; plantType: PlantType; size?: PlantSize }
  | { type: 'changePlantType'; siteId: string }
  | { type: 'build'; siteId: string }
  | { type: 'connectGrid'; siteId: string }
  | { type: 'repower'; siteId: string }
  | { type: 'repairSelf'; siteId: string }
  | { type: 'repairService'; siteId: string }
  | { type: 'sellSite'; siteId: string }
  | { type: 'reserveGrid'; region: RegionKey }
  | { type: 'acceptContract'; offerId: number }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; amount: number | 'all' }
  | { type: 'lobby'; trick: TrickType; siteId: string }
  | { type: 'spy'; targetId: PlayerId }
  | { type: 'hireDetectives'; level: DetectiveLevel }
  | { type: 'hireExecutive'; dept: Department; grade: ExecGrade }
  | { type: 'fireExecutive'; dept: Department }
  | { type: 'upgradeHq' }
  | { type: 'decide'; option: string }
  | { type: 'minigameResult'; challengeId: number; outcome: number | boolean };

export type ActionType = Action['type'];

/** An action that applies to the viewer's current state; `error` is set while it is blocked (e.g. no money). */
export interface ActionOption {
  action: Action;
  /** Price at the moment (0 for free actions). */
  cost: number;
  error: ErrorCode | null;
}

export type ErrorCode =
  | 'gameOver'
  | 'playerOut'
  | 'unknownPlayer'
  | 'challengeOpen'
  | 'noChallenge'
  | 'challengeMismatch'
  | 'invalidOutcome'
  | 'unknownAction'
  | 'unknownSite'
  | 'unknownRegion'
  | 'unknownOffer'
  | 'unknownTrick'
  | 'siteTaken'
  | 'notOwner'
  | 'alreadySurveyed'
  | 'surveyLimit'
  | 'insufficientFunds'
  | 'invalidPlantType'
  | 'invalidState'
  | 'noGridCapacity'
  | 'contractLimit'
  | 'creditLimit'
  | 'invalidAmount'
  | 'trickLimit'
  | 'invalidTarget'
  | 'noSpyReport'
  | 'detectivesActive'
  | 'boardFull'
  | 'noDecision'
  | 'invalidOption'
  | 'hqLocked';

/* ---------------- Events ---------------- */

export type WorldEventKey =
  'darkDoldrums' | 'recordSummer' | 'lull' | 'stormSeries' | 'gasShock' | 'gridExpansion' | 'drought' | 'industryDip';

export type GameEvent =
  | { type: 'gameStarted'; playerId: PlayerId; cash: number }
  | { type: 'siteSurveyed'; playerId: PlayerId; siteId: string; cost: number }
  | { type: 'siteLeased'; playerId: PlayerId; siteId: string; amount: number }
  | {
      type: 'permitApplied';
      playerId: PlayerId;
      siteId: string;
      plantType: PlantType;
      cost: number;
      quarters?: number;
      size?: PlantSize;
    }
  | { type: 'plantTypeCleared'; playerId: PlayerId; siteId: string }
  | { type: 'buildStarted'; playerId: PlayerId; siteId: string; plantType: PlantType; cost: number; retry: boolean }
  | { type: 'layoutRated'; playerId: PlayerId; siteId: string; eff: number }
  | { type: 'assemblyFailed'; playerId: PlayerId; siteId: string }
  | { type: 'plantBuilt'; playerId: PlayerId; siteId: string; plantType: PlantType }
  | { type: 'gridConnected'; playerId: PlayerId; siteId: string; mw: number; cost: number }
  | { type: 'gridConnectFailed'; playerId: PlayerId; siteId: string; cost: number }
  | {
      type: 'gridDuel';
      playerId: PlayerId;
      rivalId: PlayerId;
      siteId: string;
      won: boolean;
      /** Refund to the loser. */
      refund: number;
      /** Capacity the winning rival reserved (0 if it had no project there). */
      reservedMw: number;
    }
  | { type: 'repowered'; playerId: PlayerId; siteId: string; mw: number; cost: number }
  | { type: 'repaired'; playerId: PlayerId; siteId: string; method: 'self' | 'service'; cost: number }
  | { type: 'repairFailed'; playerId: PlayerId; siteId: string }
  | { type: 'siteSold'; playerId: PlayerId; siteId: string; amount: number }
  | { type: 'gridReserved'; playerId: PlayerId; region: RegionKey; mw: number; cost: number }
  | {
      type: 'contractAccepted';
      playerId: PlayerId;
      offerId: number;
      buyer: string;
      vol: number;
      price: number;
      quarters: number;
    }
  | { type: 'contractExpired'; playerId: PlayerId; buyer: string }
  | { type: 'loanTaken'; playerId: PlayerId; amount: number; emergency: boolean }
  | { type: 'loanRepaid'; playerId: PlayerId; amount: number }
  | {
      type: 'trickSucceeded';
      /** null when the viewer may not know who was behind it. */
      actorId: PlayerId | null;
      targetId: PlayerId;
      trick: TrickType;
      siteId: string;
      suspected: boolean;
      /** Detectives of the target caught the actor afterwards (fine and damages paid). */
      caught?: boolean;
      fine?: number;
      damages?: number;
    }
  | {
      type: 'trickFailed';
      /** null when the viewer may not know who was behind it (the target of an undiscovered attempt). */
      actorId: PlayerId | null;
      targetId: PlayerId;
      trick: TrickType;
      siteId: string;
      caught: boolean;
      fine: number;
      /** Paid to the target (court). */
      damages?: number;
      /** The target had a detective agency. */
      defended: boolean;
    }
  | { type: 'spied'; playerId: PlayerId; targetId: PlayerId; cost: number; caught: boolean }
  | { type: 'detectivesHired'; playerId: PlayerId; level: DetectiveLevel; quarters: number; cost: number }
  | { type: 'historicEvent'; key: 'ets2' | 'grid2030' | 'hydrogen' | 'coalExit' | 'eu2040' }
  | { type: 'detectivesExpired'; playerId: PlayerId }
  | { type: 'worldEvent'; key: WorldEventKey; region?: RegionKey }
  | {
      type: 'permitDecided';
      playerId: PlayerId;
      siteId: string;
      plantType: PlantType;
      approved: boolean;
      /** Set when an alternative application was decided: the plant type of the permit it replaces or keeps. */
      previous?: PlantType;
    }
  | { type: 'plantFault'; playerId: PlayerId; siteId: string; cause: 'technical' | 'storm' }
  | { type: 'faultCleared'; playerId: PlayerId; siteId: string }
  | { type: 'executiveHired'; playerId: PlayerId; dept: Department; grade: ExecGrade; cost: number }
  | { type: 'executiveLeft'; playerId: PlayerId; dept: Department; grade: ExecGrade; cost: number; poached: boolean }
  | { type: 'hqUpgraded'; playerId: PlayerId; level: HqLevel; cost: number }
  | { type: 'decisionOffered'; playerId: PlayerId; key: DecisionKey; siteId?: string; dept?: Department }
  | {
      type: 'decisionTaken';
      playerId: PlayerId;
      key: DecisionKey;
      option: string;
      /** The default option applied at the end of the quarter. */
      auto: boolean;
      cost: number;
      siteId?: string;
      dept?: Department;
      /** Money received (grant, grid operator). */
      gain?: number;
      /** Outcome of a gamble: the grant came through, the permit was delayed. */
      success?: boolean;
    }
  | { type: 'awardWon'; playerId: PlayerId; award: AwardKey; gold: boolean; year?: number }
  | { type: 'playerBankrupt'; playerId: PlayerId }
  | { type: 'actionRejected'; playerId: PlayerId; action: string; error: ErrorCode };

export type GameEventType = GameEvent['type'];

/* ---------------- Results ---------------- */

export type ActionResult =
  { ok: true; state: GameState; events: GameEvent[]; challenge: Challenge | null } | { ok: false; error: ErrorCode };

export type ReportLine =
  | { kind: 'ppa'; amount: number; buyer: string; shortfall: number }
  | { kind: 'spot'; amount: number; mwh: number }
  /** `own`: own generation of the region sold later at the full spread; `market`: trading with bought power. */
  | { kind: 'storage'; source: 'own'; amount: number; mwh: number }
  | { kind: 'storage'; source: 'market'; amount: number }
  | { kind: 'opex'; amount: number }
  | { kind: 'lease'; amount: number }
  /** Salaries of the board and upkeep of the headquarters. */
  | { kind: 'board'; amount: number }
  | { kind: 'hq'; amount: number }
  | { kind: 'interest'; amount: number };

export interface QuarterReport {
  /** The quarter this report covers. */
  year: number;
  q: number;
  lines: ReportLine[];
  events: GameEvent[];
  gen: number;
  startCash: number;
  endCash: number;
  price: number;
}

export interface RivalActionLog {
  playerId: PlayerId;
  events: GameEvent[];
}

export interface QuarterResult {
  state: GameState;
  report: QuarterReport;
  rivalActions: RivalActionLog[];
}

/* ---------------- Opponents ---------------- */

export type Difficulty = 'normal' | 'hard';

export interface RivalProfile {
  name: string;
  pref: RegionKey[];
}

export interface OpponentContext {
  playerId: PlayerId;
  profile: RivalProfile;
  /** Seeded random numbers derived from the game RNG (strategies must not use Math.random). */
  random: Random;
}

export interface OpponentStrategy {
  /**
   * Optional first step of a turn: actions that gather information (surveys, spy reports). They are applied
   * before `decide`, whose view then contains their results – like a human who surveys a site and leases
   * it in the same quarter.
   */
  explore?(view: PlayerView, legal: Action[], ctx: OpponentContext): Promise<Action[]>;
  decide(view: PlayerView, legal: Action[], ctx: OpponentContext): Promise<Action[]>;
}

/* ---------------- Player view ---------------- */

export interface SiteView {
  id: string;
  r: RegionKey;
  i: number;
  owner: PlayerId | -1;
  type: PlantType | null;
  permit: PermitState;
  built: boolean;
  fail: boolean;
  grid: boolean;
  fault: boolean;
  curtail: number;
  lease: number;
  surveyCost: number;
  /** Surveyed by the viewing player. */
  surveyed: boolean;
  /** Yield data known to the viewer (own or surveyed). */
  known: boolean;
  wind: number | null;
  sun: number | null;
  hydro: boolean | null;
  /** Plant size and capacity of the planned or built plant (0 without type). */
  size: PlantSize;
  mw: number;
  /** Quarters the plant is offline for repowering. */
  offline: number;
  /** Details of a rival's site from a valid spy report. */
  intel?: { eff: number; permitLeft: number };
  /** Only for the viewer's own sites. */
  own?: {
    permitLeft: number;
    /** Running application for another plant type (see `Site.alt`). */
    alt: { type: PlantType; left: number } | null;
    eff: number;
    invested: number;
    age: number;
    value: number;
    sellValue: number;
    genEstimate: number;
    /** Expected storage revenue per quarter (own and market part). */
    storeRevenue: number;
    /** Expected MWh per quarter the storage takes from own plants in the region. */
    storeOwnMwh: number;
    /** MWh the storage can shift per quarter. */
    storeCapacity: number;
    /** Connecting this built plant now would be a cable duel against a rival. */
    duelRisk: boolean;
  };
}

export interface PlayerSummary {
  id: PlayerId;
  name: string;
  human: boolean;
  cash: number;
  loan: number;
  out: boolean;
  worth: number;
  sites: number;
  mw: number;
  genLast: number;
  co2: number;
  hist: (number | null)[];
  hq: HqLevel;
  awards: Award[];
  /** Valid spy report of the viewer on this player (not for the viewer itself). */
  intel?: {
    board: Executive[];
    /** Last turn the report is valid. */
    until: number;
    contracts: Contract[];
    detectives: { level: DetectiveLevel; left: number } | null;
    tricksLeft: number;
  };
}

export interface DecisionOptionView {
  key: string;
  /** Price now (0 for free options). */
  cost: number;
  /** Money the option brings for sure or if it works out. */
  gain: number;
  /** Chance that a gamble works out (grant), the risk of a delay (citizens' protest), or null. */
  chance: number | null;
  /** Needs a better headquarters (level). */
  minHq: HqLevel;
  /** Applied when the player does not decide. */
  default: boolean;
}

export interface DecisionView {
  key: DecisionKey;
  siteId?: string;
  dept?: Department;
  options: DecisionOptionView[];
}

export interface GridView {
  capacity: number;
  used: number;
  usedBy: Record<string, number>;
  reserved: number;
  myReserved: number;
  /** The viewer's reservations in the region; `left` counts the current quarter (1 = expires at its end). */
  myReservations: { mw: number; left: number }[];
  /** Free capacity for the viewer (own reservations count as free). */
  free: number;
}

export interface PlayerView {
  playerId: PlayerId;
  year: number;
  q: number;
  turn: number;
  startYear: number;
  endYear: number;
  quartersLeft: number;
  over: GameOver;
  settings: { autoMinigames: boolean; difficulty: Difficulty };
  me: {
    id: PlayerId;
    name: string;
    cash: number;
    loan: number;
    worth: number;
    rank: number;
    creditLimit: number;
    /** Parts of the credit limit: share of the assets, of the sales, and the development loan. */
    credit: { assets: number; sales: number; boost: number };
    mw: number;
    co2: number;
    genLast: number;
    contracts: Contract[];
    tricksLeft: number;
    surveysLeft: number;
    /** Surveys per quarter, including the bonus of the development board member. */
    surveyLimit: number;
    /** Expected generation this quarter without weather events. */
    nextGen: number;
    contractVolume: number;
    detectives: { level: DetectiveLevel; left: number } | null;
    board: Executive[];
    hq: HqLevel;
    /** Board seats of the current headquarters. */
    seats: number;
    /** Salaries and headquarters upkeep per quarter. */
    overhead: number;
    discount: { pct: number; left: number } | null;
    decision: DecisionView | null;
    awards: Award[];
    /** Progress towards the awards (compare with `AWARDS[k].goal`; at least 1 for the first two). */
    awardProgress: Record<Exclude<AwardKey, 'cup'>, number>;
  };
  players: PlayerSummary[];
  sites: SiteView[];
  grid: Record<RegionKey, GridView>;
  market: { price: number; spread: number; priceHist: number[]; spreadHist: number[] };
  offers: Offer[];
  costs: Record<PlantType, { build: number; retry: number; permit: number; grid: number; service: number }>;
  /** The same for large plants. */
  costsLarge: Record<PlantType, { build: number; retry: number; permit: number; grid: number; service: number }>;
  tricks: Record<TrickType, { cost: number; chance: number; fine: number; damages: number }>;
  detectives: Record<DetectiveLevel, { cost: number; shield: number; catchFailed: number; catchSucceeded: number }>;
  /** Everything the viewer can do now or is only blocked from by money, capacity or limits. */
  options: ActionOption[];
  constants: {
    maxContracts: number;
    interest: number;
    reserveMw: number;
    reserveCost: number;
    reserveQuarters: number;
    selfRepairCost: number;
    maxTricks: number;
    minCredit: number;
    creditAssets: number;
    creditSales: number;
    creditSalesQuarters: number;
    creditBoost: number;
    creditBoostFrom: number;
    spyCost: number;
    spyQuarters: number;
    detectiveQuarters: number;
  };
  challenge: Challenge | null;
  news: NewsItem[];
  /** Announced historic milestones that have not happened yet, with their effects. */
  milestones: HistoricDef[];
}
