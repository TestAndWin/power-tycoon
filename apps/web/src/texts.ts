/**
 * All German UI texts that depend on game data: names, descriptions, event texts,
 * error messages and report lines. The engine only emits structured events and codes.
 */
import type {
  AwardKey,
  DecisionKey,
  DecisionView,
  Department,
  DetectiveLevel,
  ExecGrade,
  GameEvent,
  HistoricDef,
  HistoricKey,
  HqLevel,
  PlantSize,
  PlantType,
  PlayerView,
  RegionKey,
  ReportLine,
  SiteView,
  TrickType,
  WorldEventKey,
} from '@power-tycoon/engine';
import { DECISION_DATA, EXEC_EFFECTS, isConfrontation, REGIONS } from '@power-tycoon/engine';
import { esc, eur, money, mwh, pct, tons } from './format.js';

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
/** Name with indefinite article in the accusative ("einen Windpark", "einen großen Windpark"). */
export function plantAcc(t: PlantType, size?: PlantSize): string {
  const neuter = t === 'hydro' || t === 'pump';
  const large = size === 'large' ? (neuter ? 'großes ' : 'großen ') : '';
  return (neuter ? 'ein ' : 'einen ') + large + PLANT_NAME[t];
}

export const SIZE_NAME: Record<PlantSize, string> = { std: 'Standard', large: 'Groß' };
/** " · groß" after a plant name for large plants. */
export const sizeSuffix = (size: PlantSize): string => (size === 'large' ? ' · groß' : '');

/** A rival's detective agency from a spy report. */
export const detectivesText = (d: { level: DetectiveLevel; left: number } | null): string =>
  d ? `${DETECTIVE_TEXT[d.level].name}, noch ${d.left} Q` : 'keine Detektive';

export const GAME_LENGTH_TEXT: Record<number, string> = {
  3: 'Kurz – 3 Jahre (12 Quartale)',
  5: 'Mittel – 5 Jahre (20 Quartale)',
  10: 'Lang – 10 Jahre (40 Quartale)',
};

/** Shown before a grid connection that will turn into a cable duel. */
export const DUEL_HINT =
  'Die Kapazität ist knapp: Der Anschluss wird zum Kabel-Duell gegen einen Konkurrenten, der in der Region selbst auf seinen Anschluss wartet. Wer schneller verkabelt, bekommt das Netz.';

export const DETECTIVE_TEXT: Record<DetectiveLevel, { name: string; desc: string }> = {
  basic: {
    name: 'Detektei Spürnase',
    desc: 'Zwei Ermittler beobachten deine Anlagen. Tricks gegen dich gelingen seltener, Täter fliegen öfter auf.',
  },
  pro: {
    name: 'Sicherheitsfirma Argus',
    desc: 'Rund um die Uhr, mit Kameras und IT-Forensik. Deutlich besserer Schutz – auch gegen Spione.',
  },
};

/** Faces of the rival companies (player ids 1–3). All persons are fictitious. */
export const RIVAL_TEXT: Record<number, { ceo: string; role: string; motto: string; style: string }> = {
  1: {
    ceo: 'Hinnerk Ostendorp',
    role: 'Vorstandschef, Hamburg',
    motto: 'Wo Wind weht, sind wir schon da.',
    style: 'Setzt auf Wind an Land und auf See. Baut beharrlich und scheut große Offshore-Kredite nicht.',
  },
  2: {
    ceo: 'Inés Valcárcel',
    role: 'Consejera Delegada, Sevilla',
    motto: 'El sol no espera.',
    style: 'Sichert sich Iberiens Sonnenflächen schnell und billig – wer zögert, geht leer aus.',
  },
  3: {
    ceo: 'Dr. Ueli Brunner',
    role: 'Verwaltungsratspräsident, Zug',
    motto: 'Geduld ist auch eine Energiequelle.',
    style: 'Wasserkraft und Speicher in den Alpen. Rechnet lange, schlägt dann mit voller Bilanz zu.',
  },
};

/** How a rival stands against the player. */
export const STANDING_TEXT = {
  leads: 'Zieht davon',
  ahead: 'Knapp vor dir',
  close: 'Sitzt dir im Nacken',
  behind: 'Liegt zurück',
  out: 'Insolvent',
} as const;

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

