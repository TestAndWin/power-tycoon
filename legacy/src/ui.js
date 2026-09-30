/* ================= Oberfläche ================= */
const pc=id=>`var(--c${id})`;
const IC={
  free:'<svg width="28" height="30" viewBox="0 0 28 30" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".5"><path d="M2 27c5-4 9-4 12-2s8 2 12-2"/><path d="M6 22v-4M6 18l-2 2M6 18l2 2"/></svg>',
  lease:'<svg width="28" height="30" viewBox="0 0 28 30" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 27c5-4 9-4 12-2s8 2 12-2"/><path d="M14 24V8l8 3-8 3"/></svg>',
  wind:'<svg width="28" height="30" viewBox="0 0 28 30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M14 11v18M12 29h4"/><path d="M14 11V1M14 11l-8.5 5M14 11l8.5 5" stroke="var(--windc)" stroke-width="2"/><circle cx="14" cy="11" r="1.6" fill="currentColor"/></svg>',
  off:'<svg width="28" height="30" viewBox="0 0 28 30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M14 10v14"/><path d="M14 10V1M14 10l-8 4.5M14 10l8 4.5" stroke="var(--windc)" stroke-width="2"/><path d="M1 26c3-2 5-2 7 0s5 2 7 0 5-2 7 0 4 2 5 1M1 29c3-2 5-2 7 0s5 2 7 0 5-2 7 0" stroke="var(--accent)"/></svg>',
  solar:'<svg width="28" height="30" viewBox="0 0 28 30" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="22" cy="6" r="3.5" fill="var(--sun)" stroke="none"/><path d="M4 16h18l-3 9H1z" fill="var(--accent-soft)"/><path d="M10 16l-2 9M16 16l-2 9M3 20.5h18M11 25v4"/></svg>',
  batt:'<svg width="28" height="30" viewBox="0 0 28 30" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="9" width="20" height="19" rx="2"/><path d="M11 6h6v3h-6z"/><path d="M15 12l-4 7h5l-3 6" stroke="var(--sun)" stroke-width="2"/></svg>',
  hydro:'<svg width="28" height="30" viewBox="0 0 28 30" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 8l8 0 0 20H2" /><path d="M10 12h16M10 18c4 0 5 3 8 3s5-3 8-3M10 23c4 0 5 3 8 3s5-3 8-3" stroke="var(--accent)"/><path d="M2 12c3 0 4-2 8-2" stroke="var(--accent)"/></svg>',
  pump:'<svg width="28" height="30" viewBox="0 0 28 30" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 6h9v4H2zM17 24h9v4h-9z" fill="var(--accent-soft)"/><path d="M8 10c0 8 4 10 12 14" /><path d="M16 12l4-2 0 4" stroke="var(--accent)"/></svg>',
  fault:'<svg width="28" height="30" viewBox="0 0 28 30" fill="none"><path d="M14 3 26 26H2Z" fill="var(--bad)"/><path d="M14 11v7M14 21v2" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>'
};
function siteStatus(x){
  if(x.owner<0)return{t:'Frei',i:'free',k:''};
  if(!x.type)return{t:'Gepachtet',i:'lease',k:'warn'};
  const i=x.type;
  if(x.permit==='pending')return{t:'Genehmigung · '+Math.max(1,x.permitLeft)+' Q',i,k:''};
  if(x.permit==='rejected')return{t:'Abgelehnt',i,k:'bad'};
  if(!x.built)return x.fail?{t:'Montage abgebrochen',i,k:'bad'}:{t:'Baureif',i,k:'warn'};
  if(!x.grid)return{t:'Netzanschluss fehlt',i,k:'warn'};
  if(x.fault)return{t:'Störung!',i:'fault',k:'bad'};
  if(x.curtail>0)return{t:'Auflage −50 %',i,k:'warn'};
  return{t:'In Betrieb',i,k:'good'};
}
function todo(){
  const L=[];
  G.sites.filter(x=>x.owner===0).forEach(x=>{
    const s=siteStatus(x);
    if(x.fault&&x.built&&x.grid)L.push({x,t:siteName(x)+': Störung beheben',k:'bad'});
    else if(s.t==='Gepachtet')L.push({x,t:siteName(x)+': Genehmigung beantragen',k:'warn'});
    else if(s.t==='Abgelehnt')L.push({x,t:siteName(x)+': Genehmigung abgelehnt',k:'warn'});
    else if(s.t==='Baureif')L.push({x,t:siteName(x)+': bauen',k:'warn'});
    else if(s.t==='Montage abgebrochen')L.push({x,t:siteName(x)+': Montage wiederholen',k:'warn'});
    else if(s.t==='Netzanschluss fehlt')L.push({x,t:siteName(x)+': ans Netz anschließen',k:'warn'});
  });
  return L;
}
function render(){if(!G)return;renderTop();renderTabs();renderView();save()}
function renderTop(){
  const P=me(),ph=G.priceHist,d=ph.length>1?ph[ph.length-1]-ph[ph.length-2]:0,total=(G.endYear-G.startYear)*4;
  $('#top').innerHTML=`
    <div class="brand"><b>${LOGO}Wattmogul</b><span><i class="dot" style="--oc:${pc(0)}"></i>${esc(P.name)}</span></div>
    <div class="stats">
      <div class="stat"><span class="label">Quartal</span><span class="v">${qStr(G.year,G.q)} <span class="season s${G.q}">${SEAS[G.q].name}</span></span></div>
      <div class="stat"><span class="label">Kasse</span><span class="v ${P.cash<0?'down':''}">${money(P.cash)}</span></div>
      <div class="stat"><span class="label">Kredit</span><span class="v">${money(P.loan)}</span></div>
      <div class="stat"><span class="label">Strompreis</span><span class="v">${eur(G.price)} <span class="${d>=0?'up':'down'}">${d>=0?'▲':'▼'}${Math.abs(d)}</span></span></div>
      <div class="stat"><span class="label">Rang</span><span class="v">${rankOf(P)} von ${G.players.filter(p=>!p.out).length}</span></div>
    </div>
    <div class="row" style="flex-wrap:nowrap"><button class="btn icon" data-act="sound" aria-label="Ton ${SND.on?'aus':'an'}schalten" title="Ton ${SND.on?'aus':'an'}">${SND.on?SPK_ON:SPK_OFF}</button>
    <button class="btn primary big endq" data-act="endQuarter" ${G.over?'disabled':''}>Quartal beenden →</button></div>`;
}
const LOGO='<svg class="logo" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><g class="rotor"><path d="M12 12V2M12 12l-8.7 5M12 12l8.7 5" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></g><circle cx="12" cy="12" r="2.4" fill="var(--sun)"/></svg>';
const SPK_ON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>';
const SPK_OFF='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
const TABS=[['overview','Übersicht'],['sites','Standorte'],['market','Strommarkt'],['bank','Bank'],['lobby','Lobby & Tricks'],['rivals','Konkurrenz'],['news','Nachrichten']];
function renderTabs(){const n=todo().length;$('#tabs').innerHTML=TABS.map(([k,l])=>`<button class="tab" role="tab" aria-selected="${UI.tab===k}" data-act="tab" data-v="${k}">${l}${k==='overview'&&n?` <span class="badge">${n}</span>`:''}</button>`).join('')}
function renderView(){const v=$('#view');v.innerHTML=({overview:vOverview,sites:vSites,market:vMarket,bank:vBank,lobby:vLobby,rivals:vRivals,news:vNews})[UI.tab]();v.querySelectorAll('[data-chart]').forEach(drawChart);registerScenes()}

