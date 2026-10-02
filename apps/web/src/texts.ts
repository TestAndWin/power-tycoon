/**
 * All German UI texts that depend on game data: names, descriptions, event texts,
 * error messages and report lines. The engine only emits structured events and codes.
 */
import type {
  Difficulty,
  GameEvent,
  PlantType,
  PlayerView,
  RegionKey,
  ReportLine,
  SiteView,
  TrickType,
  WorldEventKey,
} from '@power-tycoon/engine';
import { REGIONS } from '@power-tycoon/engine';
import { esc, eur, money, mwh } from './format.js';

export const REGION_TEXT: Record<RegionKey, { name: string; desc: string }> = {
  nd: {
    name: 'Norddeutschland',
    desc: 'Kräftiger Wind und viel Fläche, aber lange Genehmigungen und streitlustige Bürgerinitiativen.',
  },
  ns: { name: 'Nordsee', desc: 'Offshore-Flächen mit dem stärksten Wind Europas. Nur etwas für große Bilanzen.' },
  ib: { name: 'Iberien', desc: 'Sonne satt: Solarparks liefern hier fast doppelt so viel wie im Norden.' },
  al: { name: 'Alpen', desc: 'Gefälle für Wasserkraft und Pumpspeicher, dazu klare Höhensonne.' },
};

export const PLANT_NAME: Record<PlantType, string> = {
  wind: 'Windpark',
  off: 'Offshore-Windpark',
  solar: 'Solarpark',
  batt: 'Batteriespeicher',
  hydro: 'Laufwasserkraftwerk',
  pump: 'Pumpspeicherwerk',
};
/** Name with indefinite article in the accusative ("einen Windpark"). */
export const plantAcc = (t: PlantType): string => (t === 'hydro' || t === 'pump' ? 'ein ' : 'einen ') + PLANT_NAME[t];

export const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  easy: 'Leicht – wie im Original',
  normal: 'Normal – rechnende Konkurrenz',
  hard: 'Schwer – aggressiv und gut finanziert',
};

export const TRICK_TEXT: Record<TrickType, { name: string; desc: string }> = {
  klage: {
    name: 'Klage gegen Genehmigung',
    desc: 'Anwälte fechten eine Genehmigung an. Das Projekt verzögert sich um zwei Quartale, manchmal kippt es ganz.',
  },
  bi: {
    name: 'Bürgerinitiative anstiften',
    desc: 'Anwohner erzwingen Auflagen: Ein Wind- oder Solarpark läuft zwei Quartale nur mit halber Leistung.',
  },
  hack: {
    name: 'Hackerangriff',
    desc: 'Die Leitwarte eines Kraftwerks fällt aus. Es liefert nichts, bis der Betreiber das Netz stabilisiert.',
  },
};

export const HIST_TEXT: Record<string, string> = {
  ets2: 'Emissionshandel für Gebäude und Verkehr startet. Fossile Energie wird teurer.',
  grid2030: 'Zieljahr 2030: Die Netzbetreiber schalten in allen Regionen 150 MW zusätzliche Kapazität frei.',
  hydrogen: 'Wasserstoff-Boom: Elektrolyseure fragen massenhaft Grünstrom nach.',
  coalExit: 'Das letzte deutsche Kohlekraftwerk geht vom Netz. Flexibilität wird knapp.',
  eu2040: 'Die EU verschärft ihr Klimaziel für 2040. Grünstrom ist gefragter denn je.',
};

export function worldText(key: WorldEventKey, region?: RegionKey): string {
  switch (key) {
    case 'darkDoldrums':
      return 'Dunkelflaute: Kein Wind, keine Sonne. Der Strompreis springt, Speicher verdienen prächtig.';
    case 'recordSummer':
      return 'Rekordsommer: Solarparks laufen am Anschlag, die Mittagspreise fallen ins Minus.';
    case 'lull':
      return 'Wochenlange Flaute: Windparks liefern ein Viertel weniger.';
    case 'stormSeries':
      return 'Orkanserie über der Nordsee: viel Ertrag, aber Schäden an Offshore-Anlagen.';
    case 'gasShock':
      return 'Gaspreisschock: Fossile Kraftwerke werden teuer, der Strompreis zieht an.';
    case 'gridExpansion':
      return `Netzausbau: In ${REGION_TEXT[region ?? 'nd'].name} stehen 150 MW zusätzliche Anschlusskapazität bereit.`;
    case 'drought':
      return 'Trockenheit in den Alpen: Wasserkraft liefert 40 % weniger.';
    case 'industryDip':
      return 'Industrie drosselt die Produktion. Die Stromnachfrage sinkt.';
  }
}