export const MILESTONE_NAME: Record<HistoricKey, string> = {
  ets2: 'Emissionshandel 2',
  grid2030: 'Netzausbau 2030',
  hydrogen: 'Wasserstoff-Boom',
  coalExit: 'Kohleausstieg',
  eu2040: 'EU-Klimaziel 2040',
};

/** Effects of an announced milestone, built from its data. */
export function milestoneEffects(h: HistoricDef): string[] {
  const out: string[] = [];
  if (h.target) out.push(`Strompreis steigt langfristig um ${Math.round((h.target - 1) * 100)} %`);
  if (h.grid) out.push(`+${h.grid} MW Netzkapazität in jeder Region`);
  if (h.spread) out.push(`Speicher-Spread +${h.spread} €/MWh`);
  if (h.ppaBoost) out.push(`Abnahmeverträge mit ${h.ppaBoost.toLocaleString('de-DE')}-fachem Volumen`);
  return out;
}

export const HIST_TEXT: Record<string, string> = {
  ets2: 'Emissionshandel für Gebäude und Verkehr startet. Fossile Energie wird teurer.',
  grid2030:
    'Netzausbau für das Zieljahr 2030: Die Netzbetreiber schalten in allen Regionen 150 MW zusätzliche Kapazität frei.',
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
  surveyLimit: 'Mehr als vier Ertragsgutachten pro Quartal schaffen die Gutachter nicht.',
  invalidPlantType: 'Dieser Anlagentyp ist hier nicht möglich.',
  invalidState: 'Das ist in diesem Projektstand nicht möglich.',
  noGridCapacity: 'Keine freie Netzkapazität.',
  contractLimit: 'Höchstens drei Lieferverträge gleichzeitig.',
  creditLimit: 'Der Kreditrahmen reicht nicht aus.',
  invalidAmount: 'Ungültiger Betrag.',
  trickLimit: 'Mehr als zwei Lobby-Aktionen pro Quartal sind nicht drin.',
  invalidTarget: 'Dieses Ziel kommt gerade nicht infrage.',
  noSpyReport: 'Erst einen Spion schicken: Ohne Spionagebericht über den Konzern kein Auftrag.',
  detectivesActive: 'Du hast schon eine Detektei unter Vertrag.',
  boardFull: 'Kein freier Platz im Vorstand. Ein größerer Firmensitz bietet mehr Plätze.',
  noDecision: 'Gerade liegt keine Entscheidung auf dem Tisch.',
  invalidOption: 'Diese Option gibt es nicht.',
  hqLocked: 'Diese Option gibt es erst mit einem größeren Firmensitz.',
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
  | 'repowering'
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
    case 'repowering':
      // repowering, or a storage lent to the grid operator (heat wave)
      return 'Außer Betrieb · ' + x.offline + ' Q';
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
      return l.source === 'own'
        ? 'Speicher: eigenen Strom später verkauft (' + mwh(l.mwh) + ')'
        : 'Speicher: Handel mit Börsenstrom';
    case 'opex':
      return 'Betrieb & Wartung';
    case 'lease':
      return 'Flächenpacht';
    case 'board':
      return 'Gehälter Vorstand';
    case 'hq':
      return 'Unterhalt Firmensitz';
    case 'interest':
      return l.rate ? `Kreditzinsen (${pct(l.rate, 2)} im Quartal)` : 'Kreditzinsen';
  }
}

export type TextKind = 'bad' | 'warn' | 'good' | 'info';
export type NewsKind = 'bad' | 'good' | 'world' | 'sab' | 'comp' | 'info';

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
  if (e.trick === 'klage')
    return `Klage gegen das Projekt ${x} von ${tgt}: Die Behörde prüft die Genehmigung erneut – mindestens zwei Quartale Verzögerung.`;
  if (e.trick === 'bi') return `Bürgerinitiative gegen ${x} (${tgt}): halbe Leistung für zwei Quartale.`;
  return `Hackerangriff auf die Leitwarte von ${x} (${tgt}). Das Kraftwerk ist vom Netz.`;
}

