/** Boot, event delegation and action handlers (legacy `A`), now calling the API. */
import './fonts.css';
import './styles.css';
import type {
  Action,
  Challenge,
  DetectiveLevel,
  Difficulty,
  GameEvent,
  PlantSize,
  PlantType,
  PlayerView,
  RegionKey,
  TrickType,
} from '@power-tycoon/engine';
import { api, ApiError, loadStored, saveStored } from './api.js';
import { money } from './format.js';
import { playChallenge } from './minigames/index.js';
import { closeModal, modalLocked, openModal, toast } from './modal.js';
import { registerScenes, setHover } from './scene/index.js';
import { SND, toggleSound } from './sound.js';
import { $, S, UI } from './state.js';
import { DETECTIVE_TEXT, errorText, newsTexts, REGION_TEXT, siteName, siteQuality } from './texts.js';
import { redrawCharts, render, renderTop, selectSite, showBuilt, showEnd, showReport, showStart } from './ui/index.js';
import { recordRivalMoves } from './ui/rivals.js';

/** Game length in years of a running game (for the "new game" dialog). */
const yearsOf = (v: PlayerView | null): number | undefined => (v ? v.endYear - v.startYear : undefined);

function handleError(e: unknown): void {
  if (e instanceof ApiError) {
    toast(e.message);
    if (e.status === 401 || e.status === 404) {
      saveStored(null);
      S.game = null;
      showStart(false);
    }
  } else {
    console.error(e);
    toast(errorText('internalError'));
  }
}

/** Reactions to the player's own events (toasts, sounds, dialogs). */
function react(events: GameEvent[]): void {
  const v = S.view!;
  for (const e of events) {
    switch (e.type) {
      case 'siteSurveyed': {
        const x = v.sites.find((s) => s.id === e.siteId)!;
        toast('Gutachten ' + siteName(x) + ': ' + siteQuality(x));
        break;
      }
      case 'siteLeased':
        SND.coin();
        break;
      case 'permitApplied':
        if (e.quarters)
          toast('Antrag gestellt. Bescheid in ' + e.quarters + ' Quartal' + (e.quarters > 1 ? 'en' : '') + '.');
        break;
      case 'plantBuilt':
        SND.clank();
        showBuilt(v.sites.find((s) => s.id === e.siteId)!);
        break;
      case 'gridConnected':
        SND.zap();
        toast('Am Netz!');
        break;
      case 'gridConnectFailed':
        toast('Anschluss gescheitert.');
        break;
      case 'gridDuel':
        // played duels show their own result; automatic ones get a toast
        if (v.settings.autoMinigames) toast(newsTexts(v, e)[0]!.text);
        break;
      case 'repowered':
        SND.clank();
        toast(`Repowering läuft: ${siteName(v.sites.find((s) => s.id === e.siteId)!)} ist ein Quartal vom Netz.`);
        break;
      case 'spied':
        openModal(
          `<h2>${e.caught ? 'Spion enttarnt' : 'Spionagebericht'}</h2><p style="margin:0">${
            e.caught
              ? `Die Detektive von ${v.players[e.targetId]!.name} haben deinen Spion erwischt. Kein Bericht – das Geld ist weg.`
              : `Dein Spion hat geliefert: Standortdaten, Wirkungsgrade, Genehmigungen und Verträge von ${v.players[e.targetId]!.name} siehst du jetzt bis zum Ende des Berichts.`
          }</p><div class="foot"><button class="btn primary" data-act="closeModal">OK</button></div>`,
        );
        break;
      case 'detectivesHired':
        toast(`${DETECTIVE_TEXT[e.level].name} schützt dich ${e.quarters} Quartale lang.`);
        break;
      case 'repaired':
        if (e.method === 'service') toast('Der Servicetrupp hat die Störung behoben.');
        break;
      case 'gridReserved':
        toast(e.mw + ' MW in ' + REGION_TEXT[e.region].name + ' für vier Quartale reserviert.');
        break;
      case 'contractAccepted':
        toast('Vertrag geschlossen.');
        break;
      case 'loanTaken':
        toast(money(e.amount) + ' Kredit aufgenommen.');
        break;
      case 'loanRepaid':
        toast(money(e.amount) + ' getilgt.');
        break;
      case 'trickSucceeded': {
        const t = newsTexts(v, e)[0]!.text.replace(/^Lobby-Erfolg: /, '');
        openModal(
          `<h2>Auftrag ausgeführt</h2><p style="margin:0">${t}</p><div class="foot"><button class="btn primary" data-act="closeModal">OK</button></div>`,
        );
        break;
      }
      case 'trickFailed':
        openModal(
          `<h2>Hat nicht geklappt</h2><p style="margin:0">${e.caught ? 'Du bist aufgeflogen. Das kostet dich ' + money(e.fine) + ' Strafe' + (e.damages ? ' und ' + money(e.damages) + ' Schadensersatz an ' + v.players[e.targetId]!.name : '') + '.' : e.trick === 'klage' ? 'Das Gericht hat die Klage abgewiesen.' : 'Niemand weiß, wer dahintersteckt.'}</p><div class="foot"><button class="btn primary" data-act="closeModal">OK</button></div>`,
        );
        break;
      default:
        break;
    }
  }
}