/* ---------- Übersicht ---------- */
function vOverview(){
  const P=me(),T=todo(),mine=G.sites.filter(x=>x.owner===0);
  const mw=mwOf(P),next=mine.filter(operating).reduce((s,x)=>s+(x.fault||isStore(x.type)?0:genEstimate(x)),0);
  const minis=RK.map(r=>{const m=G.sites.filter(x=>x.r===r&&x.owner===0),mw2=m.filter(operating).reduce((a,x)=>a+PT[x.type].mw,0);
    return `<button class="mini" data-act="goRegion" data-v="${r}"><canvas data-scene="${r}" data-mini="1"></canvas><span class="mcap"><b>${REG[r].name}</b><span>${m.length?m.length+' Fläche'+(m.length>1?'n':'')+' · '+mw2+' MW':'noch nicht vertreten'}</span>${ownBar(r)}</span></button>`}).join('');
  return `<div class="stack" style="gap:14px">
  <div class="minis">${minis}</div>
  <div class="tiles">
    <div class="tile"><span class="label">Nettovermögen</span><span class="big">${money(worth(P))}</span><span class="muted">Rang ${rankOf(P)} · noch ${Math.max(0,(G.endYear-G.year)*4-G.q)} Quartale bis Ende ${G.endYear-1}</span></div>
    <div class="tile"><span class="label">Installierte Leistung</span><span class="big">${mw.toLocaleString('de-DE')} MW</span><span class="muted">${mine.filter(operating).length} Anlagen am Netz</span></div>
    <div class="tile"><span class="label">Erzeugung ${QN[G.q]}</span><span class="big">${mwh(next)}</span><span class="muted">Prognose ohne Wetterereignisse</span></div>
    <div class="tile"><span class="label">CO₂ vermieden</span><span class="big co2">${tons(P.co2)}</span><span class="muted">gegenüber Kohle- und Gasstrom</span></div>
  </div>
  <div class="grid g2">
    <section class="panel"><div class="phead"><h3>Nettovermögen der Konzerne</h3><span class="muted">quartalsweise</span></div><div class="chart" data-chart="worth"></div></section>
    <section class="panel"><div class="phead"><h3>Handlungsbedarf</h3></div>
      ${T.length?`<ul class="list">${T.map(o=>`<li><span class="chip ${o.k}">${o.k==='bad'?'Dringend':'Offen'}</span><button class="linkish" data-act="goSite" data-v="${o.x.id}">${o.t}</button></li>`).join('')}</ul>`:`<p class="muted" style="margin:0">Nichts offen. Zeit für neue Flächen unter <button class="linkish" data-act="tab" data-v="sites">Standorte</button>.</p>`}
      <div class="phead" style="margin-top:18px"><h3>Meldungen</h3><button class="linkish" data-act="tab" data-v="news">Alle</button></div>
      <ul class="list">${G.news.slice(0,4).map(n=>`<li><span class="mono muted" style="font-size:12px;min-width:62px">${n.d}</span><span>${n.text}</span></li>`).join('')}</ul>
    </section>
  </div>
  <section class="panel"><div class="phead"><h3>Strompreis & Speicher-Spread</h3><span class="muted">Euro je Megawattstunde</span></div><div class="chart" data-chart="price"></div></section>
  </div>`;
}

