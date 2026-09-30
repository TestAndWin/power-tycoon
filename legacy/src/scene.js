/* ================= Landschaften ================= */
const RMO=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const h1=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)};
function hx(c){if(c[0]==='r')return c.match(/\d+/g).slice(0,3).map(Number);c=c.replace('#','');if(c.length===3)c=c.split('').map(x=>x+x).join('');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)]}
function shade(c,f){return'#'+hx(c).map(v=>Math.round(v*f).toString(16).padStart(2,'0')).join('')}
function mix(a,b,f){const A=hx(a),B=hx(b);return`rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*f)).join(',')})`}
const SEAS=[
  {name:'Winter',sky:['#8fa6bd','#dde5ec'],fields:['#e6ecee','#dce4e4','#cfdad6'],tree:'#4e6358',snow:true,cloud:6},
  {name:'Frühling',sky:['#4f9ede','#d7eefb'],fields:['#79b94c','#93c955','#e3cf37'],tree:'#2f7a34',cloud:4},
  {name:'Sommer',sky:['#2f8bd8','#cde9fa'],fields:['#c9b54c','#9dbb4a','#d9a943'],tree:'#3f7428',cloud:2},
  {name:'Herbst',sky:['#7f98b3','#efd7b8'],fields:['#9b7a4c','#7f8a44','#b58b52'],tree:'#b9652a',cloud:5}
];
const FIELDS={
  ib:[['#a9ad63','#bfae70','#9c9f5a'],['#bda95c','#cdb56d','#9fa257'],['#d4a25b','#dcb06c','#c08e4c'],['#bd955a','#ae8c55','#a39858']],
  al:[['#eef3f5','#e3eaec','#d9e2e3'],['#6fb34d','#86c253','#5fa446'],['#78ad45','#8fbb4c','#6a9e3f'],['#8f8a4a','#a0833f','#7d8747']]
};
function geo(W,H){const hz=H*.3,Y=[.05,.27,.5,.74,.99].map(g=>hz+(H-hz)*g),sc=y=>.58+.42*(y-hz)/(H-hz);return{hz,Y,sc,X:(u,y)=>W/2+(u-.5)*W*.94*sc(y)}}
function quad(g,i){
  const c=i%4,r=Math.floor(i/4),y0=g.Y[r]+2,y1=g.Y[r+1]-3,u0=c/4+.012,u1=(c+1)/4-.012,cy=(y0+y1)/2;
  return{c,r,y0,y1,u0,u1,cy,cx:g.X((u0+u1)/2,cy),bw:g.X(u1,cy)-g.X(u0,cy),p:[[g.X(u0,y0),y0],[g.X(u1,y0),y0],[g.X(u1,y1),y1],[g.X(u0,y1),y1]]};
}
let COLS=['#2F62D9','#C2410C','#008C85','#B8860B'];
const SC=[];let scRaf=0,scLast=0;const T0=performance.now();

function registerScenes(){
  SC.length=0;
  document.querySelectorAll('canvas[data-scene]').forEach(cv=>{
    const W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;
    const d=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(W*d);cv.height=Math.round(H*d);
    const ctx=cv.getContext('2d');ctx.setTransform(d,0,0,d,0,0);
    SC.push({cv,ctx,W,H,r:cv.dataset.scene,mini:!!cv.dataset.mini});
  });
  readCols();
  if(RMO){SC.forEach(S=>drawScene(S,0));return}
  if(!scRaf)scRaf=requestAnimationFrame(sceneLoop);
}
function readCols(){const cs=getComputedStyle(document.documentElement);COLS=[0,1,2,3].map(i=>cs.getPropertyValue('--c'+i).trim()||COLS[i])}
function sceneLoop(now){
  scRaf=requestAnimationFrame(sceneLoop);
  if(now-scLast<33||document.hidden)return;scLast=now;
  const t=(now-T0)/1000;
  for(const S of SC)if(S.cv.isConnected)drawScene(S,t);
}

let SHX=0,HOV=null;
const rgba=(c,a)=>`rgba(${hx(c).join(',')},${a})`;
const NOISE=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),im=x.createImageData(128,128);
  for(let i=0;i<im.data.length;i+=4){const l=Math.random()>.5?255:0;im.data[i]=im.data[i+1]=im.data[i+2]=l;im.data[i+3]=Math.random()*20}x.putImageData(im,0,0);return c})();
const ROAD={nd:['#c9b387','#e9eef0'],ib:['#dcc294','#d2bf97'],al:['#b9ac8b','#f1f4f6']};

