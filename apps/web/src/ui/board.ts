/** Board folder (phase 8): the four departments with their members or candidates, and the headquarters plan. */
import {
  AWARDS,
  DEPARTMENT_KEYS,
  EXEC_GRADE_KEYS,
  EXEC_GRADES,
  HQ_LEVEL_KEYS,
  HQ_LEVELS,
  type AwardKey,
  type Department,
  type ExecGrade,
} from '@power-tycoon/engine';
import { esc, money, turnStr } from '../format.js';
import {
  AWARD_TEXT,
  DECISION_TEXT,
  decisionContext,
  decisionEffect,
  DEPT_TEXT,
  EXEC_PEOPLE,
  GRADE_TEXT,
  HQ_TEXT,
} from '../texts.js';
import { btn, optionFor, V } from './common.js';
import { crest, execPortrait } from './companies.js';
import { byRank } from './rivals.js';

function member(d: Department): string {
  const v = V(),
    e = v.me.board.find((b) => b.dept === d)!,
    P = EXEC_PEOPLE[d][e.grade],
    G = EXEC_GRADES[e.grade];
  const fire = optionFor({ type: 'fireExecutive', dept: d });
  return `<div class="exec"><div class="photo">${execPortrait(d, e.grade, 72)}</div><div class="stack" style="gap:4px">
    <b>${esc(P.name)}</b><span class="muted">${GRADE_TEXT[e.grade]} · im Vorstand seit ${turnStr(v.startYear, e.since)}</span>
    <span>${DEPT_TEXT[d].effect(G.power)}</span><span class="muted">Gehalt ${money(G.salary, true)} je Quartal</span>
    <div class="row">${fire ? btn('fireExec', d, 'Entlassen', fire, { confirm: true }) : ''}</div></div></div>`;
}

function candidate(d: Department, g: ExecGrade): string {
  const P = EXEC_PEOPLE[d][g],
    G = EXEC_GRADES[g],
    o = optionFor({ type: 'hireExecutive', dept: d, grade: g });
  return `<div class="cv"><div class="photo">${execPortrait(d, g, 64)}</div><div class="stack" style="gap:3px">
    <b>${esc(P.name)}, ${P.age} <span class="chip">${GRADE_TEXT[g]}</span></b><span class="muted">${esc(P.cv)}</span>
    <span>${DEPT_TEXT[d].effect(G.power)}</span><span class="muted">Gehalt ${money(G.salary, true)} je Quartal</span>
    <div class="row">${o ? btn('hireExec', d + '|' + g, 'Einstellen', o, { cls: 'primary' }) : ''}</div></div></div>`;
}

function department(d: Department): string {
  const v = V(),
    taken = v.me.board.some((b) => b.dept === d);
  return `<section class="dept"><div class="phead"><h3>${esc(DEPT_TEXT[d].name)}</h3>${taken ? '<span class="chip good">besetzt</span>' : '<span class="chip warn">Stelle frei</span>'}</div>
    ${taken ? member(d) : `<div class="cvs">${EXEC_GRADE_KEYS.map((g) => candidate(d, g)).join('')}</div>`}</section>`;
}

function blueprint(): string {
  const v = V(),
    up = optionFor({ type: 'upgradeHq' });
  return `<div class="blue"><div class="levels">${HQ_LEVEL_KEYS.map((l) => {
    const L = HQ_LEVELS[l],
      cls = l === v.me.hq ? ' now' : l < v.me.hq ? ' done' : '';
    const action =
      l === v.me.hq
        ? '<b>Hier sitzt du</b>'
        : l === v.me.hq + 1 && up
          ? btn('upgradeHq', '', 'Umziehen', up, { cls: 'gold' })
          : l > v.me.hq
            ? `<span class="mono">${money(L.cost, true)}</span>`
            : '';
    return `<div class="lvl${cls}"><h4>${l + 1}. ${HQ_TEXT[l].name}</h4><p>${HQ_TEXT[l].desc}</p>
      <ul><li>${L.seats} ${L.seats > 1 ? 'Plätze' : 'Platz'} im Vorstand</li><li>Unterhalt ${money(L.upkeep, true)} je Quartal</li></ul>${action}</div>`;
  }).join('')}</div>
  <p class="fine">Der Kaufpreis zählt zu 80 % weiter zum Nettovermögen. Ein größerer Sitz öffnet mehr Plätze im Vorstand und bei manchen Entscheidungen eine bessere dritte Option.</p></div>`;
}

export function vBoard(): string {
  const v = V();
  return `<div class="stack" style="gap:16px">
    <section class="panel"><div class="phead"><h2>Vorstand</h2><span class="muted">${v.me.board.length} von ${v.me.seats} Plätzen besetzt · Gehälter und Firmensitz ${money(v.me.overhead, true)} je Quartal</span></div>
      <p class="muted" style="margin:0">Jedes Ressort hat genau einen Platz. ${v.me.board.length >= v.me.seats ? 'Alle Plätze im ' + HQ_TEXT[v.me.hq].name + ' sind belegt – für mehr Vorstand braucht es einen größeren Firmensitz.' : 'Eine Entlassung kostet ein Quartalsgehalt Abfindung.'}</p></section>
    <div class="depts">${DEPARTMENT_KEYS.map(department).join('')}</div>
    <section class="panel"><div class="phead"><h2>Firmensitz</h2><span class="muted">${HQ_TEXT[v.me.hq].name}</span></div>${blueprint()}</section></div>`;
}

/* ---------- awards ---------- */