/* ---------- Standorte ---------- */
function gridBar(r){
  const cap=G.grid[r];const seg=G.players.map(p=>({c:pc(p.id),mw:usedGrid(r,p.id)})).filter(s=>s.mw>0);
  const res=G.res.filter(o=>o.r===r).reduce((s,o)=>s+o.mw,0),used=usedGrid(r);
  return `<div class="gridwrap"><div class="row" style="justify-content:space-between"><span class="label">Netzkapazität</span><span class="mono" style="font-size:12px">${used} + ${res} res. / ${cap} MW</span></div>
    <div class="gridbar" role="img" aria-label="${used} MW belegt, ${res} MW reserviert, ${cap} MW gesamt">${seg.map(s=>`<i style="width:${s.mw/cap*100}%;background:${s.c}"></i>`).join('')}${res?`<i class="res" style="width:${res/cap*100}%"></i>`:''}</div>
    <span class="muted" style="font-size:12px">Frei für dich: ${Math.max(0,freeGrid(r,0))} MW${myReserve(r,0)?` (davon ${myReserve(r,0)} MW reserviert)`:''}</span></div>`;
}
function ownBar(r){
  const S=G.sites.filter(x=>x.r===r);
  return `<span class="obar" aria-hidden="true">${G.players.map(p=>{const n=S.filter(x=>x.owner===p.id).length;return n?`<i style="width:${n/S.length*100}%;background:${pc(p.id)}"></i>`:''}).join('')}</span>`;
}
function ownerLegend(r){
  const S=G.sites.filter(x=>x.r===r),free=S.filter(x=>x.owner<0).length;
  return `<div class="olegend" aria-label="Flächen je Konzern">${G.players.filter(p=>!p.out).map(p=>{const n=S.filter(x=>x.owner===p.id).length;
    return `<span class="ochip${n?'':' zero'}${p.human?' me':''}" style="--oc:${pc(p.id)}"><i class="mb">${mono(p)}</i>${esc(p.human?'Du · '+p.name:p.name)}<b>${n}</b></span>`}).join('')}<span class="ochip free"><i class="mb"></i>Frei<b>${free}</b></span></div>`;
}
function vSites(){
  const r=UI.region,R=REG[r];
  const pills=RK.map(k=>`<button class="rpill" aria-pressed="${k===r}" data-act="region" data-v="${k}">${REG[k].name}<span class="n">${G.sites.filter(x=>x.r===k&&x.owner===0).length}/16</span>${ownBar(k)}</button>`).join('');
  const tiles=G.sites.filter(x=>x.r===r).map(x=>{
    const s=siteStatus(x),own=x.owner>=0;let val='';
    if(!own)val=x.surveyed[0]?siteQuality(x):money(x.lease,true);
    else if(x.owner===0&&operating(x)&&!x.fault)val=PT[x.type].mw+' MW';
    else if(own)val=esc(G.players[x.owner].name);
    return `<button class="plot ${own?'owned':''} ${x.owner===0?'mine':''} ${x.fault?'fire':''} ${UI.sel===x.id?'sel':''}" style="--oc:${own?pc(x.owner):'var(--line)'}" data-act="sel" data-v="${x.id}" aria-label="${siteName(x)} ${s.t}">
      <span class="pid">${siteName(x)}${own?'<i class="dot"></i>':''}</span><span class="picon">${IC[s.i]}</span><span class="pst">${s.t}</span><span class="pv">${val}</span></button>`}).join('');
  return `<div class="regions">${pills}</div>
  <div class="field-layout">
    <section class="panel">
      <div class="phead"><h2>${R.name}</h2><span class="muted">${R.types.map(t=>PT[t].name).join(' · ')}</span></div>
      <p class="muted" style="margin:0 0 12px">${R.desc}</p>
      <div class="region-bar">
        ${R.wind?`<div class="stat"><span class="label">Wind</span><span class="v">${R.wind[0].toLocaleString('de-DE')}–${R.wind[1].toLocaleString('de-DE')} m/s</span></div>`:''}
        ${R.sun?`<div class="stat"><span class="label">Sonne</span><span class="v">${R.sun[0]}–${R.sun[1]} kWh/kWp</span></div>`:''}
        ${gridBar(r)}
        <button class="btn" data-act="reserve" data-v="${r}" ${freeGrid(r,0)<50?'disabled':''}>50 MW reservieren <small>0,8 Mio. € · 4 Q</small></button>
      </div>
      <div class="scene"><canvas data-scene="${r}" aria-hidden="true"></canvas><div class="hits">${hits(r)}</div></div>
      ${ownerLegend(r)}
      <p class="muted" style="font-size:12px;margin:6px 0 0">Tipp auf eine Parzelle. Rahmen, Fahne und Etikett in Konzernfarbe zeigen, wem die Fläche gehört; ★ markiert deine eigenen.</p>
    </section>
    <aside class="panel" id="detail">${detail()}</aside>
  </div>`;
}
function hits(r){
  const g=geo(100,100);
  return G.sites.filter(x=>x.r===r).map(x=>{const qd=quad(g,x.i),l=g.X(qd.u0,qd.cy),w=g.X(qd.u1,qd.cy)-l,s=siteStatus(x),own=x.owner>=0;
    const o=own?G.players[x.owner]:null,val=!own?(x.surveyed[0]?siteQuality(x):money(x.lease,true)):(o.human?s.t:esc(shortName(o)));
    return `<button class="hit ${UI.sel===x.id?'sel':''}" style="left:${l}%;top:${qd.y0}%;width:${w}%;height:${qd.y1-qd.y0}%" data-act="sel" data-v="${x.id}" aria-label="${siteName(x)}: ${own?(o.human?'deine Fläche':'gehört '+esc(o.name))+', '+s.t:'frei, '+s.t}">
      <span class="stag${own?' own':''}${x.owner===0?' me':''}"${own?` style="--oc:${pc(x.owner)}"`:''}>${own?`<i class="mb">${mono(o)}</i>`:''}${siteName(x)}${own&&s.k==='bad'?'<i class="alert">!</i>':''}<span class="sval">${val}</span></span></button>`}).join('');
}
function siteQuality(x){
  const p=[];if(x.wind!=null)p.push(x.wind.toLocaleString('de-DE')+' m/s');if(x.sun!=null&&x.r!=='nd')p.push(x.sun+' kWh');if(x.r==='nd'&&x.sun)p.push(x.sun+' kWh');
  if(x.r==='al')p.push(x.hydro?'Gefälle ✓':'kein Gefälle');return p.join(' · ');
}
function btn(act,v,label,price,o={}){
  const P=me(),dis=o.dis||(price>0&&P.cash<price),key=act+':'+v;
  if(o.confirm&&UI.confirm===key)return `<button class="btn confirm" data-act="${act}" data-v="${v}" data-ok="1">Wirklich? Bestätigen</button>`;
  return `<button class="btn ${o.cls||''}" data-act="${act}" data-v="${v}" ${dis?'disabled':''}><span>${label}</span>${price?`<small>${price>0?money(price,true):'+'+money(-price,true)}</small>`:''}</button>`;
}
function detail(){
  const x=G.sites.find(s=>s.id===UI.sel);
  if(!x)return `<h3>Standort wählen</h3><p class="muted">Tipp auf eine Fläche, um Details zu sehen.</p>
    <dl class="facts"><dt>1. Pachten</dt><dd>Fläche sichern</dd><dt>2. Genehmigung</dt><dd>1–5 Quartale</dd><dt>3. Bauen</dt><dd>Standortsuche & Montage</dd><dt>4. Netz</dt><dd>Anschluss-Puzzle</dd></dl>`;
  const s=siteStatus(x),R=REG[x.r],own=x.owner>=0,mine=x.owner===0,known=mine||x.surveyed[0];
  const o=own?G.players[x.owner]:null;
  const band=own?`<div class="oband" style="--oc:${pc(x.owner)}"><i class="mb">${mono(o)}</i><span><span class="label">${mine?'Deine Fläche':'Gepachtet von'}</span><b>${esc(o.name)}</b></span></div>`
    :`<div class="oband free"><i class="mb"></i><span><span class="label">Freie Fläche</span><b>Noch nicht verpachtet</b></span></div>`;
  let f=`<dt>Region</dt><dd>${R.name}</dd><dt>Pacht</dt><dd>${money(x.lease)}</dd>`;
  if(known){if(x.wind!=null)f+=`<dt>Windgeschwindigkeit</dt><dd>${x.wind.toLocaleString('de-DE')} m/s</dd>`;if(x.sun!=null)f+=`<dt>Globalstrahlung</dt><dd>${x.sun} kWh/kWp</dd>`;if(x.r==='al')f+=`<dt>Gefälle für Wasserkraft</dt><dd>${x.hydro?'ja':'nein'}</dd>`}
  else f+=`<dt>Ertrag</dt><dd>unbekannt</dd>`;
  if(mine&&x.type){f+=`<dt>Anlage</dt><dd>${PT[x.type].name}</dd><dt>Leistung</dt><dd>${PT[x.type].mw} MW${PT[x.type].mwh?' / '+PT[x.type].mwh+' MWh':''}</dd>`;
    if(x.built)f+=`<dt>Wirkungsgrad</dt><dd>${Math.round(x.eff*100)} %</dd>`;
    if(operating(x))f+=isStore(x.type)?`<dt>Arbitrage/Quartal</dt><dd>≈ ${money(storeRevenue(x),true)}</dd>`:`<dt>Erzeugung ${QN[G.q]}</dt><dd>≈ ${mwh(genEstimate(x))}</dd>`;
    f+=`<dt>Wert</dt><dd>${money(siteValue(x),true)}</dd>`}
  const a=[];
  if(!own){if(!x.surveyed[0])a.push(btn('survey',x.id,'Ertragsgutachten',surveyCost(x)));a.push(btn('lease',x.id,'Fläche pachten',x.lease,{cls:'primary'}))}
  else if(mine){
    if(!x.type){
      R.types.forEach(t=>{if((t==='hydro'||t==='pump')&&!x.hydro)return;a.push(btn('permit',x.id+'|'+t,'Genehmigung: '+PT[t].name,PT[t].permit,{cls:t===R.types[0]?'primary':''}))});
      a.push(`<p class="muted" style="font-size:12px;margin:0">Bau ab ≈ ${R.types.filter(t=>!((t==='hydro'||t==='pump')&&!x.hydro)).map(t=>PT[t].name+' '+money(cost(t,'build'),true)).join(', ')}</p>`);
    }
    else if(x.permit==='rejected'){a.push(btn('permit',x.id+'|'+x.type,'Erneut beantragen',PT[x.type].permit,{cls:'primary'}));a.push(btn('retype',x.id,'Anderen Anlagentyp wählen',0))}
    else if(x.permit==='approved'&&!x.built){
      if(x.fail)a.push(btn('build',x.id,'Montage wiederholen',Math.round(cost(x.type,'build')*.1/1e4)*1e4,{cls:'primary'}));
      else a.push(btn('build',x.id,'Bauen: '+PT[x.type].name,cost(x.type,'build'),{cls:'primary'}));
    }
    else if(x.built&&!x.grid){const ok=freeGrid(x.r,0)>=PT[x.type].mw;a.push(btn('connect',x.id,'Ans Netz anschließen',PT[x.type].grid,{cls:'primary',dis:!ok}));if(!ok)a.push(`<p class="muted" style="font-size:12px;margin:0">Nicht genug freie Netzkapazität (${PT[x.type].mw} MW nötig). Warte auf Netzausbau oder reserviere rechtzeitig.</p>`)}
    if(x.fault&&x.grid){a.push(btn('fixSelf',x.id,'Netz selbst stabilisieren',.1e6,{cls:'primary'}));a.push(btn('fixPro',x.id,'Servicetrupp (sicher)',serviceCost(x)))}
    a.push(btn('sellSite',x.id,'Projekt verkaufen',-Math.round(siteValue(x)*.85),{cls:'danger',confirm:true}));
  }else{const lt=Object.keys(TRICK).filter(k=>trickTargets(k,0).includes(x));if(lt.length)a.push(`<button class="btn" data-act="trickGo" data-v="${x.id}|${lt[0]}"><span>Lobby-Aktion planen …</span></button>`)}
  return `${band}<div class="phead"><h3>${siteName(x)}</h3><span class="chip ${s.k}">${s.t}</span></div><dl class="facts">${f}</dl><div class="actions">${a.join('')}</div>`;
}