/** An undiscovered attempt on the viewer's own site that failed (with or without detectives). */
function fendedOffText(c: Ctx, e: Extract<GameEvent, { type: 'trickFailed' }>): string {
  const x = sn(c, e.siteId);
  const unknown = ' Wer dahintersteckt, bleibt unklar.';
  if (e.trick === 'klage')
    return (
      (e.defended ? `Deine Detektei wehrt eine Klage gegen ${x} ab.` : `Eine Klage gegen ${x} wird abgewiesen.`) +
      unknown
    );
  if (e.trick === 'bi')
    return (
      (e.defended
        ? `Deine Detektei deckt eine bestellte Bürgerinitiative gegen ${x} auf.`
        : `Eine Bürgerinitiative gegen ${x} findet keine Unterstützer.`) + unknown
    );
  return (
    (e.defended
      ? `Deine Detektei wehrt einen Hackerangriff auf ${x} ab.`
      : `Ein Hackerangriff auf ${x} läuft ins Leere.`) + unknown
  );
}

/** Court verdict after a caught culprit: fine and damages. */
const courtText = (c: Ctx, actor: number | null, fine: number, damages: number | undefined, me: number): string =>
  damages
    ? actor === me
      ? ` Strafe ${money(fine)}, dazu ${money(damages)} Schadensersatz.`
      : ` Das Gericht verurteilt ${nameOf(c, actor)}: ${money(fine)} Strafe und ${money(damages)} Schadensersatz.`
    : ` Strafe ${money(fine)}.`;

/** One-line description of a cable duel from the viewer's perspective. */
function duelText(c: Ctx, e: Extract<GameEvent, { type: 'gridDuel' }>, me: number): string {
  const x = sn(c, e.siteId),
    region = regionOfSite(c, e.siteId);
  const grab = e.reservedMw ? ` und sichert sich ${e.reservedMw} MW` : '';
  if (e.playerId === me)
    return e.won
      ? `Kabel-Duell um ${region} gewonnen: ${x} ist am Netz, ${nameOf(c, e.rivalId)} hat das Nachsehen.`
      : `Kabel-Duell um ${region} verloren: ${nameOf(c, e.rivalId)} war schneller${grab}. ${money(e.refund)} der Anschlusskosten kommen zurück.`;
  if (e.rivalId === me)
    return e.won
      ? `${nameOf(c, e.playerId)} gewinnt das Kabel-Duell um ${region} gegen dich.`
      : `Du gewinnst das Kabel-Duell um ${region} gegen ${nameOf(c, e.playerId)}${e.reservedMw ? ` und bekommst ${e.reservedMw} MW reserviert` : ''}.`;
  return e.won
    ? `${nameOf(c, e.playerId)} gewinnt ein Kabel-Duell um ${region} gegen ${nameOf(c, e.rivalId)}.`
    : `${nameOf(c, e.rivalId)} gewinnt ein Kabel-Duell um ${region} gegen ${nameOf(c, e.playerId)}${grab}.`;
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
      if (e.caught) {
        const court = courtText(c, e.actorId, e.fine ?? 0, e.damages, me);
        if (e.actorId === me)
          return [{ kind: 'bad', text: `Lobby-Erfolg, aber die Detektive haben dich erwischt: ${t}${court}` }];
        return [
          {
            kind: e.targetId === me ? 'bad' : 'sab',
            text: `${t} Detektive überführen ${nameOf(c, e.actorId)}.${court}`,
          },
        ];
      }
      if (e.actorId === me) return [{ kind: 'sab', text: 'Lobby-Erfolg: ' + t }];
      const sus = e.suspected && e.actorId != null ? ` Verdacht fällt auf ${nameOf(c, e.actorId)}.` : '';
      return [{ kind: e.targetId === me ? 'bad' : 'sab', text: t + sus }];
    }
    case 'trickFailed': {
      if (!e.caught) return e.targetId === me ? [{ kind: 'good', text: fendedOffText(c, e) }] : [];
      const court = courtText(c, e.actorId, e.fine, e.damages, me);
      return e.actorId === me
        ? [{ kind: 'bad', text: `Deine Aktion „${TRICK_TEXT[e.trick].name}“ flog auf.${court}` }]
        : [{ kind: 'sab', text: `${nameOf(c, e.actorId)} fliegt auf: ${TRICK_TEXT[e.trick].name}.${court}` }];
    }
    case 'spied':
      if (e.playerId === me)
        return e.caught
          ? [{ kind: 'bad', text: `Dein Spion bei ${nameOf(c, e.targetId)} ist aufgeflogen. Kein Bericht.` }]
          : [{ kind: 'sab', text: `Spionagebericht über ${nameOf(c, e.targetId)} liegt vor.` }];
      if (!e.caught) return [];
      return [
        {
          kind: e.targetId === me ? 'info' : 'sab',
          text:
            e.targetId === me
              ? `Deine Detektive haben einen Spion von ${nameOf(c, e.playerId)} gestellt.`
              : `Spion von ${nameOf(c, e.playerId)} bei ${nameOf(c, e.targetId)} enttarnt.`,
        },
      ];
    case 'gridDuel':
      return [{ kind: e.playerId === me || e.rivalId === me ? 'info' : 'comp', text: duelText(c, e, me) }];
    case 'repowered':
      return [{ kind: 'info', text: `Repowering auf ${sn(c, e.siteId)}: künftig ${e.mw} MW.` }];
    case 'historicEvent':
      return [{ kind: 'world', text: HIST_TEXT[e.key]! }];
    case 'worldEvent':
      return [{ kind: 'world', text: worldText(e.key, e.region) }];
    case 'playerBankrupt':
      return [
        { kind: 'comp', text: `${nameOf(c, e.playerId)} ist insolvent. Alle Flächen gehen zurück an den Markt.` },
      ];
    case 'hqUpgraded':
      return e.playerId === me
        ? [{ kind: 'good', text: `Umzug geschafft: Dein Konzern sitzt jetzt ${HQ_TEXT[e.level].at}.` }]
        : [{ kind: 'comp', text: `${nameOf(c, e.playerId)} zieht um: neuer Firmensitz ${HQ_TEXT[e.level].at}.` }];
    case 'executiveHired':
      return [
        {
          kind: 'info',
          text: `${execName(e.dept, e.grade)} verstärkt deinen Vorstand (${DEPT_TEXT[e.dept].name}).`,
        },
      ];
    case 'executiveLeft':
      return [
        { kind: 'bad', text: `${execName(e.dept, e.grade)} wechselt zur Konkurrenz. Der Platz im Vorstand ist frei.` },
      ];
    case 'awardWon':
      return [{ kind: e.playerId === me ? 'good' : 'comp', text: awardNews(c, e) }];
    case 'climateBonus':
      return [{ kind: e.playerId === me ? 'good' : 'comp', text: climateText(c, e) }];
    default:
      return [];
  }
}