const CUP =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0z M7 5H4a3 3 0 0 0 3 4 M17 5h3a3 3 0 0 1-3 4 M12 13v4 M9 17h6v3H9z" fill="none" stroke="#2a2016" stroke-width="2" stroke-linejoin="round"/></svg>';
const medal = (cls: string, size = 40) =>
  `<span class="medal ${cls}" style="width:${size}px;height:${size}px">${CUP}</span>`;

export function vAwards(): string {
  const v = V();
  const goals = Object.keys(AWARDS) as Exclude<AwardKey, 'cup'>[];
  const cards = goals
    .map((k) => {
      const a = v.me.awards.find((x) => x.key === k),
        T = AWARD_TEXT[k];
      if (a)
        return `<div class="award">${medal(a.gold ? '' : 'silver')}<div><b>${T.name}</b><small>${T.cond}</small><small>${a.gold ? 'Gold – als Erste' : 'Silber'} · ${turnStr(v.startYear, a.turn - 1)}</small></div></div>`;
      const goal = Math.max(1, AWARDS[k].goal),
        have = v.me.awardProgress[k],
        pct = Math.min(100, Math.round((have / goal) * 100));
      const prog =
        goal > 1
          ? `<small>${have.toLocaleString('de-DE')} von ${goal.toLocaleString('de-DE')}</small><div class="prog"><i style="width:${pct}%"></i></div>`
          : '<small>noch nicht erreicht</small>';
      return `<div class="award open">${medal('none')}<div><b>${T.name}</b><small>${T.cond}</small>${prog}</div></div>`;
    })
    .join('');
  // the race for this year's cup: growth since the start of the year
  const start = (v.year - v.startYear) * 4;
  const race = v.players
    .filter((p) => !p.out)
    .map((p) => ({ p, g: p.worth - (p.hist[start] ?? p.worth) }))
    .sort((a, b) => b.g - a.g);
  const top = Math.max(1, ...race.map((r) => Math.abs(r.g)));
  const cups = v.players
    .flatMap((p) => p.awards.filter((a) => a.key === 'cup').map((a) => ({ p, year: a.year! })))
    .sort((a, b) => b.year - a.year);
  const others = v.players.filter((p) => p.id !== v.playerId).sort(byRank);
  return `<div class="stack" style="gap:16px"><section class="panel"><div class="phead"><h2>Vitrine</h2><span class="muted">Gold für den ersten Konzern, Silber für alle danach</span></div><div class="awards">${cards}</div></section>
  <div class="grid g2"><section class="panel"><div class="phead"><h3>Rennen um den Jahrespokal ${v.year}</h3><span class="muted">Zuwachs seit Jahresbeginn · noch ${4 - v.q} Q</span></div>
    <div class="bars">${race.map(({ p, g }) => `<div class="bar"><span>${crest(p.id, 20)} ${esc(p.human ? 'Du' : p.name)}</span><i style="width:${Math.max(2, (Math.abs(g) / top) * 100)}%;background:var(--c${p.id})"></i><span class="mono ${g < 0 ? 'down' : ''}">${g < 0 ? '−' : '+'}${money(Math.abs(g), true)}</span></div>`).join('')}</div></section>
  <section class="panel"><h3 style="margin-bottom:8px">Jahrespokale</h3>${
    cups.length
      ? `<ul class="list">${cups.map((c) => `<li>${medal('', 30)}<span><b>${c.year}</b> · ${esc(c.p.name)}</span></li>`).join('')}</ul>`
      : '<p class="muted" style="margin:0">Der erste Pokal wird zum Jahreswechsel vergeben.</p>'
  }
    <h3 style="margin:14px 0 8px">Auszeichnungen der Konkurrenz</h3><ul class="list">${others
      .map(
        (p) =>
          `<li>${crest(p.id, 22)}<span><b>${esc(p.name)}</b><br><span class="muted">${p.awards.length ? p.awards.map((a) => (a.key === 'cup' ? `Jahrespokal ${a.year}` : `${AWARD_TEXT[a.key].name} (${a.gold ? 'Gold' : 'Silber'})`)).join(' · ') : 'noch keine'}</span></span></li>`,
      )
      .join('')}</ul></section></div></div>`;
}

/* ---------- decision card ---------- */

export function decisionCard(): string {
  const v = V(),
    d = v.me.decision;
  if (!d) return '<p class="muted" style="margin:0">Keine Anrufe. Das Handy ist still.</p>';
  const T = DECISION_TEXT[d.key],
    c = decisionContext(v, d);
  const opts = d.options
    .map((o) => {
      const opt = optionFor({ type: 'decide', option: o.key });
      const locked = o.minHq > v.me.hq;
      const dis = !opt || opt.error !== null;
      return `<button class="opt" data-act="decide" data-v="${o.key}" ${dis ? 'disabled' : ''}>
        <b>${T.options[o.key]}</b><span class="fx">${decisionEffect(v, d, o)}</span>${o.cost ? `<span class="mono">${money(o.cost, true)}</span>` : ''}
        ${o.default ? '<span class="def">Gilt, wenn du nicht entscheidest</span>' : ''}${locked ? `<span class="def">Ab Firmensitz „${HQ_TEXT[o.minHq].name}“</span>` : ''}</button>`;
    })
    .join('');
  return `<div class="dcard"><span class="kicker">${T.kicker}</span><h3>${esc(T.title(c))}</h3><p>${esc(T.body(c))}</p><div class="opts">${opts}</div></div>`;
}

export function vDecision(): string {
  return `<section class="panel">${decisionCard()}</section>`;
}