/* ---------- Strommarkt ---------- */
function vMarket(){
  const offers=G.offers.map(o=>`<div class="offer"><div class="top"><b>${o.buyer}</b><span class="chip acc">${eur(o.price)}</span></div>
    <div class="kv"><span>Menge <b>${mwh(o.vol)}</b>/Quartal</span><span>Laufzeit <b>${o.quarters} Q</b></span><span>Volumen <b>${money(o.vol*o.quarters*o.price,true)}</b></span></div>
    <div class="row" style="justify-content:space-between"><span class="muted" style="font-size:12px">Fehlmengen kaufst du zum Börsenpreis +15 % zu · gültig ${o.expires-G.turn} Q</span><button class="btn primary" data-act="accept" data-v="${o.id}" ${G.contracts.length>=MAX_CONTRACTS?'disabled':''}>Abschließen</button></div></div>`).join('');
  const act=G.contracts.map(c=>`<tr><td>${c.buyer}</td><td class="r num">${mwh(c.vol)}</td><td class="r num">${eur(c.price)}</td><td class="r num">${c.left}</td></tr>`).join('');
  const P=me(),next=G.sites.filter(x=>x.owner===0&&operating(x)&&!x.fault).reduce((s,x)=>s+genEstimate(x),0),need=G.contracts.reduce((s,c)=>s+c.vol,0);
  return `<div class="grid g2">
    <div class="stack" style="gap:14px">
      <section class="panel"><div class="phead"><h3>Börse</h3><span class="mono">${eur(G.price)} · Spread ${eur(G.spread)}</span></div><div class="chart" data-chart="price"></div>
      <p class="muted" style="margin:10px 0 0;font-size:13px">Strom wird automatisch zum Börsenpreis verkauft. Solarstrom erzielt im Sommer weniger, weil dann alle gleichzeitig einspeisen. Speicher verdienen am Spread zwischen billigen und teuren Stunden – je mehr Wind und Sonne im Markt, desto größer.</p></section>
      <section class="panel"><h3 style="margin-bottom:8px">Deine Lieferverpflichtung</h3>
        <dl class="facts"><dt>Erwartete Erzeugung ${QN[G.q]}</dt><dd>${mwh(next)}</dd><dt>Vertraglich gebunden</dt><dd>${mwh(need)}</dd></dl>
        ${need>next?'<span class="chip bad">Mehr verkauft als erzeugt – Zukauf droht</span>':''}</section>
    </div>
    <div class="stack" style="gap:14px">
      <section class="panel"><div class="phead"><h3>PPA-Angebote</h3><span class="muted">${G.contracts.length}/${MAX_CONTRACTS} aktiv</span></div><div class="stack">${offers}</div></section>
      <section class="panel"><h3 style="margin-bottom:8px">Laufende Verträge</h3>
      ${act?`<div class="tw"><table class="t"><thead><tr><th>Abnehmer</th><th class="r">je Q</th><th class="r">Preis</th><th class="r">Rest</th></tr></thead><tbody>${act}</tbody></table></div>`:'<p class="muted" style="margin:0">Keine. Ein Power Purchase Agreement sichert dir einen festen Preis, verlangt aber die volle Menge.</p>'}</section>
    </div></div>`;
}