function climateText(c: Ctx, e: Extract<GameEvent, { type: 'climateBonus' }>): string {
  const who = e.playerId === c.view.playerId ? 'Dein Konzern' : nameOf(c, e.playerId);
  return `Klimabonus: ${who} erhält ${money(e.amount)} für ${tons(e.co2)} vermiedenes CO₂.`;
}

function awardNews(c: Ctx, e: Extract<GameEvent, { type: 'awardWon' }>): string {
  const who = e.playerId === c.view.playerId ? 'Dein Konzern' : nameOf(c, e.playerId);
  if (e.award === 'cup') return `Jahrespokal ${e.year}: ${who} hat das Vermögen im Jahr am stärksten gesteigert.`;
  return `Auszeichnung „${AWARD_TEXT[e.award].name}“ ${e.gold ? 'in Gold' : 'in Silber'} für ${who}: ${AWARD_TEXT[e.award].cond}.`;
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
        text: `Genehmigung für ${PLANT_NAME[e.plantType]} auf ${sn(c, e.siteId)}${
          e.approved
            ? e.previous
              ? ` erteilt. Sie ersetzt die Genehmigung für ${PLANT_NAME[e.previous]}.`
              : ' erteilt. Jetzt kann gebaut werden.'
            : e.previous
              ? ` abgelehnt. Die Genehmigung für ${PLANT_NAME[e.previous]} bleibt bestehen.`
              : ' abgelehnt.'
        }`,
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
    case 'detectivesExpired':
      return { kind: 'warn', text: 'Der Vertrag mit deiner Detektei ist ausgelaufen.' };
    case 'spied': {
      const n = newsTexts(view, e)[0];
      return n ? { kind: 'good', text: n.text } : null;
    }
    case 'gridDuel': {
      const n = newsTexts(view, e)[0];
      const lost = (e.playerId === view.playerId) !== e.won;
      return n ? { kind: lost ? 'bad' : 'good', text: n.text } : null;
    }
    case 'playerBankrupt':
      return { kind: 'good', text: `${nameOf(c, e.playerId)} ist insolvent!` };
    case 'awardWon':
      return e.playerId === view.playerId
        ? { kind: 'good', text: awardNews(c, e) }
        : { kind: 'info', text: awardNews(c, e) };
    case 'climateBonus':
      return { kind: 'good', text: climateText(c, e) };
    case 'executiveLeft':
      return e.poached ? { kind: 'bad', text: newsTexts(view, e)[0]!.text } : null;
    case 'decisionTaken':
      return e.auto ? { kind: 'warn', text: decisionResultText(view, e) } : null;
    case 'decisionOffered':
      return { kind: 'info', text: `Dein Handy klingelt: ${DECISION_TEXT[e.key].kicker}.` };
    case 'trickSucceeded':
    case 'trickFailed': {
      const n = newsTexts(view, e)[0];
      // a culprit of a trick on the viewer caught by the detectives: good news if the trick failed, mixed
      // news (plant hit, but damages paid) if it succeeded
      const caughtOnMe = !!e.caught && e.targetId === view.playerId;
      const fendedOff = e.type === 'trickFailed' && e.targetId === view.playerId;
      const kind: TextKind = caughtOnMe ? (e.type === 'trickFailed' ? 'good' : 'warn') : fendedOff ? 'good' : 'bad';
      return n ? { kind, text: n.text } : null;
    }
    default:
      return null;
  }
}

