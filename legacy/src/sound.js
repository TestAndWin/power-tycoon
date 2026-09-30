/* ================= Sound ================= */
const SND={ctx:null,on:true,
  init(){if(!this.ctx){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){this.ctx=null}}if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{})},
  tone(f,d,type,v,f2,delay){if(!this.on)return;this.init();const c=this.ctx;if(!c)return;const t=c.currentTime+(delay||0);
    const o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v||.06,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(c.destination);o.start(t);o.stop(t+d+.03)},
  noise(d,v,freq,delay,q){if(!this.on)return;this.init();const c=this.ctx;if(!c)return;const t=c.currentTime+(delay||0);
    const b=c.createBuffer(1,Math.ceil(c.sampleRate*d),c.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='bandpass';f.frequency.setValueAtTime(freq||800,t);f.Q.value=q||1;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v||.05,t+d*.3);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(f).connect(g).connect(c.destination);s.start(t);s.stop(t+d)},
  click(){this.tone(1100,.04,'triangle',.025)},
  place(){this.tone(520,.07,'triangle',.05,780)},
  coin(){this.tone(988,.07,'square',.025);this.tone(1319,.14,'square',.025,null,.07)},
  ok(){[523,659,784,1047].forEach((f,i)=>this.tone(f,.2,'triangle',.05,null,i*.085))},
  fail(){this.tone(330,.4,'sawtooth',.035,110)},
  alarm(){this.tone(880,.12,'square',.03);this.tone(660,.12,'square',.03,null,.16);this.tone(880,.12,'square',.03,null,.32)},
  whoosh(){this.noise(.6,.07,500,0,.7)},
  clank(){this.tone(160,.15,'square',.04,80);this.noise(.12,.05,2400,.02,3)},
  zap(){this.tone(220,.25,'sawtooth',.03,880);this.noise(.15,.03,4000,.05,2)},
  report(){this.tone(392,.12,'sine',.05);this.tone(523,.18,'sine',.05,null,.1)}
};
try{SND.on=localStorage.getItem('wattmogul-sound')!=='off'}catch(e){}
function toggleSound(){SND.on=!SND.on;try{localStorage.setItem('wattmogul-sound',SND.on?'on':'off')}catch(e){}if(SND.on){SND.init();SND.ok()}renderTop()}
function countUp(root){
  root.querySelectorAll('[data-count]').forEach(el=>{
    const v=+el.dataset.count,f=el.dataset.fmt==='mwh'?mwh:x=>money(x);if(RMO){el.textContent=f(v);return}
    const t0=performance.now(),D=700;const step=n=>{const k=Math.min(1,(n-t0)/D),e=1-Math.pow(1-k,3);el.textContent=f(v*e);if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step);
  });
}