/* ---------- Bank ---------- */
function vBank(){
  const P=me(),lim=creditLimit(P),free=Math.max(0,lim-P.loan);
  return `<div class="grid g2e"><section class="panel stack"><h2>Hausbank</h2>
    <dl class="facts"><dt>Kredit</dt><dd>${money(P.loan)}</dd><dt>Kreditrahmen</dt><dd>${money(lim)}</dd><dt>Noch verfügbar</dt><dd>${money(free)}</dd><dt>Zinsen</dt><dd>1,2 % / Quartal</dd><dt>Zinslast</dt><dd>${money(P.loan*INTEREST)} / Quartal</dd></dl>
    <div class="row">${[5e6,20e6,50e6].map(a=>`<button class="btn" data-act="borrow" data-v="${a}" ${free<a?'disabled':''}>+ ${money(a,true)}</button>`).join('')}</div>
    <div class="row">${[5e6,20e6].map(a=>`<button class="btn" data-act="repay" data-v="${a}" ${P.loan<a||P.cash<a?'disabled':''}>${money(a,true)} tilgen</button>`).join('')}<button class="btn" data-act="repay" data-v="all" ${!P.loan||P.cash<P.loan?'disabled':''}>Alles tilgen</button></div>
  </section><section class="panel"><h3 style="margin-bottom:8px">Projektfinanzierung</h3>
    <p class="muted" style="margin:0 0 8px">Der Rahmen beträgt 60 % deiner Vermögenswerte, mindestens ${money(20e6)}. Erneuerbare sind kapitalintensiv: Ein Offshore-Park lässt sich kaum ohne Kredit bauen.</p>
    <p class="muted" style="margin:0">Rutscht die Kasse zum Quartalsende ins Minus, gibt es einen Notkredit. Reicht der Rahmen nicht, ist dein Konzern insolvent.</p></section></div>`;
}

/* ---------- Lobby ---------- */
function vLobby(){
  const T=TRICK[UI.trick],ts=trickTargets(UI.trick,0);
  if(UI.target&&!ts.find(x=>x.id===UI.target))UI.target='';
  const opts=ts.map(x=>`<option value="${x.id}" ${UI.target===x.id?'selected':''}>${siteName(x)} · ${PT[x.type].name} · ${esc(G.players[x.owner].name)}</option>`).join('');
  return `<div class="grid g2"><section class="panel stack">
    <div class="phead"><h2>Lobby & Tricks</h2><span class="muted">${2-G.trickUsed} Aktionen in diesem Quartal übrig</span></div>
    <div class="sab">${Object.entries(TRICK).map(([k,s])=>`<button class="sabopt" aria-pressed="${UI.trick===k}" data-act="trick" data-v="${k}"><b>${s.name}</b><span class="mono">${money(s.cost,true)} · ${Math.round(s.chance*100)} %</span><span class="muted" style="font-size:12px">${s.desc}</span></button>`).join('')}</div>
    <label for="trickTarget" class="label">Ziel</label>
    <select id="trickTarget" data-act="trickTarget">${ts.length?'<option value="">Projekt wählen …</option>'+opts:'<option value="">Gerade kein passendes Ziel</option>'}</select>
    <div class="row"><button class="btn primary big" data-act="doTrick" ${!UI.target||me().cash<T.cost||G.trickUsed>=2?'disabled':''}>Auftrag vergeben · ${money(T.cost,true)}</button></div>
  </section><section class="panel"><h3 style="margin-bottom:8px">Risiko</h3>
    <p class="muted" style="margin:0 0 8px">Eine Klage ist legal: Scheitert sie, ist nur das Geld weg. Eine aufgeflogene Bürgerinitiative kostet ${money(TRICK.bi.fine,true)} Imageschaden, ein aufgeflogener Hackerangriff ${money(TRICK.hack.fine,true)} Strafe.</p>
    <p class="muted" style="margin:0">Sicherer spielst du mit Netzreservierungen unter Standorte: Wer die Kapazität hat, bekommt den Anschluss.</p></section></div>`;
}

/* ---------- Konkurrenz & Nachrichten ---------- */
function vRivals(){
  const rows=G.players.slice().sort((a,b)=>(a.out-b.out)||(worth(b)-worth(a))).map(p=>{
    const mine=G.sites.filter(x=>x.owner===p.id);
    return `<tr><td><span class="row" style="flex-wrap:nowrap"><i class="dot" style="--oc:${pc(p.id)}"></i>${esc(p.name)}${p.human?' <span class="chip acc">Du</span>':''}${p.out?' <span class="chip bad">Insolvent</span>':''}</span></td>
    <td class="r num">${p.out?'–':money(worth(p),true)}</td><td class="r num">${money(p.cash,true)}</td><td class="r num">${money(p.loan,true)}</td><td class="r num">${mine.length}</td><td class="r num">${mwOf(p)} MW</td><td class="r num">${mwh(p.genLast)}</td><td class="r num">${tons(p.co2)}</td></tr>`}).join('');
  return `<section class="panel"><div class="phead"><h2>Konkurrenz</h2><span class="muted">Stand ${qStr(G.year,G.q)}</span></div>
  <div class="tw"><table class="t"><thead><tr><th>Konzern</th><th class="r">Vermögen</th><th class="r">Kasse</th><th class="r">Kredit</th><th class="r">Flächen</th><th class="r">Leistung</th><th class="r">Erzeugung</th><th class="r">CO₂ vermieden</th></tr></thead><tbody>${rows}</tbody></table></div></section>
  <section class="panel" style="margin-top:14px"><h3 style="margin-bottom:8px">Verlauf</h3><div class="chart" data-chart="worth"></div></section>`;
}
function vNews(){
  const k={bad:'bad',world:'warn',sab:'warn',comp:'acc',info:''},l={bad:'Gegen dich',world:'Welt',sab:'Lobby',comp:'Konkurrenz',info:'Info'};
  return `<section class="panel"><h2 style="margin-bottom:8px">Nachrichten</h2><ul class="list">${G.news.map(n=>`<li><span class="mono muted" style="font-size:12px;min-width:62px">${n.d}</span><span class="chip ${k[n.kind]||''}">${l[n.kind]||'Info'}</span><span>${n.text}</span></li>`).join('')}</ul></section>`;
}