/** Rival action log in the report (legacy `clog()`), without the leading company name. */
export function rivalActionText(view: PlayerView, e: GameEvent): string | null {
  const c = { view };
  // confrontations are complete sentences from the news feed
  if (isConfrontation(e)) return newsTexts(view, e)[0]?.text ?? null;
  switch (e.type) {
    case 'siteLeased':
      return `pachtet ${sn(c, e.siteId)} in ${regionOfSite(c, e.siteId)} für ${money(e.amount, true)}`;
    case 'permitApplied':
      return `beantragt ${plantAcc(e.plantType, e.size)} auf ${sn(c, e.siteId)}`;
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
    case 'repowered':
      return `rüstet ${sn(c, e.siteId)} auf ${e.mw} MW auf (Repowering)`;
    case 'siteSold':
      return `verkauft ${sn(c, e.siteId)}`;
    case 'gridReserved':
      return `reserviert ${e.mw} MW Netz in ${REGION_TEXT[e.region].name}`;
    case 'contractAccepted':
      return `schließt einen Liefervertrag mit ${e.buyer}`;
    case 'hqUpgraded':
      return `zieht um: ${HQ_TEXT[e.level].name}`;
    default:
      return null;
  }
}

/* ---------------- Headquarters (phase 8) ---------------- */

export const DEPT_TEXT: Record<Department, { name: string; short: string; effect: (power: number) => string }> = {
  dev: {
    name: 'Projektentwicklung',
    short: 'Projekte',
    effect: (n) =>
      `Genehmigungen werden ${Math.round(EXEC_EFFECTS.dev.reject * n * 100)} Prozentpunkte seltener abgelehnt, ${EXEC_EFFECTS.dev.surveys * n} Ertragsgutachten mehr pro Quartal.`,
  },
  grid: {
    name: 'Netz & Technik',
    short: 'Netz',
    effect: (n) =>
      `${Math.round(EXEC_EFFECTS.grid.duelTime * n * 100)} % mehr Zeit im Kabel-Duell, Repowering ${Math.round(EXEC_EFFECTS.grid.repower * n * 100)} % günstiger.`,
  },
  trade: {
    name: 'Handel',
    short: 'Handel',
    effect: (n) =>
      `Neue Lieferverträge ${EXEC_EFFECTS.trade.ppa * n} €/MWh teurer verkauft, Speicher holen ${Math.round(EXEC_EFFECTS.trade.storeShare * n * 100)} Prozentpunkte mehr vom Spread aus Börsenstrom.`,
  },
  law: {
    name: 'Recht & Kommunikation',
    short: 'Recht',
    effect: (n) =>
      `Erwischte Täter zahlen dir ${Math.round(EXEC_EFFECTS.law.damages * n * 100)} % mehr Schadensersatz, deine eigenen Tricks fliegen ${Math.round(EXEC_EFFECTS.law.caught * n * 100)} % seltener auf.`,
  },
};