export const SEASON_NAME = ['Winter', 'Frühling', 'Sommer', 'Herbst'];

export const ERROR_TEXT: Record<string, string> = {
  insufficientFunds: 'Nicht genug Geld. Die Bank hilft mit einem Kredit.',
  siteTaken: 'Die Fläche ist bereits vergeben.',
  notOwner: 'Das ist nicht deine Fläche.',
  alreadySurveyed: 'Für diese Fläche liegt schon ein Gutachten vor.',
  invalidPlantType: 'Dieser Anlagentyp ist hier nicht möglich.',
  invalidState: 'Das ist in diesem Projektstand nicht möglich.',
  noGridCapacity: 'Keine freie Netzkapazität.',
  contractLimit: 'Höchstens drei Lieferverträge gleichzeitig.',
  creditLimit: 'Der Kreditrahmen reicht nicht aus.',
  invalidAmount: 'Ungültiger Betrag.',
  trickLimit: 'Mehr als zwei Lobby-Aktionen pro Quartal sind nicht drin.',
  invalidTarget: 'Dieses Ziel kommt gerade nicht infrage.',
  unknownTrick: 'Unbekannte Lobby-Aktion.',
  unknownSite: 'Unbekannte Fläche.',
  unknownRegion: 'Unbekannte Region.',
  unknownOffer: 'Das Angebot ist nicht mehr verfügbar.',
  challengeOpen: 'Erst das laufende Minispiel abschließen.',
  noChallenge: 'Kein Minispiel offen.',
  challengeMismatch: 'Dieses Minispiel ist nicht mehr aktuell.',
  invalidOutcome: 'Ungültiges Minispiel-Ergebnis.',
  gameOver: 'Das Spiel ist beendet.',
  playerOut: 'Dein Konzern ist insolvent.',
  conflict: 'Der Spielstand wurde gerade woanders geändert. Bitte neu laden.',
  unauthorized: 'Kein Zugriff auf diesen Spielstand.',
  notFound: 'Spielstand nicht gefunden.',
  rateLimited: 'Zu viele Anfragen. Bitte kurz warten.',
  badRequest: 'Ungültige Anfrage.',
  network: 'Keine Verbindung zum Server.',
  internalError: 'Serverfehler. Bitte später erneut versuchen.',
};
export const errorText = (code: string): string => ERROR_TEXT[code] ?? 'Unbekannter Fehler (' + code + ').';

/** Stage of a site as the UI shows it (see ui/common.ts `siteStatus`). */
export type SiteStatusCode =
  | 'free'
  | 'leased'
  | 'permitPending'
  | 'rejected'
  | 'assemblyFailed'
  | 'ready'
  | 'noGrid'
  | 'fault'
  | 'curtailed'
  | 'operating';

export function siteStatusText(code: SiteStatusCode, x: SiteView): string {
  switch (code) {
    case 'free':
      return 'Frei';
    case 'leased':
      return 'Gepachtet';
    case 'permitPending':
      return x.own ? 'Genehmigung · ' + Math.max(1, x.own.permitLeft) + ' Q' : 'Genehmigung läuft';
    case 'rejected':
      return 'Abgelehnt';
    case 'assemblyFailed':
      return 'Montage abgebrochen';
    case 'ready':
      return 'Baureif';
    case 'noGrid':
      return 'Netzanschluss fehlt';
    case 'fault':
      return 'Störung!';
    case 'curtailed':
      return 'Auflage −50 %';
    case 'operating':
      return 'In Betrieb';
  }
}

/** What is to do for an own site in this stage ("Handlungsbedarf"). */
export const TODO_TEXT: Partial<Record<SiteStatusCode, string>> = {
  fault: 'Störung beheben',
  leased: 'Genehmigung beantragen',
  rejected: 'Genehmigung abgelehnt',
  ready: 'bauen',
  assemblyFailed: 'Montage wiederholen',
  noGrid: 'ans Netz anschließen',
};

export const siteName = (x: Pick<SiteView, 'r' | 'i'>): string =>
  REGIONS[x.r].code + '-' + String(x.i + 1).padStart(2, '0');

export function siteQuality(x: SiteView): string {
  const p: string[] = [];
  if (x.wind != null) p.push(x.wind.toLocaleString('de-DE') + ' m/s');
  if (x.sun != null) p.push(x.sun + ' kWh');
  if (x.r === 'al') p.push(x.hydro ? 'Gefälle ✓' : 'kein Gefälle');
  return p.join(' · ');
}