/* ================= Diagramme ================= */
function drawChart(el){
  const type=el.dataset.chart;let series;
  if(type==='price')series=[{name:'Strompreis',color:'var(--c0)',vals:G.priceHist,fmt:v=>eur(v)},{name:'Speicher-Spread',color:'var(--c3)',vals:G.spreadHist,fmt:v=>eur(v)}];
  else series=G.players.map(p=>({name:p.name,color:pc(p.id),vals:p.hist,fmt:v=>money(v)}));
  const labels=G.labels,Wd=Math.max(280,el.clientWidth||600),Ht=type==='price'?180:230,ml=58,mr=100,mt=10,mb=24,n=labels.length;
  const all=series.flatMap(s=>s.vals.filter(v=>v!=null));
  let lo=Math.min(0,...all),hi=Math.max(...all,1);const step=niceStep((hi-lo)/4);hi=Math.ceil(hi/step)*step;lo=Math.floor(lo/step)*step;
  const X=i=>ml+(n<=1?0:i/(n-1))*(Wd-ml-mr),Y=v=>mt+(1-(v-lo)/(hi-lo))*(Ht-mt-mb);
  let s=`<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${type==='price'?'Strompreis und Speicher-Spread':'Nettovermögen'}">`;
  for(let v=lo;v<=hi+1e-9;v+=step)s+=`<line class="gridl" x1="${ml}" x2="${Wd-mr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${ml-6}" y="${Y(v)+4}" text-anchor="end">${type==='price'?Math.round(v)+' €':axisMoney(v)}</text>`;
  const every=Math.max(1,Math.ceil(n/6));labels.forEach((l,i)=>{if(i%every===0)s+=`<text class="axis" x="${X(i)}" y="${Ht-6}" text-anchor="middle">${l}</text>`});
  {const se=series[0],pts=se.vals.map((v,i)=>v==null?null:[X(i),Y(v)]).filter(Boolean);
    if(pts.length>1){const gid='ag'+type;s+=`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${se.color};stop-opacity:.22"/><stop offset="1" style="stop-color:${se.color};stop-opacity:0"/></linearGradient></defs><path d="M${pts[0][0]} ${Y(Math.max(lo,0))}${pts.map(p=>'L'+p[0].toFixed(1)+' '+p[1].toFixed(1)).join('')}L${pts[pts.length-1][0]} ${Y(Math.max(lo,0))}Z" fill="url(#${gid})"/>`}}
  series.forEach(se=>{let d='',pen=false;se.vals.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1);pen=true});s+=`<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se===series[0]?2.6:2}" stroke-linejoin="round" stroke-linecap="round"/>`});
  const ends=series.map(se=>({se,i:se.vals.length-1,v:se.vals[se.vals.length-1]})).filter(e=>e.v!=null);
  const ly=ends.map(e=>({e,y:Y(e.v)})).sort((a,b)=>a.y-b.y);for(let k=1;k<ly.length;k++)if(ly[k].y-ly[k-1].y<13)ly[k].y=ly[k-1].y+13;
  ly.forEach(({e,y})=>{s+=`<circle cx="${X(e.i)}" cy="${Y(e.v)}" r="4" fill="${e.se.color}" stroke="var(--surface)" stroke-width="2"/><text x="${X(e.i)+8}" y="${y+4}" font-size="11" fill="var(--muted)" font-family="var(--sans)">${esc(e.se.name.split(' ')[0])}</text>`});
  s+=`<line id="xh" x1="0" x2="0" y1="${mt}" y2="${Ht-mb}" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/></svg>`;
  const legend=`<div class="legend">${series.map(se=>`<span><i class="dot" style="--oc:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>`;
  el.innerHTML=legend+s+'<div class="tip" hidden></div>';
  const svg=el.querySelector('svg'),tip=el.querySelector('.tip'),xh=svg.querySelector('#xh');
  svg.addEventListener('pointermove',e=>{const r=svg.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*Wd,i=clamp(Math.round((sx-ml)/(Wd-ml-mr)*(n-1)),0,n-1);
    xh.setAttribute('x1',X(i));xh.setAttribute('x2',X(i));xh.setAttribute('visibility','visible');
    tip.innerHTML=`<b>${labels[i]}</b>`+series.filter(se=>se.vals[i]!=null).sort((a,b)=>b.vals[i]-a.vals[i]).map(se=>`<div><span class="row" style="gap:6px"><i class="dot" style="--oc:${se.color}"></i>${esc(se.name)}</span><span class="mono">${se.fmt(se.vals[i])}</span></div>`).join('');
    tip.hidden=false;tip.style.left=Math.max(0,Math.min(X(i)/Wd*r.width+12,r.width-tip.offsetWidth))+'px';tip.style.top='24px'});
  svg.addEventListener('pointerleave',()=>{tip.hidden=true;xh.setAttribute('visibility','hidden')});
}
function niceStep(r){const p=Math.pow(10,Math.floor(Math.log10(r||1)));const f=r/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p}
function axisMoney(v){const a=Math.abs(v);return a>=1e9?(v/1e9).toLocaleString('de-DE',{maximumFractionDigits:1})+' Mrd':a>=1e6?Math.round(v/1e6)+' Mio':a>=1e3?Math.round(v/1e3)+' T':String(v)}