export const GRADE_TEXT: Record<ExecGrade, string> = { junior: 'Junior', senior: 'Senior' };

/** The candidates of each department (fictitious persons): who joins the board for which grade. */
export const EXEC_PEOPLE: Record<Department, Record<ExecGrade, { name: string; age: number; cv: string }>> = {
  dev: {
    junior: {
      name: 'Lukas Brandt',
      age: 29,
      cv: 'Projektierer bei einem Bürgerwindpark in Nordfriesland, kennt jedes Amt persönlich.',
    },
    senior: {
      name: 'Jana Petersen',
      age: 47,
      cv: 'Hat zwanzig Windparks durch die Genehmigung gebracht. Gilt als Flüsterin der Landratsämter.',
    },
  },
  grid: {
    junior: {
      name: 'Lena Kowalski',
      age: 31,
      cv: 'Netzplanerin bei einem Übertragungsnetzbetreiber, sechs Jahre Leitwarte.',
    },
    senior: {
      name: 'Dr. Henrik Voss',
      age: 54,
      cv: 'Ehemaliger Technikvorstand eines Offshore-Betreibers. Hat Kabel in jeder Nordsee-Tiefe verlegt.',
    },
  },
  trade: {
    junior: {
      name: 'Murat Aydın',
      age: 33,
      cv: 'Stromhändler an der Börse in Leipzig, schnell am Telefon und mit den Zahlen.',
    },
    senior: {
      name: 'Sophie Laurent',
      age: 45,
      cv: 'Leitete den Energiehandel eines Chemiekonzerns. Verhandelt Lieferverträge wie andere Schach spielen.',
    },
  },
  law: {
    junior: { name: 'Paul Wendt', age: 34, cv: 'Prozessanwalt für Planungsrecht, frisch aus einer großen Kanzlei.' },
    senior: {
      name: 'Dr. Miriam Falk',
      age: 51,
      cv: 'Ehemalige Richterin am Verwaltungsgericht. Weiß, wie man Klagen gewinnt – und wie man sie vermeidet.',
    },
  },
};
export const execName = (d: Department, grade: ExecGrade): string => EXEC_PEOPLE[d][grade].name;
/** The assistant who speaks for vacant departments. */
export const ASSISTANT = { name: 'Frau Hansen', role: 'Assistenz der Geschäftsführung' };

export const HQ_TEXT: Record<HqLevel, { name: string; at: string; desc: string }> = {
  0: {
    name: 'Baucontainer',
    at: 'im Baucontainer',
    desc: 'Ein Bürocontainer auf der ersten Baustelle: ein Schreibtisch, ein Telefon, ein Platz für den Vorstand.',
  },
  1: {
    name: 'Altbau-Etage',
    at: 'in einer Altbau-Etage',
    desc: 'Stuck, Parkett und eine Adresse in der Altstadt. Platz für zwei Vorstandsmitglieder.',
  },
  2: {
    name: 'Bürohaus',
    at: 'in einem eigenen Bürohaus',
    desc: 'Ein eigenes Haus mit Konferenzraum. Drei Plätze im Vorstand, und bei manchen Entscheidungen gibt es eine dritte Option.',
  },
  3: {
    name: 'Glasturm',
    at: 'im Glasturm mit Blick auf die Nordsee',
    desc: 'Der Turm über dem Hafen. Vier Plätze im Vorstand und die besten Optionen bei allen Entscheidungen.',
  },
};

