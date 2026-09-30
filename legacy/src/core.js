'use strict';
/* ================= Daten ================= */
const REG={
  nd:{code:'ND',name:'Norddeutschland',wind:[5.8,7.8],sun:[950,1150],types:['wind','solar','batt'],grid:300,lease:[.4,1.6],desc:'Kräftiger Wind und viel Fläche, aber lange Genehmigungen und streitlustige Bürgerinitiativen.'},
  ns:{code:'NS',name:'Nordsee',wind:[8.6,10.4],types:['off'],grid:600,lease:[2,6],desc:'Offshore-Flächen mit dem stärksten Wind Europas. Nur etwas für große Bilanzen.'},
  ib:{code:'IB',name:'Iberien',wind:[5.2,7.4],sun:[1550,1950],types:['solar','wind','batt'],grid:400,lease:[.3,1.4],desc:'Sonne satt: Solarparks liefern hier fast doppelt so viel wie im Norden.'},
  al:{code:'AL',name:'Alpen',sun:[1150,1450],types:['hydro','pump','solar','batt'],grid:300,lease:[.6,2.2],hydro:.45,desc:'Gefälle für Wasserkraft und Pumpspeicher, dazu klare Höhensonne.'}
};
const RK=['nd','ns','ib','al'];
const PT={
  wind:{name:'Windpark',mw:24,build:20e6,permit:.3e6,grid:1.2e6,opex:.12e6,permitQ:[2,4],reject:.2,learn:.015,cls:'wind'},
  off:{name:'Offshore-Windpark',mw:80,build:110e6,permit:1.2e6,grid:8e6,opex:.7e6,permitQ:[2,4],reject:.1,learn:.02,cls:'wind'},
  solar:{name:'Solarpark',mw:30,build:15e6,permit:.15e6,grid:.8e6,opex:.06e6,permitQ:[1,1],reject:.05,learn:.04,cls:'solar'},
  batt:{name:'Batteriespeicher',mw:50,mwh:100,cycles:150,eta:.85,build:24e6,permit:.1e6,grid:.6e6,opex:.08e6,permitQ:[1,1],reject:.03,learn:.07,cls:'store'},
  hydro:{name:'Laufwasserkraftwerk',mw:12,build:18e6,permit:.4e6,grid:.5e6,opex:.1e6,permitQ:[3,5],reject:.25,learn:0,cls:'hydro'},
  pump:{name:'Pumpspeicherwerk',mw:120,mwh:800,cycles:80,eta:.75,build:60e6,permit:.8e6,grid:1.5e6,opex:.3e6,permitQ:[3,5],reject:.25,learn:0,cls:'store'}
};
const SEASON={wind:[1.3,.85,.7,1.15],solar:[.55,1.35,1.45,.65],hydro:[.8,1.3,1.1,.8]};
const CAPTURE={wind:[.92,.9,.9,.92],solar:[.95,.8,.78,.95],hydro:[1,1,1,1]};
const PRICE_SEASON=[1.12,.92,.9,1.06];
const GAME_YEARS=10,HOURS=2190, INTEREST=.012, MAX_CONTRACTS=3, CO2=.4;
const TRICK={
  klage:{name:'Klage gegen Genehmigung',cost:.5e6,chance:.7,fine:0,desc:'Anwälte fechten eine Genehmigung an. Das Projekt verzögert sich um zwei Quartale, manchmal kippt es ganz.'},
  bi:{name:'Bürgerinitiative anstiften',cost:.4e6,chance:.65,fine:1.5e6,desc:'Anwohner erzwingen Auflagen: Ein Wind- oder Solarpark läuft zwei Quartale nur mit halber Leistung.'},
  hack:{name:'Hackerangriff',cost:.8e6,chance:.6,fine:5e6,desc:'Die Leitwarte eines Kraftwerks fällt aus. Es liefert nichts, bis der Betreiber das Netz stabilisiert.'}
};
const QN=['Q1','Q2','Q3','Q4'];
const BUYERS=['Stahlwerk Qualmstedt','Rechenzentrum Byteburg','Chemiepark Rührbach','Bahnstrom Schienenhausen','Aluhütte Blechingen','Elektrolyse Blubberhafen','Glaswerk Scherbenau','Kühlhaus Frosthagen','Papierfabrik Knitterfeld','Batteriewerk Akkuwitz'];
const AI_DEF=[
  {name:'Möwenkraft AG',pref:['nd','nd','ns','ns','ib']},
  {name:'Siestasol S.A.',pref:['ib','ib','ib','al','nd']},
  {name:'Gletscherwerk Holding',pref:['al','al','nd','ib','ns']}
];
const HIST=[
  {y:2028,q:0,t:'Emissionshandel für Gebäude und Verkehr startet. Fossile Energie wird teurer.',f:()=>{G.target*=1.08}},
  {y:2030,q:0,t:'Zieljahr 2030: Die Netzbetreiber schalten in allen Regionen 150 MW zusätzliche Kapazität frei.',f:()=>{RK.forEach(r=>G.grid[r]+=150)}},
  {y:2031,q:2,t:'Wasserstoff-Boom: Elektrolyseure fragen massenhaft Grünstrom nach.',f:()=>{G.target*=1.15;G.ppaBoost=1.6}},
  {y:2033,q:0,t:'Das letzte deutsche Kohlekraftwerk geht vom Netz. Flexibilität wird knapp.',f:()=>{G.target*=1.1;G.spreadAdd+=20}},
  {y:2035,q:0,t:'Die EU verschärft ihr Klimaziel für 2040. Grünstrom ist gefragter denn je.',f:()=>{G.target*=1.06}}
];