/* ================= Modal ================= */
let modalLocked=false;
function openModal(html,o={}){const c=$('#mcard');c.className='mcard'+(o.wide?' wide':'');c.innerHTML=html;$('#modal').hidden=false;modalLocked=!!o.locked;const f=c.querySelector('input,button');f&&f.focus();registerScenes();countUp(c)}
function closeModal(){$('#modal').hidden=true;$('#mcard').innerHTML='';modalLocked=false}
let toastT;function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,2600)}
function showReport(rep){
  const lines=rep.lines.map(([l,v])=>`<span>${esc(l)}</span><span class="v ${v<0?'down':''}" data-count="${v}">${money(v)}</span>`).join('');
  const P=me(),big=RK.map(r=>({r,mw:G.sites.filter(x=>x.r===r&&x.owner===0&&operating(x)).reduce((a,x)=>a+PT[x.type].mw,0)})).sort((a,b)=>b.mw-a.mw)[0];
  const br=big.mw?big.r:UI.region;
  const ev=rep.events.map(e=>`<li><span class="chip ${e.kind}">${{bad:'Achtung',warn:'Ereignis',good:'Gut',info:'Info'}[e.kind]||'Info'}</span><span>${e.text}</span></li>`).join('');
  const pq=G.q===0?qStr(G.year-1,3):qStr(G.year,G.q-1);
  const delta=rep.end-rep.start;
  openModal(`<div class="banner"><canvas data-scene="${br}" data-mini="1" aria-hidden="true"></canvas><div class="bcap"><span class="label">Quartalsbericht</span><h2>${pq}</h2></div><div class="bdelta ${delta<0?'neg':''}"><span class="label">Kasse</span><b data-count="${delta}">${money(delta)}</b></div></div>
    <div class="rep"><span>Erzeugung</span><span class="v" data-count="${rep.gen}" data-fmt="mwh">${mwh(rep.gen)}</span><span>Ø Börsenpreis</span><span class="v">${eur(rep.price)}</span>${lines}
    <span class="sum">Veränderung Kasse</span><span class="v sum ${delta<0?'down':'up'}" data-count="${delta}">${money(delta)}</span></div>
    ${ev?`<ul class="list">${ev}</ul>`:''}${compLog()}<div class="foot"><button class="btn primary" data-act="closeReport">Weiter</button></div>`);
  if(rep.events.some(e=>e.kind==='bad'))SND.alarm();else if(delta>=0)SND.coin();else SND.report();
}
function compLog(){
  const L=G.clog||[];
  return `<details class="comp" ${L.length?'open':''}><summary><b>Konkurrenz</b> <span class="muted">${L.length?L.length+' Aktionen':'ruhiges Quartal'}</span></summary><ul class="list">${L.map(c=>`<li><i class="dot" style="--oc:${pc(c.id)};margin-top:5px"></i><span>${c.t}</span></li>`).join('')}</ul></details>`;
}
function showEnd(){
  const reason={time:'Die Zeit ist um.',monopoly:'Alle Konkurrenten sind insolvent!',bankrupt:'Dein Konzern ist insolvent.'}[G.over];
  const rank=G.players.slice().sort((a,b)=>(a.out-b.out)||(worth(b)-worth(a)));const won=G.over!=='bankrupt'&&rank[0].human;
  openModal(`<h2>${won?'Du führst die Energiewende an!':'Spielende'}</h2><p class="muted" style="margin:0">${reason} Du hast ${tons(me().co2)} CO₂ vermieden.</p>
    <div class="tw"><table class="t"><thead><tr><th>#</th><th>Konzern</th><th class="r">Vermögen</th><th class="r">CO₂ vermieden</th></tr></thead><tbody>
    ${rank.map((p,i)=>`<tr><td class="num">${i+1}</td><td><span class="row" style="flex-wrap:nowrap"><i class="dot" style="--oc:${pc(p.id)}"></i>${esc(p.name)}</span></td><td class="r num">${p.out?'insolvent':money(worth(p),true)}</td><td class="r num">${tons(p.co2)}</td></tr>`).join('')}</tbody></table></div>
    <div class="foot"><button class="btn" data-act="closeModal">Endstand ansehen</button><button class="btn primary" data-act="newGameDlg">Neues Spiel</button></div>`);
}
function showStart(){
  const has=!!loadSave()&&G&&G.turn>0;
  openModal(`<div class="banner tall"><canvas data-scene="nd" data-mini="1" aria-hidden="true"></canvas><div class="bcap"><span class="label">2026 – 2035</span><h2 class="title">${LOGO}Wattmogul</h2></div></div>
    <p style="margin:0">2026. Vier Energiekonzerne ringen um die besten Flächen Europas: Wind an der Küste, Offshore-Parks in der Nordsee, Solar in Iberien, Wasserkraft in den Alpen. Pachten, genehmigen lassen, bauen, ans Netz bringen – und der Konkurrenz ab und zu eine Klage an den Hals hängen.</p>
    <div class="field-grid">
      <label for="sName">Konzernname<input type="text" id="sName" value="${esc(G&&G.turn===0?me().name:'Deichwatt AG')}" maxlength="24"></label>
      <div class="field-grid-info"><span class="label">Spieldauer</span><b>${GAME_YEARS} Jahre · ${GAME_YEARS*4} Quartale</b><span class="muted">2026 bis Ende 2035</span></div>
    </div>
    <label class="check"><input type="checkbox" id="sAuto"> Minispiele überspringen (Ergebnis wird ausgewürfelt)</label>
    <p class="muted" style="margin:0;font-size:12px">Alle Firmen und Personen im Spiel sind frei erfunden. Ereignisse nach 2026 sind fiktive Szenarien. Dein Spielstand wird nur lokal in Deinem Browser gespeichert.</p>
    <div class="foot"><a class="btn" href="/power-tycoon/" style="margin-right:auto;text-decoration:none;color:inherit">← Zurück</a>${has?'<button class="btn" data-act="continue">Weiterspielen</button>':''}<button class="btn primary big" data-act="start">Spiel starten</button></div>`);
}