export function reportLineText(l: ReportLine): string {
  switch (l.kind) {
    case 'ppa':
      return 'PPA ' + l.buyer + (l.shortfall > 0 ? ' (Fehlmenge ' + mwh(l.shortfall) + ' zugekauft)' : '');
    case 'spot':
      return 'Börsenverkauf (' + mwh(l.mwh) + ')';
    case 'storage':
      return 'Speicher-Arbitrage';
    case 'opex':
      return 'Betrieb & Wartung';
    case 'lease':
      return 'Flächenpacht';
    case 'interest':
      return 'Kreditzinsen';
  }
}

export type TextKind = 'bad' | 'warn' | 'good' | 'info';
export type NewsKind = 'bad' | 'world' | 'sab' | 'comp' | 'info';

/** Context for formatting events from the viewer's perspective. */
interface Ctx {
  view: PlayerView;
}
const nameOf = (c: Ctx, pid: number | null): string => esc(c.view.players[pid ?? -1]?.name ?? '?');
const siteOf = (c: Ctx, id: string): SiteView | undefined => c.view.sites.find((s) => s.id === id);
const sn = (c: Ctx, id: string): string => {
  const x = siteOf(c, id);
  return x ? siteName(x) : id;
};
const regionOfSite = (c: Ctx, id: string): string => REGION_TEXT[siteOf(c, id)?.r ?? 'nd'].name;

function trickText(c: Ctx, e: Extract<GameEvent, { type: 'trickSucceeded' }>): string {
  const x = sn(c, e.siteId);
  const tgt = nameOf(c, e.targetId);
  if (e.trick === 'klage') return `Klage gegen das Projekt ${x} von ${tgt} – Verzögerung um zwei Quartale.`;
  if (e.trick === 'bi') return `Bürgerinitiative gegen ${x} (${tgt}): halbe Leistung für zwei Quartale.`;
  return `Hackerangriff auf die Leitwarte von ${x} (${tgt}). Das Kraftwerk ist vom Netz.`;
}

/** News feed entries (legacy `news()` texts). */
export function newsTexts(view: PlayerView, e: GameEvent): { kind: NewsKind; text: string }[] {
  const c = { view };
  const me = view.playerId;
  switch (e.type) {
    case 'gameStarted':
      // newest first, as in the legacy feed: the tip was added after the welcome
      return [
        {
          kind: 'info',
          text: 'Tipp: Ein Ertragsgutachten vor der Pacht verrät Windgeschwindigkeit oder Sonnenstunden.',
        },
        {
          kind: 'info',
          text: `Willkommen! ${nameOf(c, e.playerId)} startet mit ${money(e.cash)} Eigenkapital. Drei Konkurrenten wollen dieselben Flächen.`,
        },
      ];
    case 'siteLeased':
      return e.playerId === me
        ? [
            {
              kind: 'info',
              text: `Du pachtest ${sn(c, e.siteId)} in ${regionOfSite(c, e.siteId)} für ${money(e.amount)}.`,
            },
          ]
        : [
            {
              kind: 'comp',
              text: `${nameOf(c, e.playerId)} pachtet ${sn(c, e.siteId)} (${regionOfSite(c, e.siteId)}) für ${money(e.amount)}.`,
            },
          ];
    case 'plantBuilt':
      return [{ kind: 'info', text: `${PLANT_NAME[e.plantType]} auf ${sn(c, e.siteId)} fertig gebaut.` }];
    case 'gridConnected':
      return [{ kind: 'info', text: `${sn(c, e.siteId)} speist ins Netz ein.` }];
    case 'siteSold':
      return [{ kind: 'info', text: `Du verkaufst ${sn(c, e.siteId)} für ${money(e.amount)}.` }];
    case 'contractAccepted':
      return [{ kind: 'info', text: `PPA mit ${e.buyer}: ${mwh(e.vol)} je Quartal zu ${eur(e.price)}.` }];
    case 'gridReserved':
      return e.playerId === me
        ? [{ kind: 'info', text: `Du reservierst ${e.mw} MW Netzkapazität in ${REGION_TEXT[e.region].name}.` }]
        : [
            {
              kind: 'comp',
              text: `${nameOf(c, e.playerId)} reserviert ${e.mw} MW Netzkapazität in ${REGION_TEXT[e.region].name}.`,
            },
          ];
    case 'trickSucceeded': {
      const t = trickText(c, e);
      if (e.actorId === me) return [{ kind: 'sab', text: 'Lobby-Erfolg: ' + t }];
      const sus = e.suspected && e.actorId != null ? ` Verdacht fällt auf ${nameOf(c, e.actorId)}.` : '';
      return [{ kind: e.targetId === me ? 'bad' : 'sab', text: t + sus }];
    }
    case 'trickFailed':
      if (!e.caught) return [];
      return e.actorId === me
        ? [{ kind: 'bad', text: `Deine Aktion „${TRICK_TEXT[e.trick].name}“ flog auf. Kosten: ${money(e.fine)}.` }]
        : [
            {
              kind: 'sab',
              text: `${nameOf(c, e.actorId)} fliegt auf: ${TRICK_TEXT[e.trick].name}. Strafe ${money(e.fine)}.`,
            },
          ];
    case 'historicEvent':
      return [{ kind: 'world', text: HIST_TEXT[e.key]! }];
    case 'worldEvent':
      return [{ kind: 'world', text: worldText(e.key, e.region) }];
    case 'playerBankrupt':
      return [
        { kind: 'comp', text: `${nameOf(c, e.playerId)} ist insolvent. Alle Flächen gehen zurück an den Markt.` },
      ];
    default:
      return [];
  }
}