/* ================= Helfer ================= */
const $=s=>document.querySelector(s);
const rand=(a,b)=>a+Math.random()*(b-a);
const randint=(a,b)=>Math.floor(rand(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gauss=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function money(n,short){
  const a=Math.abs(n),s=n<0?'−':'';
  if(a>=1e9)return s+(a/1e9).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' Mrd. €';
  if(a>=1e6)return s+(a/1e6).toLocaleString('de-DE',{minimumFractionDigits:short?1:2,maximumFractionDigits:short?1:2})+' Mio. €';
  if(a>=1e3)return s+Math.round(a/1e3).toLocaleString('de-DE')+' Tsd. €';
  return s+Math.round(a)+' €';
}
const mwh=n=>n>=1e6?(n/1e6).toLocaleString('de-DE',{maximumFractionDigits:2})+' TWh':n>=1e3?(n/1e3).toLocaleString('de-DE',{maximumFractionDigits:1})+' GWh':Math.round(n).toLocaleString('de-DE')+' MWh';
const eur=n=>n.toLocaleString('de-DE',{minimumFractionDigits:0,maximumFractionDigits:0})+' €/MWh';
const tons=n=>n>=1e6?(n/1e6).toLocaleString('de-DE',{maximumFractionDigits:2})+' Mio. t':Math.round(n).toLocaleString('de-DE')+' t';
const qStr=(y,q)=>QN[q]+' '+y;

/* ================= Zustand ================= */
let G=null;
const UI={tab:'overview',region:'nd',sel:null,trick:'klage',target:'',confirm:null};
const yearsIn=()=>G.year-2026+G.q/4;
const learnF=t=>Math.pow(1-PT[t].learn,yearsIn());
const cost=(t,k)=>Math.round(PT[t][k]*(k==='build'?learnF(t):1)/1e4)*1e4;
const serviceCost=x=>Math.round(PT[x.type].build*.04/1e4)*1e4;

function makeSite(r,i){
  const R=REG[r];
  const s={id:r+i,r,i,owner:-1,type:null,permit:null,permitLeft:0,built:false,fail:false,grid:false,eff:1,fault:false,curtail:0,invested:0,age:0,surveyed:{}};
  s.wind=R.wind?Math.round(rand(R.wind[0],R.wind[1])*10)/10:null;
  s.sun=R.sun?Math.round(rand(R.sun[0],R.sun[1])/10)*10:null;
  s.hydro=R.hydro?Math.random()<R.hydro:false;
  let q=0.5;
  if(r==='ns'||r==='nd')q=(s.wind-R.wind[0])/(R.wind[1]-R.wind[0]);
  else if(r==='ib')q=(s.sun-R.sun[0])/(R.sun[1]-R.sun[0]);
  else q=(s.hydro?.7:.2)+Math.random()*.3;
  s.lease=Math.round((R.lease[0]+(R.lease[1]-R.lease[0])*(.5*q+.5*Math.random()))*1e6/5e4)*5e4;
  return s;
}
function mkPlayer(id,name,human){return {id,name,human,cash:30e6,loan:0,out:false,hist:[],genLast:0,co2:0,revLast:0}}
function newGame(o){
  const players=[mkPlayer(0,o.name||'Mein Konzern',true)];
  AI_DEF.forEach((a,i)=>players.push(mkPlayer(i+1,a.name,false)));
  const sites=[];RK.forEach(r=>{for(let i=0;i<16;i++)sites.push(makeSite(r,i))});
  const grid={};RK.forEach(r=>grid[r]=REG[r].grid);
  G={v:1,year:2026,q:0,startYear:2026,endYear:2026+GAME_YEARS,turn:0,players,sites,grid,res:[],
    base:85,target:85,price:85*PRICE_SEASON[0],spread:50,spreadAdd:0,ppaBoost:1,fx:null,
    priceHist:[],spreadHist:[],labels:[],offers:[],contracts:[],news:[],trickUsed:0,nextId:1,over:false,
    settings:{autoMini:!!o.autoMini}};
  updateSpread();
  G.priceHist.push(Math.round(G.price));G.spreadHist.push(Math.round(G.spread));G.labels.push('Q1 26');
  genOffers();
  players.forEach(p=>p.hist.push(worth(p)));
  news('Willkommen! '+esc(players[0].name)+' startet mit '+money(30e6)+' Eigenkapital. Drei Konkurrenten wollen dieselben Flächen.','info');
  news('Tipp: Ein Ertragsgutachten vor der Pacht verrät Windgeschwindigkeit oder Sonnenstunden.','info');
}
function news(text,kind){G.news.unshift({d:QN[G.q]+' '+G.year,text,kind:kind||'info'});if(G.news.length>80)G.news.pop()}
const me=()=>G.players[0];
const mono=p=>p.human?'★':(p.name.trim()[0]||'?').toUpperCase();
const shortName=p=>p.human?'Du':p.name.split(' ')[0];
const siteName=x=>REG[x.r].code+'-'+String(x.i+1).padStart(2,'0');
const operating=x=>x.owner>=0&&x.built&&x.grid;
const isStore=t=>PT[t].cls==='store';

function capFactor(x){
  const t=x.type;
  if(t==='wind'||t==='off')return .08+(x.wind-4.5)*.075;
  if(t==='solar')return x.sun/8760;
  if(t==='hydro')return .5;
  return 0;
}
function genEstimate(x,q){
  if(!x.type||isStore(x.type))return 0;
  const cls=PT[x.type].cls;const fx=G.fx&&G.fx[cls]!=null?G.fx[cls]:1;
  return PT[x.type].mw*HOURS*capFactor(x)*SEASON[cls][q??G.q]*x.eff*(x.curtail>0?.5:1)*(q==null?fx:1);
}
function storeRevenue(x){const P=PT[x.type];return P.mwh*P.cycles*G.spread*P.eta*x.eff}
function usedGrid(r,pid){return G.sites.filter(x=>x.r===r&&x.grid&&(pid==null||x.owner===pid)).reduce((s,x)=>s+PT[x.type].mw,0)}
function reserved(r,exceptPid){return G.res.filter(o=>o.r===r&&o.pid!==exceptPid).reduce((s,o)=>s+o.mw,0)}
function myReserve(r,pid){return G.res.filter(o=>o.r===r&&o.pid===pid).reduce((s,o)=>s+o.mw,0)}
function freeGrid(r,pid){return G.grid[r]-usedGrid(r)-reserved(r,pid)}
function consumeReserve(r,pid,mw){for(const o of G.res){if(o.r===r&&o.pid===pid&&mw>0){const t=Math.min(o.mw,mw);o.mw-=t;mw-=t}}G.res=G.res.filter(o=>o.mw>0)}

function siteValue(x){
  let v=x.lease*.6;
  if(x.permit==='approved'||x.built)v+=PT[x.type].permit;
  if(x.built)v+=x.invested*Math.max(.35,1-x.age/100);
  if(x.grid)v+=PT[x.type].grid*.8;
  return v;
}
function worth(p){let v=p.cash-p.loan;G.sites.forEach(x=>{if(x.owner===p.id)v+=siteValue(x)});return Math.round(v)}
function creditLimit(p){return Math.max(20e6,Math.floor((worth(p)+p.loan)*.6/1e6)*1e6)}
function rankOf(p){return G.players.filter(q=>!q.out).sort((a,b)=>worth(b)-worth(a)).indexOf(p)+1}
function survey(x,pid){x.surveyed[pid]=true}
function resetSite(x){Object.assign(x,{owner:-1,type:null,permit:null,permitLeft:0,built:false,fail:false,grid:false,eff:1,fault:false,curtail:0,invested:0,age:0})}
function surveyCost(x){return x.r==='ns'?.3e6:.05e6}
function mwOf(p){return G.sites.filter(x=>x.owner===p.id&&operating(x)).reduce((s,x)=>s+PT[x.type].mw,0)}

function updateSpread(){
  const re=800+G.turn*25+G.sites.filter(x=>operating(x)&&!isStore(x.type)).reduce((s,x)=>s+PT[x.type].mw,0);
  G.spread=Math.round(35+70*Math.min(1,re/3000)+G.spreadAdd+(G.fx?G.fx.spread||0:0));
}
function genOffers(){
  G.offers=G.offers.filter(o=>o.expires>G.turn);
  while(G.offers.length<3){
    const vol=Math.round(pick([5,8,10,15,20,30,40])*G.ppaBoost)*1000;
    G.offers.push({id:G.nextId++,buyer:pick(BUYERS),vol,quarters:randint(4,16),price:Math.round(G.base*rand(.95,1.2)),expires:G.turn+randint(1,3)});
  }
}

/* ================= KI ================= */
function aiBorrow(p,need){const lim=creditLimit(p);if(p.cash<need&&p.loan+(need-p.cash)+3e6<=lim*.9){const a=Math.ceil((need-p.cash+3e6)/1e6)*1e6;p.loan+=a;p.cash+=a}return p.cash>=need}
function aiType(p,x){
  const T=REG[x.r].types;
  if(x.r==='ns')return 'off';
  if(x.r==='al'){if(x.hydro)return p.cash>60e6?'pump':'hydro';return G.year>2031&&Math.random()<.4?'batt':'solar'}
  if(G.year>2031&&Math.random()<.3)return 'batt';
  if(x.r==='ib')return Math.random()<.75?'solar':'wind';
  return Math.random()<.65?'wind':'solar';
}
function aiTurn(p,rep){
  const def=AI_DEF[p.id-1];
  const mine=G.sites.filter(x=>x.owner===p.id);
  for(const x of mine){
    if(x.fault){if(p.cash>serviceCost(x)+5e6){p.cash-=serviceCost(x);x.fault=false;clog(p,'repariert die Störung an '+siteName(x))}continue}
    if(!x.type){x.type=aiType(p,x);if(p.cash>PT[x.type].permit){p.cash-=PT[x.type].permit;x.permit='pending';x.permitLeft=randint(...PT[x.type].permitQ);clog(p,'beantragt einen '+PT[x.type].name+' auf '+siteName(x))}else x.type=null;continue}
    if(x.permit==='rejected'){if(Math.random()<.5){x.type=null;x.permit=null}else if(p.cash>PT[x.type].permit){p.cash-=PT[x.type].permit;x.permit='pending';x.permitLeft=randint(...PT[x.type].permitQ)}continue}
    if(x.permit==='approved'&&!x.built){
      const c=x.fail?Math.round(cost(x.type,'build')*.1):cost(x.type,'build');
      if(aiBorrow(p,c+3e6)){p.cash-=c;if(!x.fail)x.invested=c;
        if(PT[x.type].cls==='wind'&&Math.random()<.2){x.fail=true;clog(p,'scheitert bei der Montage auf '+siteName(x))}else{x.built=true;x.fail=false;x.eff=rand(.9,1.07);clog(p,'baut einen '+PT[x.type].name+' auf '+siteName(x)+' ('+money(c,true)+')')}}
      continue;
    }
    if(x.built&&!x.grid){const c=PT[x.type].grid,mw=PT[x.type].mw;if(freeGrid(x.r,p.id)>=mw&&p.cash>c){p.cash-=c;if(Math.random()<.85){x.grid=true;consumeReserve(x.r,p.id,mw);clog(p,'bringt '+siteName(x)+' mit '+mw+' MW ans Netz')}}}
  }
  const tries=p.cash>40e6?3:2;
  for(let t=0;t<tries;t++){
    if(Math.random()>.55||G.sites.filter(x=>x.owner===p.id&&!operating(x)).length>=3)continue;
    const r=pick(def.pref);
    const free=G.sites.filter(x=>x.r===r&&x.owner<0);if(!free.length)continue;
    let x=pick(free);
    if(p.cash<x.lease+(r==='ns'?30e6:8e6))continue;
    if(!x.surveyed[p.id]&&Math.random()<.6){p.cash-=surveyCost(x);survey(x,p.id);
      const R=REG[r];const bad=(r==='ns'||r==='nd')?x.wind<(R.wind[0]+R.wind[1])/2-.4:r==='ib'?x.sun<1650:!x.hydro&&Math.random()<.5;if(bad)continue}
    p.cash-=x.lease;x.owner=p.id;clog(p,'pachtet '+siteName(x)+' in '+REG[r].name+' für '+money(x.lease,true));
    if(x.lease>=1.5e6)news(esc(p.name)+' pachtet '+siteName(x)+' ('+REG[r].name+') für '+money(x.lease)+'.','comp');
  }
  if(Math.random()<.06){const r=pick(def.pref);if(freeGrid(r,p.id)>=50&&p.cash>5e6){p.cash-=.8e6;G.res.push({pid:p.id,r,mw:50,left:4});clog(p,'reserviert 50 MW Netz in '+REG[r].name);news(esc(p.name)+' reserviert 50 MW Netzkapazität in '+REG[r].name+'.','comp')}}
  if(p.loan>0&&p.cash>p.loan+20e6){p.cash-=p.loan;p.loan=0}
  if(Math.random()<.06)aiTrick(p,rep);
}
function clog(p,t){(G.clog=G.clog||[]).push({id:p.id,t:esc(p.name)+' '+t+'.'})}
function trickTargets(type,pid){
  return G.sites.filter(x=>x.owner>=0&&x.owner!==pid&&!G.players[x.owner].out&&(
    type==='klage'?(x.permit==='pending'||(x.permit==='approved'&&!x.built)):
    type==='bi'?(operating(x)&&(x.type==='wind'||x.type==='solar')&&x.curtail<=0&&!x.fault):
    (operating(x)&&!x.fault)));
}
function applyTrick(type,x){
  const tgt=G.players[x.owner];
  if(type==='klage'){x.permit='pending';x.permitLeft=Math.max(x.permitLeft,0)+2;if(Math.random()<.15)x.permitLeft=0,x.killed=true;return 'Klage gegen das Projekt '+siteName(x)+' von '+esc(tgt.name)+' – Verzögerung um zwei Quartale.'}
  if(type==='bi'){x.curtail=2;return 'Bürgerinitiative gegen '+siteName(x)+' ('+esc(tgt.name)+'): halbe Leistung für zwei Quartale.'}
  x.fault=true;return 'Hackerangriff auf die Leitwarte von '+siteName(x)+' ('+esc(tgt.name)+'). Das Kraftwerk ist vom Netz.';
}
function aiTrick(p,rep){
  const type=pick(['klage','klage','bi','bi','hack']);
  const others=G.players.filter(q=>q!==p&&!q.out).sort((a,b)=>worth(b)-worth(a));
  const lead=Math.random()<.6?others[0]:pick(others);
  let ts=trickTargets(type,p.id).filter(x=>x.owner===lead.id);
  if(!ts.length)ts=trickTargets(type,p.id);
  if(!ts.length)return;
  const x=pick(ts);p.cash-=TRICK[type].cost;
  if(Math.random()>TRICK[type].chance){
    if(TRICK[type].fine&&Math.random()<.35){p.cash-=TRICK[type].fine;news(esc(p.name)+' fliegt auf: '+TRICK[type].name+'. Strafe '+money(TRICK[type].fine)+'.','sab')}
    return;
  }
  const msg=applyTrick(type,x);
  const sus=Math.random()<.5?' Verdacht fällt auf '+esc(p.name)+'.':'';
  if(x.owner===0){rep.events.push({kind:'bad',text:msg+sus});news(msg+sus,'bad')}else news(msg,'sab');
}

/* ================= Quartalsabschluss ================= */
function endQuarter(){
  if(G.over)return;
  const P=me();
  const rep={lines:[],events:[],gen:0,start:P.cash,add(l,v){if(v)this.lines.push([l,Math.round(v)])}};
  G.fx={wind:1,solar:1,hydro:1,price:1,spread:0};G.clog=[];
  const h=HIST.find(e=>e.y===G.year&&e.q===G.q);
  if(h){h.f();rep.events.push({kind:'warn',text:h.t});news(h.t,'world')}
  if(Math.random()<.32)randomEvent(rep);
  updateSpread();
  const price=G.price*G.fx.price;
  // Genehmigungen
  G.sites.forEach(x=>{
    if(x.permit!=='pending')return;
    x.permitLeft--;
    if(x.permitLeft>0)return;
    const rej=x.killed||Math.random()<PT[x.type].reject;x.killed=false;
    x.permit=rej?'rejected':'approved';
    if(x.owner===0)rep.events.push({kind:rej?'bad':'good',text:'Genehmigung für '+PT[x.type].name+' auf '+siteName(x)+(rej?' abgelehnt.':' erteilt. Jetzt kann gebaut werden.')});
  });
  G.res.forEach(o=>o.left--);G.res=G.res.filter(o=>o.left>0);
  // KI
  G.players.filter(p=>!p.human&&!p.out).forEach(p=>aiTurn(p,rep));
  // Erzeugung
  const st={};G.players.forEach(p=>{p.genLast=0;p.revLast=0;st[p.id]={gen:0,val:0,store:0}});
  G.sites.forEach(x=>{
    if(!operating(x))return;
    x.age++;
    if(x.fault){if(Math.random()<.2){x.fault=false;if(x.owner===0)rep.events.push({kind:'good',text:'Die Störung an '+siteName(x)+' hat sich von selbst erledigt.'})}return}
    if(Math.random()<.025){x.fault=true;if(x.owner===0)rep.events.push({kind:'bad',text:'Technische Störung an '+siteName(x)+'. Das Kraftwerk ist vom Netz.'});return}
    const s=st[x.owner];
    if(isStore(x.type)){s.store+=storeRevenue(x)}
    else{const e=genEstimate(x);const cls=PT[x.type].cls;s.gen+=e;s.val+=e*price*CAPTURE[cls][G.q]}
    if(x.curtail>0)x.curtail--;
  });
  G.players.forEach(p=>{
    if(p.out)return;
    const s=st[p.id];p.genLast=s.gen;p.co2+=s.gen*CO2;
    let rev=s.val+s.store;
    if(p.human){
      rep.gen=s.gen;
      const avgCap=s.gen>0?s.val/s.gen:price;
      let left=s.gen,ppa=0;
      G.contracts.forEach(c=>{
        const d=Math.min(left,c.vol),short=c.vol-d;left-=d;
        const v=d*c.price+short*(c.price-price*1.15);ppa+=v;
        rep.add('PPA '+c.buyer+(short>0?' (Fehlmenge '+mwh(short)+' zugekauft)':''),v);
        c.left--;
      });
      const spot=left*avgCap;
      rep.add('Börsenverkauf ('+mwh(left)+')',spot);
      rep.add('Speicher-Arbitrage',s.store);
      rev=spot+s.store+ppa;
      G.contracts.filter(c=>c.left<=0).forEach(c=>rep.events.push({kind:'info',text:'Liefervertrag mit '+c.buyer+' ist ausgelaufen.'}));
      G.contracts=G.contracts.filter(c=>c.left>0);
    }
    p.cash+=Math.round(rev);p.revLast=rev;
    let op=0,ls=0;
    G.sites.forEach(x=>{if(x.owner!==p.id)return;ls+=x.lease*.02;if(x.built)op+=PT[x.type].opex});
    const int=p.loan*INTEREST;
    p.cash-=Math.round(op+ls+int);
    if(p.human){rep.add('Betrieb & Wartung',-op);rep.add('Flächenpacht',-ls);rep.add('Kreditzinsen',-int)}
  });
  // Preis
  G.target*=1.0025;
  G.base+=(G.target-G.base)*.15+gauss()*G.base*.06;G.base=clamp(G.base,35,260);
  // Zahlungsfähigkeit
  G.players.forEach(p=>{
    if(p.out||p.cash>=0)return;
    const need=Math.ceil(-p.cash/1e6)*1e6;
    if(p.loan+need<=creditLimit(p)){p.loan+=need;p.cash+=need;if(p.human)rep.events.push({kind:'warn',text:'Kasse leer: Die Bank gewährt einen Notkredit über '+money(need)+'.'})}
    else if(p.human)G.over='bankrupt';
    else{p.out=true;G.sites.forEach(x=>{if(x.owner===p.id)resetSite(x)});G.res=G.res.filter(o=>o.pid!==p.id);news(esc(p.name)+' ist insolvent. Alle Flächen gehen zurück an den Markt.','comp');rep.events.push({kind:'good',text:esc(p.name)+' ist insolvent!'})}
  });
  // Weiter
  G.q++;G.turn++;G.trickUsed=0;if(G.q>3){G.q=0;G.year++}
  G.price=Math.round(G.base*PRICE_SEASON[G.q]*100)/100;
  G.fx=null;updateSpread();
  genOffers();
  G.priceHist.push(Math.round(G.price));G.spreadHist.push(G.spread);G.labels.push(QN[G.q]+' '+String(G.year).slice(2));
  G.players.forEach(p=>p.hist.push(p.out?null:worth(p)));
  rep.end=P.cash;rep.price=price;
  if(!G.over&&G.year>=G.endYear)G.over='time';
  if(!G.over&&G.players.every(p=>p.human||p.out))G.over='monopoly';
  UI.confirm=null;
  render();showReport(rep);
}
function randomEvent(rep){
  const winter=G.q===0||G.q===3;
  const E=[
    [winter?4:0,()=>{G.fx.wind=.6;G.fx.solar=.5;G.fx.price=1.4;G.fx.spread=40;return 'Dunkelflaute: Kein Wind, keine Sonne. Der Strompreis springt, Speicher verdienen prächtig.'}],
    [winter?0:3,()=>{G.fx.solar=1.15;G.fx.price=.85;return 'Rekordsommer: Solarparks laufen am Anschlag, die Mittagspreise fallen ins Minus.'}],
    [3,()=>{G.fx.wind=.75;return 'Wochenlange Flaute: Windparks liefern ein Viertel weniger.'}],
    [2,()=>{G.fx.wind=1.15;G.sites.forEach(x=>{if(operating(x)&&x.type==='off'&&Math.random()<.3){x.fault=true;if(x.owner===0)rep.events.push({kind:'bad',text:'Sturmschaden an '+siteName(x)+'.'})}});return 'Orkanserie über der Nordsee: viel Ertrag, aber Schäden an Offshore-Anlagen.'}],
    [2,()=>{G.base*=1.25;G.target*=1.12;G.fx.price=1.2;return 'Gaspreisschock: Fossile Kraftwerke werden teuer, der Strompreis zieht an.'}],
    [3,()=>{const r=pick(RK);G.grid[r]+=150;return 'Netzausbau: In '+REG[r].name+' stehen 150 MW zusätzliche Anschlusskapazität bereit.'}],
    [2,()=>{G.fx.hydro=.6;return 'Trockenheit in den Alpen: Wasserkraft liefert 40 % weniger.'}],
    [2,()=>{G.target*=.9;G.base*=.93;return 'Industrie drosselt die Produktion. Die Stromnachfrage sinkt.'}]
  ];
  let tot=E.reduce((s,e)=>s+e[0],0),k=Math.random()*tot;
  for(const e of E){k-=e[0];if(e[0]&&k<=0){const t=e[1]();rep.events.push({kind:'warn',text:t});news(t,'world');return}}
}

/* ================= Speichern ================= */
const SAVE_KEY='wattmogul-save-v1';
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(G))}catch(e){}}
function loadSave(){try{const s=localStorage.getItem(SAVE_KEY);if(s){const g=JSON.parse(s);if(g&&g.v===1)return g}}catch(e){}return null}