/* ================= Aktionen ================= */
const gs=id=>G.sites.find(s=>s.id===id);
function pay(c){const P=me();if(P.cash<c){toast('Nicht genug Geld. Die Bank hilft mit einem Kredit.');return false}P.cash-=c;return true}
const A={
  tab:v=>{UI.tab=v;render();window.scrollTo({top:0})},
  region:v=>{UI.region=v;UI.sel=null;UI.confirm=null;render()},
  sel:v=>{UI.sel=v;UI.confirm=null;render();if(window.innerWidth<980)$('#detail').scrollIntoView({behavior:'smooth',block:'start'})},
  goRegion:v=>{UI.tab='sites';UI.region=v;UI.sel=null;render();window.scrollTo({top:0})},
  sound:()=>toggleSound(),
  goSite:v=>{const x=gs(v);UI.tab='sites';UI.region=x.r;UI.sel=v;render()},
  endQuarter:()=>{if(!modalLocked)endQuarter()},
  closeReport:()=>{closeModal();if(G.over)showEnd()},
  closeModal:()=>closeModal(),
  newGameDlg:()=>showStart(),
  start:()=>{newGame({name:$('#sName').value.trim()||'Deichwatt AG',autoMini:$('#sAuto').checked});UI.tab='overview';UI.sel=null;closeModal();render()},
  continue:()=>{closeModal();render()},
  survey:v=>{const x=gs(v);if(!pay(surveyCost(x)))return;survey(x,0);toast('Gutachten '+siteName(x)+': '+siteQuality(x));render()},
  lease:v=>{const x=gs(v);if(x.owner>=0||!pay(x.lease))return;x.owner=0;SND.coin();news('Du pachtest '+siteName(x)+' in '+REG[x.r].name+' für '+money(x.lease)+'.','info');render()},
  permit:v=>{const[id,t]=v.split('|'),x=gs(id);if(!pay(PT[t].permit))return;x.type=t;x.permit='pending';x.permitLeft=randint(...PT[t].permitQ);toast('Antrag gestellt. Bescheid in '+x.permitLeft+' Quartal'+(x.permitLeft>1?'en':'')+'.');render()},
  retype:v=>{const x=gs(v);x.type=null;x.permit=null;render()},
  build:async v=>{
    const x=gs(v),t=x.type,wind=PT[t].cls==='wind';
    if(x.fail){const c=Math.round(cost(t,'build')*.1/1e4)*1e4;if(!pay(c))return;render();const ok=await miniRotor(x);if(ok){x.fail=false;x.built=true}render();return}
    const c=cost(t,'build');if(!pay(c))return;x.invested=c;render();
    if(wind||t==='solar'){x.eff=await miniLayout(x)}else x.eff=1;
    if(wind){const ok=await miniRotor(x);if(!ok){x.fail=true;render();return}}
    x.built=true;SND.clank();news(PT[t].name+' auf '+siteName(x)+' fertig gebaut.','info');
    openModal(`<h2>${PT[t].name} steht</h2><p style="margin:0">Jetzt fehlt nur noch der Netzanschluss (${PT[t].mw} MW, frei in ${REG[x.r].name}: ${Math.max(0,freeGrid(x.r,0))} MW).</p><div class="foot"><button class="btn" data-act="closeModal">Später</button><button class="btn primary" data-act="connectNow" data-v="${x.id}" ${freeGrid(x.r,0)<PT[t].mw?'disabled':''}>Anschließen · ${money(PT[t].grid,true)}</button></div>`);
    render();
  },
  connect:async v=>{const x=gs(v),mw=PT[x.type].mw;if(freeGrid(x.r,0)<mw){toast('Keine freie Netzkapazität.');return}if(!pay(PT[x.type].grid))return;render();
    const ok=await miniCable(x);if(ok){x.grid=true;SND.zap();consumeReserve(x.r,0,mw);news(siteName(x)+' speist ins Netz ein.','info')}toast(ok?'Am Netz!':'Anschluss gescheitert.');render()},
  fixSelf:async v=>{const x=gs(v);if(!pay(.1e6))return;render();const ok=await miniFreq(x);if(ok)x.fault=false;render()},
  fixPro:v=>{const x=gs(v);if(!pay(serviceCost(x)))return;x.fault=false;toast('Der Servicetrupp hat die Störung behoben.');render()},
  sellSite:(v,el)=>{if(el.dataset.ok!=='1'){UI.confirm='sellSite:'+v;render();return}const x=gs(v),val=Math.round(siteValue(x)*.85);me().cash+=val;news('Du verkaufst '+siteName(x)+' für '+money(val)+'.','info');resetSite(x);UI.confirm=null;render()},
  reserve:v=>{if(freeGrid(v,0)<50||!pay(.8e6))return;G.res.push({pid:0,r:v,mw:50,left:4});toast('50 MW in '+REG[v].name+' für vier Quartale reserviert.');render()},
  accept:v=>{if(G.contracts.length>=MAX_CONTRACTS)return;const o=G.offers.find(o=>o.id===+v);if(!o)return;G.offers=G.offers.filter(q=>q!==o);G.contracts.push({...o,left:o.quarters});news('PPA mit '+o.buyer+': '+mwh(o.vol)+' je Quartal zu '+eur(o.price)+'.','info');toast('Vertrag geschlossen.');render()},
  borrow:v=>{const P=me(),a=+v;if(P.loan+a>creditLimit(P))return;P.loan+=a;P.cash+=a;toast(money(a)+' Kredit aufgenommen.');render()},
  repay:v=>{const P=me(),a=v==='all'?P.loan:Math.min(+v,P.loan);if(P.cash<a)return;P.cash-=a;P.loan-=a;toast(money(a)+' getilgt.');render()},
  trick:v=>{UI.trick=v;render()},
  trickTarget:(v,el)=>{UI.target=el.value;render()},
  trickGo:v=>{const[id,t]=v.split('|');UI.tab='lobby';UI.trick=t;UI.target=id;render()},
  doTrick:()=>{
    const T=TRICK[UI.trick],x=gs(UI.target);if(!x||G.trickUsed>=2||!pay(T.cost))return;G.trickUsed++;
    let h;
    if(Math.random()<T.chance){const m=applyTrick(UI.trick,x);news('Lobby-Erfolg: '+m,'sab');h=`<h2>Auftrag ausgeführt</h2><p style="margin:0">${m}</p>`}
    else{const caught=T.fine&&Math.random()<.4;if(caught){me().cash-=T.fine;news('Deine Aktion „'+T.name+'“ flog auf. Kosten: '+money(T.fine)+'.','bad')}
      h=`<h2>Hat nicht geklappt</h2><p style="margin:0">${caught?'Die Presse hat Wind davon bekommen. Das kostet dich '+money(T.fine)+'.':UI.trick==='klage'?'Das Gericht hat die Klage abgewiesen.':'Niemand weiß, wer dahintersteckt.'}</p>`}
    openModal(h+'<div class="foot"><button class="btn primary" data-act="closeModal">OK</button></div>');UI.target='';render()}
};
A.connectNow=v=>{closeModal();A.connect(v)};

document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.tagName==='SELECT'||el.type==='checkbox')return;if(el.tagName==='BUTTON'&&el.dataset.act!=='sound')SND.click();if(el.closest('#modal')===null&&modalLocked)return;const f=A[el.dataset.act];if(f){e.preventDefault();f(el.dataset.v,el)}});
document.addEventListener('change',e=>{const el=e.target.closest('[data-act]');if(el&&(el.tagName==='SELECT'||el.type==='checkbox')){const f=A[el.dataset.act];f&&f(el.dataset.v,el)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden&&!modalLocked){if($('[data-act="closeReport"]'))A.closeReport();else if($('[data-act="closeModal"]'))closeModal()}});
let rzT;window.addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(G){$('#view').querySelectorAll('[data-chart]').forEach(drawChart);registerScenes()}},150)});
document.addEventListener('pointerover',e=>{const h=e.target.closest&&e.target.closest('.hit'),v=h?h.dataset.v:null;if(v!==HOV){HOV=v;if(RMO)SC.forEach(S=>drawScene(S,0))}});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>readCols());

function boot(data){
  if(data&&data.G){G=data.G;Object.assign(UI,data.UI||{});render();return}
  const s=loadSave();
  if(s){G=s;if(G.endYear>G.startYear+GAME_YEARS){G.endYear=G.startYear+GAME_YEARS;if(!G.over&&G.year>=G.endYear)G.over='time'}render();if(G.over)showEnd();else if(!(location.search==='?continue'&&G.turn>0))showStart();return}
  newGame({name:'Deichwatt AG'});render();showStart();
}
window.claude?.hot?.snapshot?.(()=>({G,UI}));
window.claude?.hot?.ready?window.claude.hot.ready(boot):boot(window.claude?.hot?.data??{});