interface DecisionText {
  kicker: string;
  title: (c: { site: string; region: string; person: string }) => string;
  body: (c: { site: string; region: string; person: string }) => string;
  options: Record<string, string>;
}
export const DECISION_TEXT: Record<DecisionKey, DecisionText> = {
  citizens: {
    kicker: 'Anruf aus dem Landratsamt',
    title: (c) => `Bürgerinitiative gegen ${c.site}`,
    body: () =>
      'Anwohner sammeln Unterschriften gegen dein Projekt, während die Behörde den Antrag noch prüft. Der Landrat bittet um ein Gespräch.',
    options: { talk: 'Bürgerbeteiligung anbieten', ignore: 'Aussitzen', report: 'Unabhängiges Gutachten' },
  },
  supplier: {
    kicker: 'Anruf vom Anlagenbauer',
    title: () => 'Hersteller bietet Rabatt gegen Vorkasse',
    body: () =>
      'Das Lager ist voll: Der Hersteller gewährt Rabatt auf alle Bauprojekte der nächsten Quartale, wenn du jetzt anzahlst.',
    options: { order: 'Vorkasse leisten', decline: 'Ablehnen', frame: 'Rahmenvertrag abschließen' },
  },
  heatwave: {
    kicker: 'Anruf vom Netzbetreiber',
    title: () => 'Hitzewelle: Das Netz braucht deine Speicher',
    body: () =>
      'Die Klimaanlagen laufen am Anschlag. Der Netzbetreiber will deine Speicher dieses Quartal exklusiv nutzen und zahlt dafür einen festen Betrag.',
    options: { join: 'Speicher bereitstellen', decline: 'Selbst vermarkten' },
  },
  grant: {
    kicker: 'Post vom Wirtschaftsministerium',
    title: () => 'Förderprogramm Energiewende',
    body: () => 'Das Land fördert Vorzeigeprojekte. Der Antrag ist aufwendig, die Jury wählerisch.',
    options: { apply: 'Antrag selbst stellen', skip: 'Verzichten', lobbyist: 'Fördermittelberater beauftragen' },
  },
  poach: {
    kicker: 'Anruf aus dem Vorstand',
    title: (c) => `${c.person} hat ein Angebot der Konkurrenz`,
    body: () =>
      'Ein Headhunter bietet deutlich mehr Gehalt. Ohne Gegenangebot ist der Platz im Vorstand zum Quartalsende leer.',
    options: { raise: 'Gehalt aufbessern', release: 'Ziehen lassen', options: 'Aktienoptionen anbieten' },
  },
  mayor: {
    kicker: 'Anruf aus dem Rathaus',
    title: (c) => `Die Gemeinde bietet ${c.site} an`,
    body: (c) =>
      `Die Gemeinde in ${c.region} kennt deinen Konzern und bietet ${c.site} ohne Bieterverfahren zum Vorzugspreis an.`,
    options: { lease: 'Fläche pachten', decline: 'Ablehnen' },
  },
};

/** Context of a decision card for its texts. */
export function decisionContext(
  view: PlayerView,
  d: Pick<DecisionView, 'siteId' | 'dept'>,
): { site: string; region: string; person: string } {
  const x = d.siteId ? view.sites.find((s) => s.id === d.siteId) : undefined;
  const e = d.dept ? view.me.board.find((b) => b.dept === d.dept) : undefined;
  return {
    site: x ? siteName(x) : '',
    region: x ? REGION_TEXT[x.r].name : '',
    person: e ? execName(e.dept, e.grade) : 'Ein Vorstandsmitglied',
  };
}

/** What an option of the open card does, from its numbers. */
export function decisionEffect(view: PlayerView, d: DecisionView, o: DecisionView['options'][number]): string {
  const D = DECISION_DATA;
  switch (d.key) {
    case 'citizens':
      if (o.key === 'ignore')
        return `Kostenlos, aber ${Math.round((o.chance ?? 0) * 100)} % Risiko: Die Behörde entscheidet ein Quartal später.`;
      return `Ablehnungsrisiko ${Math.round((o.key === 'talk' ? D.citizens.talk.reject : D.citizens.report.reject) * 100)} Prozentpunkte niedriger.`;
    case 'supplier': {
      if (o.key === 'decline') return 'Alles bleibt beim Listenpreis.';
      const s = o.key === 'frame' ? D.supplier.frame : D.supplier.order;
      return `${Math.round(s.pct * 100)} % Rabatt auf Bau und Montage für ${s.quarters} Quartale.`;
    }
    case 'heatwave':
      return o.key === 'join'
        ? `+${money(o.gain)} fest. Deine Speicher verdienen dieses Quartal sonst nichts.`
        : 'Deine Speicher handeln wie gewohnt am Markt.';
    case 'grant':
      if (o.key === 'skip') return 'Kein Aufwand, kein Geld.';
      return `${Math.round((o.chance ?? 0) * 100)} % Chance auf ${money(o.gain)}.`;
    case 'poach': {
      const e = view.me.board.find((b) => b.dept === d.dept);
      if (o.key === 'release')
        return e ? `${execName(e.dept, e.grade)} verlässt den Vorstand.` : 'Der Platz wird frei.';
      return 'Das Vorstandsmitglied bleibt an Bord.';
    }
    case 'mayor': {
      const x = view.sites.find((s) => s.id === d.siteId);
      return o.key === 'lease'
        ? `Statt ${money(x?.lease ?? 0)} zahlst du nur den Vorzugspreis.`
        : 'Die Fläche geht in die normale Vergabe.';
    }
  }
}