/** Lines in the quarterly report (legacy `rep.events`). */
export function reportEventText(view: PlayerView, e: GameEvent): { kind: TextKind; text: string } | null {
  const c = { view };
  switch (e.type) {
    case 'historicEvent':
      return { kind: 'warn', text: HIST_TEXT[e.key]! };
    case 'worldEvent':
      return { kind: 'warn', text: worldText(e.key, e.region) };
    case 'permitDecided':
      return {
        kind: e.approved ? 'good' : 'bad',
        text: `Genehmigung für ${PLANT_NAME[e.plantType]} auf ${sn(c, e.siteId)}${e.approved ? ' erteilt. Jetzt kann gebaut werden.' : ' abgelehnt.'}`,
      };
    case 'plantFault':
      return e.cause === 'storm'
        ? { kind: 'bad', text: `Sturmschaden an ${sn(c, e.siteId)}.` }
        : { kind: 'bad', text: `Technische Störung an ${sn(c, e.siteId)}. Das Kraftwerk ist vom Netz.` };
    case 'faultCleared':
      return { kind: 'good', text: `Die Störung an ${sn(c, e.siteId)} hat sich von selbst erledigt.` };
    case 'contractExpired':
      return { kind: 'info', text: `Liefervertrag mit ${e.buyer} ist ausgelaufen.` };
    case 'loanTaken':
      return e.emergency
        ? { kind: 'warn', text: `Kasse leer: Die Bank gewährt einen Notkredit über ${money(e.amount)}.` }
        : null;
    case 'playerBankrupt':
      return { kind: 'good', text: `${nameOf(c, e.playerId)} ist insolvent!` };
    case 'trickSucceeded':
    case 'trickFailed': {
      const n = newsTexts(view, e)[0];
      return n ? { kind: 'bad', text: n.text } : null;
    }
    default:
      return null;
  }
}

/** Rival action log in the report (legacy `clog()`), without the leading company name. */
export function rivalActionText(view: PlayerView, e: GameEvent): string | null {
  const c = { view };
  switch (e.type) {
    case 'siteLeased':
      return `pachtet ${sn(c, e.siteId)} in ${regionOfSite(c, e.siteId)} für ${money(e.amount, true)}`;
    case 'permitApplied':
      return `beantragt ${plantAcc(e.plantType)} auf ${sn(c, e.siteId)}`;
    case 'plantTypeCleared':
      return `plant ${sn(c, e.siteId)} neu`;
    case 'buildStarted':
      return e.retry
        ? `wiederholt die Montage auf ${sn(c, e.siteId)}`
        : `baut ${plantAcc(e.plantType)} auf ${sn(c, e.siteId)} (${money(e.cost, true)})`;
    case 'assemblyFailed':
      return `scheitert bei der Montage auf ${sn(c, e.siteId)}`;
    case 'gridConnected':
      return `bringt ${sn(c, e.siteId)} mit ${e.mw} MW ans Netz`;
    case 'gridConnectFailed':
      return `scheitert beim Netzanschluss von ${sn(c, e.siteId)}`;
    case 'repaired':
      return `repariert die Störung an ${sn(c, e.siteId)}`;
    case 'siteSold':
      return `verkauft ${sn(c, e.siteId)}`;
    case 'gridReserved':
      return `reserviert ${e.mw} MW Netz in ${REGION_TEXT[e.region].name}`;
    case 'contractAccepted':
      return `schließt einen Liefervertrag mit ${e.buyer}`;
    case 'trickSucceeded':
    case 'trickFailed': {
      const n = newsTexts(view, e)[0];
      return n ? n.text : null;
    }
    default:
      return null;
  }
}
