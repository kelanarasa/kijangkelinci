/* music.js – musik energik buatan (sintesis Web Audio), tanpa file audio, offline.
   - Misi "lari"   : 150 BPM, kick 4-on-the-floor, bass, arpeggio, melodi
   - Misi "lompat" : 136 BPM, bass memantul, arpeggio staccato, bunyi "boing"
   - Misi "patung" : musik BERHENTI mendadak (seperti freeze dance) + bunyi turun
   API: var mu=new Music(); mu.init() (harus dari klik/tap), mu.setMode('lari'|'lompat'|'patung'),
        mu.duck(detik), mu.stop(), mu.fanfare(), mu.toggle() */
(function(global){
'use strict';
// Am - F - C - G
var CH=[[57,60,64,69],[53,57,60,65],[60,64,67,72],[55,59,62,67]];
var ROOT=[45,41,48,43];
var ARP=[0,1,2,3,2,1,0,1,2,3,2,1,0,2,3,1];
var HOOK=[0,-1,2,-1,3,-1,2,-1,3,-1,2,-1,0,-1,-1,-1];

function hz(m){return 440*Math.pow(2,(m-69)/12)}

function Music(){
  this.ctx=null;this.master=null;this.out=null;this.noise=null;
  this.on=true;this.mode=null;this.timer=null;
  this.step=0;this.t=0;this.bpm=140;this.vol=.5;
}
var P=Music.prototype;

P.init=function(){
  if(!this.ctx){
    var AC=global.AudioContext||global.webkitAudioContext;
    if(!AC)return false;
    try{
      this.ctx=new AC();
      this.master=this.ctx.createGain();this.master.gain.value=0;
      this.out=this.ctx.createDynamicsCompressor();
      this.master.connect(this.out);this.out.connect(this.ctx.destination);
      var n=this.ctx.sampleRate,b=this.ctx.createBuffer(1,n,n),d=b.getChannelData(0);
      for(var i=0;i<n;i++)d[i]=Math.random()*2-1;
      this.noise=b;
    }catch(e){this.ctx=null;return false}
  }
  if(this.ctx.state==='suspended')this.ctx.resume();
  return true;
};

P._level=function(v,tc){
  if(!this.ctx)return;
  var g=this.master.gain,now=this.ctx.currentTime;
  g.cancelScheduledValues(now);g.setTargetAtTime(v,now,tc||.05);
};
P._halt=function(){if(this.timer){clearInterval(this.timer);this.timer=null}};

P.setMode=function(m){
  if(!this.ctx)return;
  this.mode=m;
  if(m==='patung'){
    this._level(0,.03);this._halt();this.sting();
  }else{
    this._level(this.on?this.vol:0,.05);
    this.bpm=(m==='lari')?150:136;
    if(!this.timer){
      this.step=0;this.t=this.ctx.currentTime+.08;
      this.timer=setInterval(this._tick.bind(this),25);
    }
  }
};

/* turunkan volume sebentar supaya suara pemandu terdengar jelas */
P.duck=function(sec){
  if(!this.ctx||!this.on||this.mode==='patung'||!this.mode)return;
  var g=this.master.gain,now=this.ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setTargetAtTime(this.vol*.3,now,.05);
  g.setTargetAtTime(this.vol,now+sec,.35);
};

P.stop=function(){this._halt();this.mode=null;this._level(0,.1)};

P.toggle=function(){
  this.on=!this.on;
  if(!this.ctx)return this.on;
  if(!this.on)this._level(0,.05);
  else if(this.mode&&this.mode!=='patung')this._level(this.vol,.05);
  return this.on;
};

P._tick=function(){
  var c=this.ctx;if(!c)return;
  var spb=60/this.bpm/4;
  while(this.t<c.currentTime+.12){
    if(this.on)this._play(this.step,this.t);
    this.t+=spb;this.step=(this.step+1)%64;
  }
};

/* ---- instrumen ---- */
P._osc=function(type,f,t,dur,vol,cut,dest){
  var c=this.ctx,o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+.008);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  if(cut){var fl=c.createBiquadFilter();fl.type='lowpass';fl.frequency.value=cut;o.connect(fl);fl.connect(g)}
  else o.connect(g);
  g.connect(dest||this.master);
  o.start(t);o.stop(t+dur+.03);
};
P._kick=function(t){
  var c=this.ctx,o=c.createOscillator(),g=c.createGain();
  o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);
  g.gain.setValueAtTime(.95,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);
  o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.24);
};
P._noise=function(t,dur,vol,hp){
  var c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  s.buffer=this.noise;f.type='highpass';f.frequency.value=hp;
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  s.connect(f);f.connect(g);g.connect(this.master);
  s.start(t,Math.random()*.5);s.stop(t+dur+.03);
};
P._boing=function(t){
  var c=this.ctx,o=c.createOscillator(),g=c.createGain();
  o.type='sine';o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(620,t+.16);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.22,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.2);
  o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.22);
};

/* ---- pola per 16th note (64 langkah = 4 bar) ---- */
P._play=function(s,t){
  var bar=(s>>4)&3,k=s&15,ch=CH[bar],root=ROOT[bar];
  if(this.mode==='lari'){
    if(k%4===0)this._kick(t);
    if(k===4||k===12)this._noise(t,.14,.5,1500);
    this._noise(t,.04,(k%4===2)?.3:.14,7000);
    if(k%2===0)this._osc('sawtooth',hz(root+((k===14)?7:0)),t,.16,.3,420);
    this._osc('triangle',hz(ch[ARP[k]]),t,.1,.12);
    if(bar%2===1&&HOOK[k]>=0)this._osc('square',hz(ch[HOOK[k]]+12),t,.14,.07,3500);
  }else if(this.mode==='lompat'){
    if(k%4===0)this._kick(t);
    if(k===4||k===12)this._noise(t,.14,.5,1500);
    if(k%2===0)this._noise(t,.04,.16,7000);
    if(k%4===2)this._osc('sawtooth',hz(root+12),t,.09,.3,700);
    if(k%2===0)this._osc('square',hz(ch[ARP[k]]+12),t,.07,.07,3000);
    if(k===0)this._boing(t);
  }
};

/* ---- efek ---- */
P.sting=function(){
  if(!this.ctx||!this.on)return;
  var t=this.ctx.currentTime,n=[660,440,330],i;
  for(i=0;i<n.length;i++)this._osc('square',n[i],t+i*.11,.14,.18,2500,this.out);
};
P.fanfare=function(){
  if(!this.ctx||!this.on)return;
  var t=this.ctx.currentTime+.1,n=[60,64,67,72,76,79],i;
  for(i=0;i<n.length;i++)this._osc('triangle',hz(n[i]),t+i*.12,.35,.3,null,this.out);
  this._osc('square',hz(84),t+n.length*.12,.7,.12,3000,this.out);
};

global.Music=Music;
})(window);