/** Outcome of a decided card (for toasts and the report). */
export function decisionResultText(view: PlayerView, e: Extract<GameEvent, { type: 'decisionTaken' }>): string {
  const T = DECISION_TEXT[e.key];
  const pre = e.auto
    ? `Keine Entscheidung zu „${T.title(decisionContext(view, e))}“ – es gilt: ${T.options[e.option]}.`
    : `Entschieden: ${T.options[e.option]}.`;
  switch (e.key) {
    case 'citizens':
      if (e.option === 'ignore' && e.success === false) return `${pre} Die Genehmigung verzögert sich um ein Quartal.`;
      if (e.option === 'ignore') return `${pre} Die Proteste verlaufen im Sand.`;
      return pre;
    case 'grant':
      if (e.option === 'skip') return pre;
      return e.success ? `${pre} Die Jury bewilligt ${money(e.gain ?? 0)}!` : `${pre} Die Jury lehnt ab.`;
    case 'heatwave':
      return e.gain ? `${pre} Der Netzbetreiber zahlt ${money(e.gain)}.` : pre;
    default:
      return pre;
  }
}

export const AWARD_TEXT: Record<AwardKey, { name: string; cond: string }> = {
  firstPlant: { name: 'Erster Spatenstich', cond: 'erste eigene Anlage am Netz' },
  offshore: { name: 'Offshore-Pionier', cond: 'erster Offshore-Windpark in Betrieb' },
  europe: { name: 'Europäer', cond: 'Flächen in allen vier Regionen' },
  mw500: { name: '500 MW', cond: '500 MW Leistung in Betrieb' },
  co2: { name: 'Klimaschützer', cond: '1 Mio. t CO₂ vermieden' },
  storage: { name: 'Speicherprofi', cond: '1 GWh Speicher in Betrieb' },
  cup: { name: 'Jahrespokal', cond: 'größter Zuwachs an Nettovermögen in einem Spieljahr' },
};

/** Phone calls of the rival CEOs. */
export type CallKind = 'overtook' | 'duelWon' | 'caught' | 'tricked';
export const CALL_TEXT: Record<number, Record<CallKind, string>> = {
  1: {
    overtook: 'Moin! Schau mal auf die Rangliste – Möwenkraft liegt jetzt vor dir. Nimm’s sportlich.',
    duelWon: 'Tja, beim Kabelziehen sind wir an der Küste eben schneller. Schönen Gruß!',
    caught: 'Hab gehört, du schickst mir Ärger auf den Hals. Das merk ich mir, mein Freund.',
    tricked: 'Pech mit deinem Projekt? Sowas passiert. Ganz zufällig natürlich.',
  },
  2: {
    overtook: '¡Hola! Siestasol ist an dir vorbeigezogen. El sol no espera – ich hatte es dir gesagt.',
    duelWon: 'Das Netz gehört jetzt uns. Más rápido, amigo.',
    caught: 'Spione bei Siestasol? Meine Anwälte freuen sich schon auf dich.',
    tricked: 'Ärger mit den Behörden? Qué pena. Wirklich schade.',
  },
  3: {
    overtook: 'Grüezi. Gletscherwerk hat Sie überholt. Geduld zahlt sich eben aus.',
    duelWon: 'Wir waren beim Netzanschluss einen Moment schneller. Nichts für ungut.',
    caught: 'Wir haben Ihren kleinen Versuch bemerkt. Das Gericht wird sich freuen.',
    tricked: 'Ihr Projekt verzögert sich? Das tut mir aufrichtig leid. Fast.',
  },
};

/** Own grid reservations with their remaining time, e.g. "50 MW reserviert, noch 3 Quartale". */
export const reservationText = (res: { mw: number; left: number }[]): string =>
  res
    .map((o) => `${o.mw} MW reserviert, ${o.left > 1 ? `noch ${o.left} Quartale` : 'nur noch bis Quartalsende'}`)
    .join('; ');