function drawScene(S,t){
  if(!G)return;
  const{ctx,W,H,r,mini}=S,q=G.q,se=SEAS[q],g=geo(W,H),hz=g.hz,wf=SEASON.wind[q];
  const p=RMO?.27:((t/150)+.18)%1,e=Math.sin(p*Math.PI*2),d=clamp(e*2+.8,0,1);
  const low=p<.5?clamp(1-e*1.7,0,1):0; // Morgen-/Abendlicht
  const lights=[],clouds=[],L=c=>mix('#1a2618',c,d*.85+.15);
  // Himmel
  const hzc=mix(se.sky[1],'#ff9a5c',low*.85);
  const sg=ctx.createLinearGradient(0,0,0,hz);
  sg.addColorStop(0,mix('#040a1e',shade(se.sky[0],.78),d));sg.addColorStop(.6,mix('#0d1838',mix(se.sky[0],'#c27a9c',low*.4),d));sg.addColorStop(1,mix('#2a3760',hzc,d));
  ctx.fillStyle=sg;ctx.fillRect(0,0,W,hz+2);
  if(d<.7){ctx.fillStyle='#fff';for(let i=0;i<70;i++){ctx.globalAlpha=(.7-d)*(.55+.45*Math.sin(t*2+i));ctx.fillRect(h1(i)*W,h1(i+50)*hz*.92,1.3,1.3)}ctx.globalAlpha=1}
  SHX=0;
  if(p<.5){const sx=W*(.05+.9*(p/.5)),sy=hz*(1.05-.9*Math.max(0,e)),R=Math.max(8,W*.028)*(r==='ib'?1.3:1);
    SHX=clamp((W/2-sx)/(W/2),-1,1)*(1-e*.5);
    if(!mini&&!RMO){ctx.save();ctx.translate(sx,sy);ctx.rotate(t*.025);ctx.fillStyle=`rgba(255,240,205,${.055*d})`;
      for(let k=0;k<12;k++){ctx.rotate(Math.PI/6);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,-W*.045);ctx.lineTo(W,W*.045);ctx.fill()}ctx.restore()}
    if(low>0){const hg=ctx.createRadialGradient(sx,hz,0,sx,hz,W*.55);hg.addColorStop(0,`rgba(255,160,80,${.45*low})`);hg.addColorStop(1,'rgba(255,160,80,0)');ctx.fillStyle=hg;ctx.fillRect(0,0,W,hz+2)}
    const gl=ctx.createRadialGradient(sx,sy,0,sx,sy,R*6);gl.addColorStop(0,'rgba(255,238,180,.8)');gl.addColorStop(.3,'rgba(255,230,160,.25)');gl.addColorStop(1,'rgba(255,230,160,0)');ctx.fillStyle=gl;ctx.fillRect(sx-R*6,sy-R*6,R*12,R*12);
    const sd=ctx.createRadialGradient(sx-R*.3,sy-R*.3,0,sx,sy,R);sd.addColorStop(0,'#fffbe8');sd.addColorStop(1,e<.25?'#ffa94d':'#ffe98a');ctx.fillStyle=sd;ctx.beginPath();ctx.arc(sx,sy,R,0,7);ctx.fill()}
  else{const mp=(p-.5)/.5,mx=W*(.05+.9*mp),my=hz*(1.05-.8*Math.sin(mp*Math.PI)),R=Math.max(6,W*.018);
    const mg=ctx.createRadialGradient(mx,my,0,mx,my,R*5);mg.addColorStop(0,'rgba(200,215,255,.35)');mg.addColorStop(1,'rgba(200,215,255,0)');ctx.fillStyle=mg;ctx.fillRect(mx-R*5,my-R*5,R*10,R*10);
    ctx.fillStyle='#eef1f7';ctx.beginPath();ctx.arc(mx,my,R,0,7);ctx.fill();ctx.fillStyle=mix('#08122b',se.sky[0],d);ctx.beginPath();ctx.arc(mx+R*.45,my-R*.2,R*.85,0,7);ctx.fill()}
  // Wolken mit Volumen
  const grey=q===0||q===3;
  for(let i=0;i<se.cloud+(r==='ns'?2:0);i++){
    const sp=(6+h1(i+3)*10)*wf,x=((h1(i)*W*1.4+t*sp)%(W+220))-110,y=hz*(.12+.55*h1(i+9)),s=W*(.03+.03*h1(i+4));
    clouds.push([x,s,i]);
    const cg=ctx.createLinearGradient(0,y-s*1.3,0,y+s);
    cg.addColorStop(0,grey?mix('#8e9aa8','#fbfcfd',d):mix('#39466a','#ffffff',d));
    cg.addColorStop(1,mix('#1a2340',grey?mix('#aab4c0','#e8b89a',low*.5):mix('#cdd8e6','#ffc59a',low*.7),d));
    ctx.fillStyle=cg;ctx.globalAlpha=.96;
    ctx.beginPath();ctx.arc(x,y,s,0,7);ctx.arc(x+s*.9,y+s*.2,s*.8,0,7);ctx.arc(x-s*.9,y+s*.25,s*.7,0,7);ctx.arc(x+s*.2,y-s*.45,s*.75,0,7);ctx.arc(x-s*.35,y-s*.3,s*.6,0,7);ctx.fill();
    ctx.globalAlpha=1;
  }
  // Vögel
  if(!mini&&d>.35){ctx.strokeStyle=rgba('#1d2430',.65*d);ctx.lineWidth=1.3;ctx.lineCap='round';
    for(let i=0;i<6;i++){const bx=((h1(i+60)*W+t*(16+h1(i+61)*14))%(W+80))-40,by=hz*(.22+.4*h1(i+62))+Math.sin(t*.8+i)*6,s=3.5+h1(i+63)*3,f=RMO?s*.3:Math.sin(t*9+i*2)*s*.6;
      ctx.beginPath();ctx.moveTo(bx-s,by-f);ctx.quadraticCurveTo(bx-s*.4,by-Math.abs(f)*.3-1,bx,by);ctx.quadraticCurveTo(bx+s*.4,by-Math.abs(f)*.3-1,bx+s,by-f);ctx.stroke()}}
  // Hintergrund je Region
  farScenery(ctx,r,W,H,g,q,t,d,se,lights);
  // Boden
  const F=(FIELDS[r]||[])[q]||se.fields;
  if(r==='ns'){
    const wg=ctx.createLinearGradient(0,hz,0,H);wg.addColorStop(0,mix('#0d2440',q===0?'#7a98ab':mix('#4a93c2','#e0a070',low*.35),d));wg.addColorStop(1,mix('#061526',q===0?'#34556b':'#18577f',d));ctx.fillStyle=wg;ctx.fillRect(0,hz,W,H-hz);
    ctx.strokeStyle=`rgba(255,255,255,${.12+.15*d})`;ctx.lineWidth=1;
    for(let k=0;k<22;k++){const y=hz+(H-hz)*Math.pow(k/22,1.4)+2,amp=1+k*.12;ctx.beginPath();for(let x=0;x<=W;x+=12){const yy=y+Math.sin(x/(18+k*2)+t*(1.2+wf)+k)*amp;x?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.stroke()}
  }else{
    const bg=ctx.createLinearGradient(0,hz,0,H);bg.addColorStop(0,L(shade(F[0],.9)));bg.addColorStop(1,L(shade(F[0],.78)));ctx.fillStyle=bg;ctx.fillRect(0,hz,W,H-hz);
    // Feldwege
    const rc=L(ROAD[r][q===0?1:0]),Y0=g.Y[0]-2,Y4=g.Y[4];
    ctx.fillStyle=rc;
    for(let k=0;k<=4;k++){const u=k/4,w=.012;ctx.beginPath();ctx.moveTo(g.X(u-w,Y0),Y0);ctx.lineTo(g.X(u+w,Y0),Y0);ctx.lineTo(g.X(u+w,Y4),Y4);ctx.lineTo(g.X(u-w,Y4),Y4);ctx.fill()}
    for(let k=0;k<=4;k++){const y=g.Y[k];ctx.beginPath();ctx.moveTo(g.X(-.012,y-2.5),y-2.5);ctx.lineTo(g.X(1.012,y-2.5),y-2.5);ctx.lineTo(g.X(1.012,y+2),y+2);ctx.lineTo(g.X(-.012,y+2),y+2);ctx.fill()}
    if(!mini){ctx.strokeStyle='rgba(60,40,20,.13)';ctx.lineWidth=1;for(let k=0;k<=4;k++)for(const o of[-.0045,.0045]){const u=k/4+o;ctx.beginPath();ctx.moveTo(g.X(u,Y0),Y0);ctx.lineTo(g.X(u,Y4),Y4);ctx.stroke()}}
    for(let i=0;i<26;i++){
      const side=i%2?1:-1,yy=hz+(H-hz)*(.04+.94*h1(i+20)),edge=W/2+side*W*.47*g.sc(yy),xx=edge+side*(8+h1(i+40)*(W/2-W*.47*g.sc(yy)-6));
      if(xx<-10||xx>W+10)continue;
      tree(ctx,xx,yy,Math.max(5,W*.018*g.sc(yy)),r,se,q);
    }
  }
  // Dunst am Horizont
  const hg=ctx.createLinearGradient(0,hz-hz*.35,0,hz+(H-hz)*.14);hg.addColorStop(0,rgba(hzc,0));hg.addColorStop(.72,rgba(hzc,.4*d));hg.addColorStop(1,rgba(hzc,0));
  ctx.fillStyle=hg;ctx.fillRect(0,hz-hz*.35,W,hz*.35+(H-hz)*.14);
  // Parzellen: Felder
  const Q=G.sites.filter(x=>x.r===r).map(x=>({x,qd:quad(g,x.i)}));
  const pathOf=P=>{ctx.beginPath();P.forEach((pt,k)=>k?ctx.lineTo(pt[0],pt[1]):ctx.moveTo(pt[0],pt[1]));ctx.closePath()};
  if(r!=='ns')for(const{x,qd}of Q){
    const P=qd.p,fc=F[Math.floor(h1(x.i+7)*3)],dep=Math.max(2,qd.bw*.03);
    ctx.fillStyle=L(shade(fc,.58));
    ctx.beginPath();ctx.moveTo(P[3][0],P[3][1]);ctx.lineTo(P[2][0],P[2][1]);ctx.lineTo(P[2][0],P[2][1]+dep);ctx.lineTo(P[3][0],P[3][1]+dep);ctx.closePath();ctx.fill();
    pathOf(P);ctx.fillStyle=L(fc);ctx.fill();
    ctx.save();ctx.clip();
    const n=q===0?0:9+Math.floor(h1(x.i+2)*8);ctx.lineWidth=Math.max(1,qd.bw*.006);
    for(let k=1;k<n;k++){const u=qd.u0+(qd.u1-qd.u0)*k/n;ctx.strokeStyle=k%2?'rgba(0,0,0,.09)':'rgba(255,255,255,.07)';ctx.beginPath();ctx.moveTo(g.X(u,qd.y0),qd.y0);ctx.lineTo(g.X(u,qd.y1),qd.y1);ctx.stroke()}
    const lg=ctx.createLinearGradient(0,qd.y0,0,qd.y1);lg.addColorStop(0,'rgba(255,255,255,.12)');lg.addColorStop(1,'rgba(0,0,0,.08)');ctx.fillStyle=lg;ctx.fill();ctx.restore();
  }
  if(!S.pat)S.pat=ctx.createPattern(NOISE,'repeat');
  ctx.fillStyle=S.pat;ctx.fillRect(0,hz,W,H-hz);
  // Parzellen: Eigentum, Hover, Auswahl
  for(const{x,qd}of Q){
    const P=qd.p,own=x.owner>=0,oc=own?COLS[x.owner]:null,lw=Math.max(1.5,qd.bw*.017);
    pathOf(P);
    if(own){
      ctx.save();ctx.clip();ctx.fillStyle=oc;ctx.globalAlpha=r==='ns'?.2:.12;ctx.fill();
      ctx.strokeStyle=oc;for(const[m,a]of[[14,.1],[8,.16],[4,.28]]){ctx.globalAlpha=a;ctx.lineWidth=lw*m;ctx.stroke()}
      ctx.globalAlpha=1;ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=lw*2+2.5;ctx.stroke();ctx.strokeStyle=oc;ctx.lineWidth=lw*2;ctx.stroke();ctx.restore();
      if(x.owner===0&&!mini&&!RMO){ctx.save();ctx.shadowColor=oc;ctx.shadowBlur=9+6*Math.sin(t*2.4);ctx.strokeStyle=oc;ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.stroke();ctx.restore()}
    }else{ctx.strokeStyle=r==='ns'?'rgba(255,220,90,.55)':'rgba(255,255,255,.45)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([])}
    if(r==='ns'&&!own){ctx.fillStyle='#f2c230';P.forEach(pt=>{ctx.beginPath();ctx.arc(pt[0],pt[1]+Math.sin(t*2+pt[0])*1.2,Math.max(1.5,qd.bw*.015),0,7);ctx.fill()})}
    if(!mini&&HOV===x.id&&UI.tab==='sites'){pathOf(P);ctx.save();ctx.clip();ctx.fillStyle='rgba(255,255,255,.13)';ctx.fill();ctx.restore();ctx.save();ctx.shadowColor='#fff';ctx.shadowBlur=10;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;ctx.stroke();ctx.restore()}
    if(!mini&&UI.sel===x.id&&UI.tab==='sites'){pathOf(P);ctx.save();ctx.shadowColor='#fff';ctx.shadowBlur=16;ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.setLineDash([10,6]);ctx.lineDashOffset=RMO?0:-t*24;ctx.stroke();ctx.restore()}
  }
  // Objekte von hinten nach vorn
  for(const{x,qd}of Q)drawObject(ctx,x,qd,g,t,d,r,mini,lights);
  // Wolkenschatten ziehen über das Land
  if(d>.2){ctx.save();ctx.beginPath();ctx.rect(0,hz,W,H-hz);ctx.clip();
    for(const[cx,s,i]of clouds){const gy=hz+(H-hz)*(.15+.75*h1(i+31)),rx=s*4.2*g.sc(gy),gx=cx+(gy-hz)*.15;
      ctx.save();ctx.translate(gx,gy);ctx.scale(1,.3);const rg=ctx.createRadialGradient(0,0,0,0,0,rx);rg.addColorStop(0,`rgba(12,22,34,${.17*d})`);rg.addColorStop(1,'rgba(12,22,34,0)');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(0,0,rx,0,7);ctx.fill();ctx.restore()}
    ctx.restore()}
  // Luftperspektive
  const ap=ctx.createLinearGradient(0,hz,0,hz+(H-hz)*.45);ap.addColorStop(0,rgba(hzc,.3*d));ap.addColorStop(1,rgba(hzc,0));ctx.fillStyle=ap;ctx.fillRect(0,hz,W,(H-hz)*.45);
  // Wetter
  if(q===0&&r!=='ib'){const n=mini?25:80;ctx.fillStyle='rgba(255,255,255,.85)';
    for(let i=0;i<n;i++){const x=(h1(i)*W+Math.sin(t*.7+i)*12+t*8*wf)%W,y=(h1(i+100)*H+t*(14+h1(i+200)*16))%H,s=.8+h1(i+300)*1.7;ctx.beginPath();ctx.arc(x,y,s,0,7);ctx.fill()}}
  else if(q===3&&r!=='ns'&&!mini){const LC=['#c8642a','#e0a03a','#a84a22'];
    for(let i=0;i<18;i++){const x=(h1(i)*W+t*(18+h1(i+5)*18)*wf)%(W+20)-10,y=(h1(i+100)*H+t*(16+h1(i+9)*12))%H;
      ctx.save();ctx.translate(x,y);ctx.rotate(t*(1+h1(i+7)*2)+i);ctx.fillStyle=L(LC[i%3]);ctx.beginPath();ctx.ellipse(0,0,3.2,1.6,0,0,7);ctx.fill();ctx.restore()}}
  // Morgen-/Abendstimmung
  if(low>0){ctx.save();ctx.globalCompositeOperation='soft-light';ctx.fillStyle=`rgba(255,125,45,${.75*low})`;ctx.fillRect(0,0,W,H);ctx.restore()}
  // Nacht
  if(d<1){ctx.fillStyle=`rgba(6,12,32,${(1-d)*.5})`;ctx.fillRect(0,hz,W,H-hz)}
  // Nachtbeleuchtung: Wegkreuzungen und leuchtende Eigentumsrahmen
  if(d<.9){const n=1-d;
    if(r!=='ns')for(let j=0;j<=4;j++)for(let k=0;k<=4;k++){const y=g.Y[j],x=g.X(k/4,y),rr=W*.018*g.sc(y);
      const lg=ctx.createRadialGradient(x,y,0,x,y,rr*2.4);lg.addColorStop(0,`rgba(255,214,140,${.55*n})`);lg.addColorStop(1,'rgba(255,214,140,0)');ctx.fillStyle=lg;ctx.fillRect(x-rr*2.4,y-rr*2.4,rr*4.8,rr*4.8);
      ctx.fillStyle=`rgba(255,238,200,${.95*n})`;ctx.beginPath();ctx.arc(x,y,Math.max(1,rr*.16),0,7);ctx.fill()}
    ctx.save();ctx.lineJoin='round';
    for(const{x,qd}of Q){if(x.owner<0)continue;const oc=COLS[x.owner];pathOf(qd.p);
      ctx.shadowColor=oc;ctx.shadowBlur=mini?6:14;ctx.strokeStyle=rgba(oc,.95*n);ctx.lineWidth=Math.max(1.5,qd.bw*.014);ctx.stroke();
      ctx.shadowBlur=0;ctx.strokeStyle=`rgba(255,255,255,${.6*n})`;ctx.lineWidth=Math.max(.6,qd.bw*.004);ctx.stroke()}
    ctx.restore()}
  // Vignette
  const vg=ctx.createRadialGradient(W/2,H*.55,Math.min(W,H)*.35,W/2,H*.55,Math.max(W,H)*.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.24)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  // Befeuerung
  const on=RMO||Math.floor(t/1.2)%2===0;
  if(on&&d<.85)lights.forEach(([lx,ly,c])=>{ctx.fillStyle=c||'#ff2a2a';ctx.shadowColor=c||'#ff2a2a';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(lx,ly,1.8,0,7);ctx.fill();ctx.shadowBlur=0});
}

function farScenery(ctx,r,W,H,g,q,t,d,se,lights){
  const hz=g.hz;
  if(r==='nd'){
    ctx.fillStyle=mix('#10200f',q===0?'#b9c6c2':'#4f7d45',d);ctx.fillRect(0,hz-6,W,8);
    for(let i=0;i<9;i++){const x=W*h1(i+70),hh=4+h1(i+80)*6;ctx.fillStyle=mix('#10180f',q===0?'#8c9a94':'#3f6a3a',d);ctx.beginPath();ctx.arc(x,hz-4,hh,Math.PI,0);ctx.fill()}
    // Leuchtturm
    const lx=W*.86;ctx.fillStyle=mix('#222','#f2f2f2',d);ctx.fillRect(lx-3,hz-26,6,22);ctx.fillStyle='#c0392b';ctx.fillRect(lx-3,hz-18,6,4);ctx.fillRect(lx-3,hz-10,6,4);ctx.fillStyle='#333';ctx.fillRect(lx-4,hz-30,8,4);
    if(d<.8){const a=t*1.5;ctx.fillStyle='rgba(255,240,170,.18)';ctx.beginPath();ctx.moveTo(lx,hz-28);ctx.lineTo(lx+Math.cos(a)*90,hz-28+Math.sin(a)*8-6);ctx.lineTo(lx+Math.cos(a)*90,hz-28+Math.sin(a)*8+6);ctx.fill()}
    for(let i=0;i<5;i++){const x=W*(.12+i*.13+h1(i)*.05);miniTurbine(ctx,x,hz-3,14+h1(i+3)*6,t*(1.4+h1(i))*SEASON.wind[q],d,lights)}
  }else if(r==='ns'){
    ctx.fillStyle=mix('#1a2533','#6b7b8a',d);ctx.fillRect(W*.62,hz-7,26,4);ctx.fillRect(W*.62+6,hz-12,10,5);ctx.fillRect(W*.62+14,hz-17,2,6);
    for(let i=0;i<7;i++){const x=W*(.05+i*.07);miniTurbine(ctx,x,hz,12+h1(i)*4,t*1.8*SEASON.wind[q],d,lights)}
  }else if(r==='ib'){
    const cols=[mix('#1d170f','#b98d58',d),mix('#1d170f','#a8794a',d)];
    [[.35,22],[.1,14]].forEach(([off,a],k)=>{ctx.fillStyle=cols[k];ctx.beginPath();ctx.moveTo(0,hz+2);for(let x=0;x<=W;x+=8)ctx.lineTo(x,hz-a-Math.sin(x/W*6+off*10)*a*.5-Math.sin(x/W*13+k)*a*.25);ctx.lineTo(W,hz+2);ctx.fill()});
    for(let i=0;i<8;i++){const x=W*(.58+i*.025),y=hz-8-h1(i)*5;ctx.fillStyle=mix('#333','#f4efe4',d);ctx.fillRect(x,y,8,7);ctx.fillStyle=mix('#222','#c3643a',d);ctx.fillRect(x-1,y-2,10,2)}
    ctx.fillStyle=mix('#333','#f4efe4',d);ctx.fillRect(W*.56,hz-22,5,14);
  }else if(r==='al'){
    const peaks=[[0,.55],[.12,.95],[.22,.6],[.33,1],[.45,.7],[.55,.92],[.68,.6],[.8,.85],[.92,.5],[1,.7]];
    const snow=q===0?.55:q===3?.35:.2;
    ctx.fillStyle=mix('#0e1520','#6f7f94',d);ctx.beginPath();ctx.moveTo(0,hz+2);peaks.forEach(([u,h])=>ctx.lineTo(u*W,hz-h*hz*.62));ctx.lineTo(W,hz+2);ctx.fill();
    ctx.fillStyle='rgba(10,20,40,.22)';
    for(let k=1;k<peaks.length-1;k++){const[u,h]=peaks[k],[ur,hr]=peaks[k+1];if(h<hr)continue;ctx.beginPath();ctx.moveTo(u*W,hz-h*hz*.62);ctx.lineTo(ur*W,hz-hr*hz*.62);ctx.lineTo(ur*W,hz+2);ctx.lineTo(u*W+(ur-u)*W*.25,hz+2);ctx.fill()}
    ctx.fillStyle=mix('#3a4150','#f7fafc',d);
    for(let k=1;k<peaks.length-1;k++){const[u,h]=peaks[k];if(h<.65)continue;const px=u*W,py=hz-h*hz*.62,s=h*hz*.62*snow;const[ul]=peaks[k-1],[ur]=peaks[k+1];
      const lx=px+(ul*W-px)*(s/(h*hz*.62)),rx=px+(ur*W-px)*(s/(h*hz*.62));ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(rx,py+s);ctx.lineTo((px+rx)/2,py+s*.8);ctx.lineTo(px,py+s);ctx.lineTo((px+lx)/2,py+s*.85);ctx.lineTo(lx,py+s);ctx.fill()}
    ctx.fillStyle=mix('#0c1a14',q===0?'#dfe7ea':'#3f6b3e',d);ctx.beginPath();ctx.moveTo(0,hz+2);for(let x=0;x<=W;x+=10)ctx.lineTo(x,hz-8-Math.sin(x/W*9)*6);ctx.lineTo(W,hz+2);ctx.fill();
    ctx.fillStyle=mix('#0a1b2c','#5aa0c8',d);ctx.beginPath();ctx.ellipse(W*.22,hz+3,W*.12,5,0,0,7);ctx.fill();
  }
}
function miniTurbine(ctx,x,y,h,a,d,lights){
  ctx.strokeStyle=mix('#3a4150','#f4f6f5',d);ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-h);ctx.stroke();
  for(let k=0;k<3;k++){const b=a+k*2.094;ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+Math.cos(b)*h*.45,y-h+Math.sin(b)*h*.45);ctx.stroke()}
  lights.push([x,y-h-1]);
}
function tree(ctx,x,y,s,r,se,q){
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.beginPath();ctx.ellipse(x+s*.4,y,s*.9,s*.3,0,0,7);ctx.fill();
  if(r==='al'){ctx.fillStyle=se.snow?'#3d5a48':'#2e5a3a';ctx.beginPath();ctx.moveTo(x,y-s*3);ctx.lineTo(x+s,y-s*.2);ctx.lineTo(x-s,y-s*.2);ctx.fill();if(se.snow){ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(x,y-s*3);ctx.lineTo(x+s*.4,y-s*1.8);ctx.lineTo(x-s*.4,y-s*1.8);ctx.fill()}return}
  ctx.fillStyle='#5b4632';ctx.fillRect(x-s*.12,y-s*1.2,s*.24,s*1.2);
  ctx.fillStyle=r==='ib'?'#6f7d45':se.tree;ctx.beginPath();ctx.arc(x,y-s*1.5,s*(r==='ib'?.8:1),0,7);ctx.fill();
  if(se.snow){ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.arc(x,y-s*2,s*.55,Math.PI,0);ctx.fill()}
}
function bales(ctx,qd,g,d,i){
  const base=mix('#2a2414','#dcb65a',d*.85+.15),face=mix('#2a2414','#ecd083',d*.85+.15);
  for(let k=0;k<3;k++){const v=.28+k*.2+h1(i+k*3)*.08,y=qd.y0+(qd.y1-qd.y0)*(.35+h1(i+k+9)*.45),x=g.X(qd.u0+(qd.u1-qd.u0)*v,y),rr=Math.max(3,qd.bw*.045),len=rr*1.3;
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(x+len*.5+SHX*rr,y+rr*.9,len*.9+Math.abs(SHX)*rr,rr*.3,0,0,7);ctx.fill();
    ctx.fillStyle=base;ctx.beginPath();ctx.moveTo(x,y-rr);ctx.lineTo(x+len,y-rr);ctx.ellipse(x+len,y,rr*.45,rr,0,-Math.PI/2,Math.PI/2);ctx.lineTo(x,y+rr);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(110,75,20,.25)';ctx.lineWidth=Math.max(.6,rr*.08);for(const f of[.35,.7]){ctx.beginPath();ctx.moveTo(x+len*f,y-rr*.98);ctx.lineTo(x+len*f,y+rr*.98);ctx.stroke()}
    ctx.fillStyle=face;ctx.beginPath();ctx.ellipse(x,y,rr*.45,rr,0,0,7);ctx.fill();
    ctx.strokeStyle='rgba(120,80,20,.5)';ctx.lineWidth=Math.max(.6,rr*.1);ctx.beginPath();ctx.ellipse(x,y,rr*.27,rr*.6,0,0,5.6);ctx.stroke();ctx.beginPath();ctx.ellipse(x,y,rr*.1,rr*.24,0,0,6);ctx.stroke()}
}
function flag(ctx,x,y,u,col,letter,t,mini){
  const fh=Math.max(10,u*.19),fw=fh*.78,fl=fh*.52,w=RMO?0:Math.sin(t*3.2+x*.1)*fl*.12;
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(x+1,y,fh*.12,fh*.04,0,0,7);ctx.fill();
  ctx.strokeStyle='#2b2f33';ctx.lineWidth=Math.max(1.2,fh*.06);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-fh);ctx.stroke();
  ctx.fillStyle='#f2c230';ctx.beginPath();ctx.arc(x,y-fh,Math.max(1.2,fh*.05),0,7);ctx.fill();
  const top=y-fh+fh*.04;
  ctx.fillStyle=col;ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=Math.max(.8,fh*.04);
  ctx.beginPath();ctx.moveTo(x,top);ctx.quadraticCurveTo(x+fw*.5,top-w,x+fw,top+w*.5);ctx.lineTo(x+fw,top+fl+w*.5);ctx.quadraticCurveTo(x+fw*.5,top+fl-w,x,top+fl);ctx.closePath();ctx.fill();ctx.stroke();
  if(!mini&&fl>=8){ctx.fillStyle='#fff';ctx.font=`800 ${Math.round(fl*.72)}px Manrope,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(letter,x+fw*.5,top+fl*.52+w*.2);ctx.textAlign='left';ctx.textBaseline='alphabetic'}
}
function turbine(ctx,x,y,h,ang,d,off,lights){
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(x+h*.08,y,h*.12,h*.03,0,0,7);ctx.fill();
  if(SHX&&!off){const l=h*.8*SHX,sy=y+h*.07;ctx.fillStyle='rgba(0,0,0,.13)';ctx.beginPath();ctx.moveTo(x-h*.02,y);ctx.lineTo(x+h*.02,y);ctx.lineTo(x+l+h*.008,sy);ctx.lineTo(x+l-h*.008,sy);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.07)';ctx.beginPath();ctx.ellipse(x+l,sy,h*.4,h*.05,0,0,7);ctx.fill()}
  if(off){ctx.fillStyle='#e8b923';ctx.fillRect(x-h*.035,y-h*.14,h*.07,h*.16);ctx.fillStyle='#50585c';ctx.fillRect(x-h*.07,y-h*.15,h*.14,h*.02)}
  const base=off?y-h*.14:y,top=y-h;
  ctx.fillStyle=mix('#56606a','#f5f7f6',d);ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(x-h*.028,base);ctx.lineTo(x+h*.028,base);ctx.lineTo(x+h*.011,top);ctx.lineTo(x-h*.011,top);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=mix('#4c555e','#e8ecea',d);ctx.fillRect(x-h*.025,top-h*.03,h*.1,h*.055);
  const rl=h*.45;
  for(let k=0;k<3;k++){ctx.save();ctx.translate(x,top);ctx.rotate(ang+k*2.0944);
    ctx.fillStyle=mix('#56606a','#fbfcfc',d);ctx.beginPath();ctx.moveTo(0,-h*.018);ctx.quadraticCurveTo(rl*.3,-h*.045,rl,-h*.005);ctx.lineTo(rl,h*.005);ctx.quadraticCurveTo(rl*.3,h*.025,0,h*.018);ctx.fill();ctx.stroke();
    ctx.fillStyle='#d8413a';ctx.fillRect(rl*.88,-h*.006,rl*.1,h*.012);ctx.restore()}
  ctx.fillStyle=mix('#56606a','#ffffff',d);ctx.beginPath();ctx.arc(x,top,h*.028,0,7);ctx.fill();ctx.stroke();
  lights.push([x+h*.03,top-h*.035]);
}
function drawObject(ctx,x,qd,g,t,d,r,mini,lights){
  const u=qd.bw,bx=qd.cx,by=qd.y1-(qd.y1-qd.y0)*.22,s=Math.max(3,u*.06);
  if(x.owner>=0){const fx=qd.p[1][0]-u*.26,fy=qd.p[1][1]+(qd.y1-qd.y0)*.3;flag(ctx,fx,fy,u,COLS[x.owner],mono(G.players[x.owner]),t,mini)}
  if(x.owner<0){if(!mini&&(r==='nd'||r==='ib')&&(G.q===2||G.q===3)&&h1(x.i+3)<.6)bales(ctx,qd,g,d,x.i);return}
  const st=x.type;
  if(!st){for(let k=0;k<3;k++){const px=bx-u*.2+k*u*.2,py=by-k%2*u*.05;ctx.fillStyle='#fff';ctx.fillRect(px-1,py-s*2,2.4,s*2);ctx.fillStyle='#d8413a';ctx.fillRect(px-1,py-s*2,2.4,s*.6);ctx.fillRect(px-1,py-s*.9,2.4,s*.5)}return}
  if(x.permit==='pending'||x.permit==='rejected'){
    ctx.fillStyle='#6b4f33';ctx.fillRect(bx-1.5,by-s*3,3,s*3);
    ctx.fillStyle=x.permit==='rejected'?'#f3d6d2':'#fdfcf7';ctx.strokeStyle='#6b4f33';ctx.lineWidth=1;ctx.fillRect(bx-s*2,by-s*5.2,s*4,s*2.6);ctx.strokeRect(bx-s*2,by-s*5.2,s*4,s*2.6);
    ctx.fillStyle=x.permit==='rejected'?'#b42318':'#2b2b2b';ctx.font=`700 ${Math.max(8,s*2)}px Manrope,sans-serif`;ctx.textAlign='center';ctx.fillText(x.permit==='rejected'?'✕':'§',bx,by-s*3.2);ctx.textAlign='left';return}
  const cls=PT[st].cls,op=operating(x)&&!x.fault;
  if(!x.built){ // Baustelle
    const ch=u*(st==='off'?1.1:.95);
    ctx.strokeStyle='#e0a100';ctx.lineWidth=Math.max(1.5,u*.02);ctx.beginPath();ctx.moveTo(bx+u*.25,by);ctx.lineTo(bx+u*.25,by-ch);ctx.lineTo(bx-u*.25,by-ch);ctx.stroke();
    ctx.lineWidth=1;ctx.strokeStyle='#333';const hk=bx-u*.1+Math.sin(t*1.3)*u*.04;ctx.beginPath();ctx.moveTo(bx-u*.1,by-ch);ctx.lineTo(hk,by-ch*.55);ctx.stroke();
    if(cls==='wind'){ctx.fillStyle=mix('#56606a','#eef1f0',d);ctx.fillRect(bx-u*.03,by-ch*.45,u*.06,ch*.45)}
    else{ctx.fillStyle='#b5b9b6';ctx.fillRect(bx-u*.2,by-u*.12,u*.3,u*.12)}
    if(x.fail){ctx.fillStyle='#b42318';ctx.font=`700 ${Math.max(9,s*2)}px Manrope,sans-serif`;ctx.fillText('!',bx-u*.3,by-u*.1)}
    return;
  }
  if(op&&!mini&&!RMO&&d>.15){const sc=isStore(st)?'126,226,160':'255,222,110';ctx.shadowColor=`rgb(${sc})`;ctx.shadowBlur=6;
    for(let k=0;k<4;k++){const f=(t*.32+k/4+h1(x.i))%1,px=bx+Math.sin(f*7+k*2)*u*.2,py=by-u*.12-f*u*.6;ctx.fillStyle=`rgba(${sc},${Math.sin(f*Math.PI)*.95})`;ctx.beginPath();ctx.arc(px,py,Math.max(1.2,u*.011)*(1-f*.4),0,7);ctx.fill()}
    ctx.shadowBlur=0}
  const spin=op?t*(1.2+((x.wind||7)-5)*.35)*SEASON.wind[G.q]:0;
  if(st==='wind'||st==='off'){
    const h=u*(st==='off'?.9:.68);
    if(st==='wind'){turbine(ctx,bx-u*.18,by-u*.08,h*.85,spin+h1(x.i),d,false,lights);turbine(ctx,bx+u*.2,by,h,spin*1.07+1,d,false,lights)}
    else turbine(ctx,bx,by,h,spin,d,true,lights);
  }else if(st==='solar'){
    for(let k=0;k<3;k++){
      const y=qd.y0+(qd.y1-qd.y0)*(.28+k*.25),x0=g.X(qd.u0+.02,y)+2,x1=g.X(qd.u1-.02,y)-2,ph=(qd.y1-qd.y0)*.14;
      ctx.fillStyle='#50575a';ctx.fillRect(x0+4,y,1.5,ph*.6);ctx.fillRect(x1-6,y,1.5,ph*.6);
      const gr=ctx.createLinearGradient(x0,0,x1,0);const gp=op&&d>.5?((t*.25+k*.2)%1.6)-.3:-1;
      gr.addColorStop(0,mix('#0b1633','#1d3a8a',d));
      if(gp>0&&gp<1){gr.addColorStop(clamp(gp-.08,0,1),mix('#0b1633','#1d3a8a',d));gr.addColorStop(gp,'#9fc0ff');gr.addColorStop(clamp(gp+.08,0,1),mix('#0b1633','#1d3a8a',d))}
      gr.addColorStop(1,mix('#0b1633','#27469a',d));
      ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(x0+3,y-ph);ctx.lineTo(x1+3,y-ph);ctx.lineTo(x1,y);ctx.lineTo(x0,y);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(160,185,235,.35)';ctx.lineWidth=.6;for(let j=1;j<6;j++){const xx=x0+(x1-x0)*j/6;ctx.beginPath();ctx.moveTo(xx+3,y-ph);ctx.lineTo(xx,y);ctx.stroke()}
    }
  }else if(st==='batt'){
    for(let k=0;k<2;k++){const w=u*.3,h=u*.14,x0=bx-u*.34+k*u*.36,y0=by-h;
      ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(x0+3,by-2,w,4);
      ctx.fillStyle=mix('#4d555c','#e9edef',d);ctx.fillRect(x0,y0,w,h);ctx.fillStyle=mix('#3d444a','#cfd6da',d);ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+w*.12,y0-h*.35);ctx.lineTo(x0+w*1.12,y0-h*.35);ctx.lineTo(x0+w,y0);ctx.fill();
      ctx.fillStyle=COLS[x.owner];ctx.fillRect(x0,y0+h*.35,w,h*.15);
      ctx.fillStyle=op?(Math.floor(t*2+k)%2?'#39d353':'#1a7f37'):'#666';ctx.fillRect(x0+w*.8,y0+h*.65,3,3);lights.push([x0+w*.8+1.5,y0+h*.65+1.5,op?'#39d353':'#666'])}
  }else if(st==='hydro'){
    const w=u*.7,x0=bx-w/2,dh=u*.2;
    ctx.fillStyle=mix('#0b2033','#4a90c2',d);ctx.fillRect(x0,by-dh-u*.12,w,u*.12);
    ctx.fillStyle=mix('#44494c','#b9bdb9',d);ctx.beginPath();ctx.moveTo(x0-4,by);ctx.lineTo(x0+w+4,by);ctx.lineTo(x0+w,by-dh);ctx.lineTo(x0,by-dh);ctx.fill();
    if(op){ctx.strokeStyle='rgba(235,245,255,.85)';ctx.lineWidth=1.2;for(let k=0;k<5;k++){const xx=x0+w*(.2+k*.15),o=(t*30+k*7)%10;ctx.beginPath();ctx.moveTo(xx,by-dh+o);ctx.lineTo(xx,by-dh+o+5);ctx.stroke()}}
  }else if(st==='pump'){
    const ux=bx-u*.22,uy=qd.y0+(qd.y1-qd.y0)*.3;
    ctx.fillStyle=mix('#44494c','#aab0ad',d);ctx.beginPath();ctx.ellipse(ux,uy,u*.2,u*.06,0,0,7);ctx.fill();ctx.fillStyle=mix('#0b2033','#4a90c2',d);ctx.beginPath();ctx.ellipse(ux,uy,u*.17,u*.045,0,0,7);ctx.fill();
    ctx.strokeStyle='#5c6166';ctx.lineWidth=Math.max(2,u*.025);ctx.beginPath();ctx.moveTo(ux+u*.1,uy+2);ctx.lineTo(bx+u*.2,by-u*.08);ctx.stroke();ctx.lineWidth=1;
    ctx.fillStyle=mix('#44494c','#e3e6e4',d);ctx.fillRect(bx+u*.12,by-u*.14,u*.18,u*.12);ctx.fillStyle=COLS[x.owner];ctx.fillRect(bx+u*.12,by-u*.16,u*.18,u*.03);
    if(op){ctx.fillStyle='#bfe3ff';for(let k=0;k<4;k++){const f=((t*.4+k/4)%1),px=ux+u*.1+(bx+u*.2-ux-u*.1)*f,py=uy+2+(by-u*.08-uy-2)*f;ctx.beginPath();ctx.arc(px,py,1.5,0,7);ctx.fill()}}
  }
  if(x.fault){
    for(let k=0;k<4;k++){const f=((t*.5+k/4)%1);ctx.fillStyle=`rgba(90,90,90,${.55*(1-f)})`;ctx.beginPath();ctx.arc(bx+Math.sin(f*6+k)*u*.05,by-u*.2-f*u*.6,u*(.05+f*.1),0,7);ctx.fill()}
    if(RMO||Math.floor(t*3)%2===0){ctx.fillStyle='#e5484d';ctx.beginPath();ctx.moveTo(bx,by-u*.75);ctx.lineTo(bx+u*.1,by-u*.58);ctx.lineTo(bx-u*.1,by-u*.58);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(bx-1,by-u*.71,2,u*.08)}
  }else if(x.curtail>0){ctx.fillStyle='#f0b429';ctx.save();ctx.translate(bx-u*.35,by-u*.25);ctx.rotate(Math.PI/4);ctx.fillRect(-s,-s,s*2,s*2);ctx.restore()}
}