/** Sends one action; plays minigame challenges until the flow is finished. */
async function run(action: Action): Promise<boolean> {
  if (!S.game || S.busy) return false;
  S.busy = true;
  try {
    const res = await api.action(S.game, action);
    // the minigame dialog stays open while a flow goes on with the next minigame
    if (action.type === 'minigameResult' && !res.challenge) closeModal();
    S.view = res.view;
    UI.confirm = null;
    S.busy = false;
    render();
    react(res.events);
    if (res.challenge) await resolveChallenge(res.challenge);
    return true;
  } catch (e) {
    if (action.type === 'minigameResult') closeModal();
    S.busy = false;
    render();
    handleError(e);
    return false;
  }
}

async function resolveChallenge(ch: Challenge): Promise<void> {
  const x = S.view!.sites.find((s) => s.id === ch.siteId)!;
  const outcome = await playChallenge(ch, x);
  await run({ type: 'minigameResult', challengeId: ch.id, outcome });
}

async function endQuarter(): Promise<void> {
  if (!S.game || S.busy || modalLocked) return;
  S.busy = true;
  renderTop();
  try {
    const res = await api.endQuarter(S.game);
    S.view = res.view;
    recordRivalMoves(res.report, res.rivalActions);
    UI.confirm = null;
    S.busy = false;
    render();
    showReport(res.report, res.rivalActions);
  } catch (e) {
    S.busy = false;
    render();
    handleError(e);
  }
}

async function startGame(): Promise<void> {
  const name = ($<HTMLInputElement>('#sName')?.value.trim() || 'Deichwatt AG').slice(0, 24);
  const auto = !!$<HTMLInputElement>('#sAuto')?.checked;
  const diff = ($<HTMLSelectElement>('#sDiff')?.value || 'normal') as Difficulty;
  const years = Number($<HTMLSelectElement>('#sYears')?.value || 10);
  try {
    const res = await api.create(name, auto, diff, years);
    S.game = { gameId: res.gameId, token: res.token };
    saveStored(S.game);
    S.view = res.view;
    S.rivalMoves = {};
    UI.tab = 'overview';
    UI.sel = null;
    closeModal();
    render();
  } catch (e) {
    handleError(e);
  }
}

const A: Record<string, (v: string, el: HTMLElement) => void> = {
  tab: (v) => {
    UI.tab = v;
    render();
    window.scrollTo({ top: 0 });
  },
  region: (v) => {
    UI.region = v as RegionKey;
    UI.sel = null;
    UI.confirm = null;
    render();
  },
  sel: (v) => {
    UI.sel = v;
    UI.confirm = null;
    if (!selectSite(v)) render();
    if (window.innerWidth < 980) $('#detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  goRegion: (v) => {
    UI.tab = 'sites';
    UI.region = v as RegionKey;
    UI.sel = null;
    render();
    window.scrollTo({ top: 0 });
  },
  sound: () => {
    toggleSound();
    renderTop();
  },
  goSite: (v) => {
    const x = S.view!.sites.find((s) => s.id === v)!;
    UI.tab = 'sites';
    UI.region = x.r;
    UI.sel = v;
    render();
  },
  endQuarter: () => void endQuarter(),
  closeReport: () => {
    closeModal();
    if (S.view?.over) showEnd();
  },
  closeModal: () => closeModal(),
  newGameDlg: () => showStart(false, S.view?.me.name, S.view?.settings.difficulty, yearsOf(S.view)),
  start: () => void startGame(),
  continue: () => {
    closeModal();
    render();
    if (S.view?.challenge) void resolveChallenge(S.view.challenge);
  },
  survey: (v) => void run({ type: 'survey', siteId: v }),
  lease: (v) => void run({ type: 'lease', siteId: v }),
  permit: (v) => {
    const [siteId, t, size] = v.split('|');
    void run({ type: 'applyPermit', siteId: siteId!, plantType: t as PlantType, size: (size || 'std') as PlantSize });
  },
  size: (v) => {
    UI.size = v as PlantSize;
    render();
  },
  repower: (v) => void run({ type: 'repower', siteId: v }),
  spy: (v) => void run({ type: 'spy', targetId: +v }),
  hire: (v) => void run({ type: 'hireDetectives', level: v as DetectiveLevel }),
  retype: (v) => void run({ type: 'changePlantType', siteId: v }),
  build: (v) => void run({ type: 'build', siteId: v }),
  connect: (v) => void run({ type: 'connectGrid', siteId: v }),
  connectNow: (v) => {
    closeModal();
    void run({ type: 'connectGrid', siteId: v });
  },
  fixSelf: (v) => void run({ type: 'repairSelf', siteId: v }),
  fixPro: (v) => void run({ type: 'repairService', siteId: v }),
  sellSite: (v, el) => {
    if (el.dataset.ok !== '1') {
      UI.confirm = 'sellSite:' + v;
      render();
      return;
    }
    void run({ type: 'sellSite', siteId: v });
  },
  reserve: (v) => void run({ type: 'reserveGrid', region: v as RegionKey }),
  accept: (v) => void run({ type: 'acceptContract', offerId: +v }),
  borrow: (v) => void run({ type: 'borrow', amount: +v }),
  repay: (v) => void run({ type: 'repay', amount: v === 'all' ? 'all' : +v }),
  trick: (v) => {
    UI.trick = v as TrickType;
    render();
  },
  trickTarget: (_v, el) => {
    UI.target = (el as HTMLSelectElement).value;
    render();
  },
  trickGo: (v) => {
    const [id, t] = v.split('|');
    UI.tab = 'lobby';
    UI.trick = t as TrickType;
    UI.target = id!;
    render();
  },
  doTrick: () => {
    const target = UI.target;
    UI.target = '';
    void run({ type: 'lobby', trick: UI.trick, siteId: target });
  },
};

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || el.tagName === 'SELECT' || (el as HTMLInputElement).type === 'checkbox') return;
  if (el.tagName === 'BUTTON' && el.dataset.act !== 'sound') SND.click();
  if (el.closest('#modal') === null && modalLocked) return;
  const f = A[el.dataset.act!];
  if (f) {
    e.preventDefault();
    f(el.dataset.v ?? '', el);
  }
});
document.addEventListener('change', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (el && (el.tagName === 'SELECT' || (el as HTMLInputElement).type === 'checkbox')) {
    A[el.dataset.act!]?.(el.dataset.v ?? '', el);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal')!.hidden && !modalLocked) {
    if ($('[data-act="closeReport"]')) A.closeReport!('', document.body);
    else if ($('[data-act="closeModal"]')) closeModal();
  }
});
let rzT: ReturnType<typeof setTimeout> | undefined;
window.addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    if (S.view) {
      redrawCharts();
      registerScenes();
    }
  }, 150);
});
document.addEventListener('pointerover', (e) => {
  const h = (e.target as HTMLElement).closest?.<HTMLElement>('.hit');
  setHover(h ? (h.dataset.v ?? null) : null);
});

async function boot(): Promise<void> {
  const stored = loadStored();
  if (!stored) {
    showStart(false);
    return;
  }
  try {
    const res = await api.load(stored);
    S.game = stored;
    S.view = res.view;
    render();
    if (S.view.over) showEnd();
    else if (S.view.challenge) void resolveChallenge(S.view.challenge);
    else if (!(location.search === '?continue' && S.view.turn > 0))
      showStart(true, S.view.me.name, S.view.settings.difficulty, yearsOf(S.view));
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404)) saveStored(null);
    showStart(false);
    if (e instanceof ApiError && e.status !== 401 && e.status !== 404) toast(e.message);
  }
}
void boot();
