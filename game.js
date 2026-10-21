(function(){
'use strict';
var $=function(i){return document.getElementById(i)};
var v=$('v'),ov=$('ov'),pr=$('prompt'),st=$('stars'),go=$('go'),snd=$('snd');
var md=new MotionDetector({width:64,height:36});
var mu=new Music();
var stream=null,facing='user',mirror=true,cam=false,camTried=false,voice=true,run=false,calibrating=false;
var raf=null,lastF=0,timer=null;
var MISI={
 lari:{e:'🦌',t:'KIJANG LARI!',s:'Berlari di tempat, lengan diayun',d:13},
 lompat:{e:'🐰',t:'KELINCI LOMPAT!',s:'Melompat di tempat, mendarat lentur',d:13},
 patung:{e:'🗿',t:'PATUNG!',s:'Berhenti dan diam seperti patung',d:10}
};
var EMPTY='☆☆☆☆☆☆☆☆☆☆',N=10,seq=['lari','lompat','patung','lompat','lari','patung','lari','lompat','patung','lompat'];
var cur=-1,okc=0,res=[],act=0,tot=0;

function say(x){if(!voice||!window.speechSynthesis)return;try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(x);u.lang='id-ID';u.rate=.95;speechSynthesis.speak(u)}catch(e){}}

function loop(ts){
  raf=requestAnimationFrame(loop);
  if(ts-lastF<80)return; lastF=ts;
  if(!cam||v.readyState<2)return;
  md.update(v,performance.now());
  // gambar overlay area gerak
  var g=ov.getContext('2d');g.clearRect(0,0,ov.width,ov.height);
  g.fillStyle='rgba(255,138,0,.55)';
  var cw=ov.width/md.W,ch=ov.height/md.H;
  for(var k=0;k<md.pts.length;k++){var p=md.pts[k],px=p%md.W;g.fillRect((mirror?md.W-1-px:px)*cw,((p/md.W)|0)*ch,cw+.5,ch+.5)}
  $('mv').querySelector('i').style.width=Math.min(100,md.energy*1400)+'%';
  if(run&&cur>=0){
    tot++;
    if(seq[cur]==='patung'){if(md.isStill())act++}else if(md.isMoving())act++;
  }
  $('cnt').textContent='Lompatan: '+md.jumps;
}

function judge(){
  var m=seq[cur],ok;
  if(!cam)ok=true;
  else if(m==='lari')ok=tot>0&&act/tot>=.5;
  else if(m==='lompat')ok=md.jumps>=3&&tot>0&&act/tot>=.35;
  else ok=tot>0&&act/tot>=.7;
  res.push(ok);if(ok)okc++;
  $('ok').textContent='Berhasil: '+okc;
  st.textContent=res.map(function(r){return r?'⭐':'☆'}).join('')+EMPTY.slice(res.length);
}

function next(){
  if(cur>=0)judge();
  cur++;
  if(cur>=N)return finish();
  var m=MISI[seq[cur]];act=0;tot=0;md.resetJumps();
  $('pcard').setAttribute('data-m',seq[cur]);pr.innerHTML='<span class="em">'+m.e+'</span>'+m.t+'<small>'+m.s+'</small>';
  mu.setMode(seq[cur]);
  say(m.t.toLowerCase()+' '+m.s.toLowerCase());
  mu.duck(2.6);   // musik dikecilkan sebentar supaya suara pemandu jelas
  $('rnd').textContent='Misi '+(cur+1)+'/'+N;
  var b=$('time').querySelector('i');b.style.transition='none';b.style.width='100%';
  requestAnimationFrame(function(){requestAnimationFrame(function(){b.style.transition='width '+m.d+'s linear';b.style.width='0%'})});
  timer=setTimeout(next,m.d*1000);
}

function finish(){
  run=false;clearTimeout(timer);
  mu.stop();mu.fanfare();
  var pct=okc/N,msg=pct>=.8?'Luar biasa! Kelas super lincah! 🏆':pct>=.5?'Hebat! Ayo coba lagi biar makin lincah! 👏':'Bagus sudah mencoba! Main lagi yuk! 💪';
  $('pcard').setAttribute('data-m','done');pr.innerHTML='<span class="em">🎉</span>'+okc+' dari '+N+' misi berhasil<small>'+msg+'</small>';
  say(okc+' dari '+N+' misi berhasil. '+msg.replace(/[^\w\s!.,?]/g,''));
  go.textContent='↻ Main Lagi';go.disabled=false;
  $('time').querySelector('i').style.width='0%';
}

function countdown(n){
  if(n===0){
    if(calibrating){md.endCalibration();calibrating=false}
    run=true;next();return;
  }
  $('pcard').removeAttribute('data-m');pr.innerHTML='<span class="em">'+n+'</span>Bersiap...<small>Berdiri diam, jarak sejangkauan lengan</small>';
  if(n===3){say('Bersiap. Berdiri diam dengan jarak sejangkauan lengan');if(cam){md.startCalibration();calibrating=true}}
  setTimeout(function(){countdown(n-1)},1000);
}

function start(){
  $('cam-off').classList.add('hide');
  $('nocam').classList.toggle('hide',cam);
  go.disabled=true;cur=-1;okc=0;res=[];st.textContent=EMPTY;$('ok').textContent='Berhasil: 0';
  countdown(3);
}

function openCam(){
  if(stream){stream.getTracks().forEach(function(t){t.stop()})}
  md.reset();
  return navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(s){
    stream=s;v.srcObject=s;v.play();cam=true;mirror=(facing==='user');
    v.style.transform=mirror?'scaleX(-1)':'none';
    $('cam-off').classList.add('hide');ov.width=320;ov.height=180;
    if(!raf)raf=requestAnimationFrame(loop);
  });
}
function keepAwake(){try{if(navigator.wakeLock){navigator.wakeLock.request('screen').catch(function(){})}}catch(e){}}

go.onclick=function(){
  keepAwake();
  mu.init();   // AudioContext harus dibuat dari klik/tap pengguna
  if(cam||camTried){start();return}
  camTried=true;
  $('cam-off').textContent='Menunggu izin kamera…';
  var fail=function(){cam=false;$('nocam').title='Kamera tidak bisa dipakai (izin ditolak atau browser membatasi file lokal). Game tetap jalan sebagai pemandu waktu.';start()};
  try{openCam().then(start).catch(fail)}catch(e){fail()}
};
$('flip').onclick=function(){
  facing=(facing==='user')?'environment':'user';
  try{openCam().catch(function(){facing=(facing==='user')?'environment':'user'})}catch(e){}
};
snd.onclick=function(){voice=!voice;snd.textContent=voice?'🔊':'🔇';if(!voice&&window.speechSynthesis)speechSynthesis.cancel()};
$('mus').onclick=function(){mu.init();this.textContent=mu.toggle()?'🎵':'🔕'};
$('sens').oninput=function(){
  var s=parseFloat(this.value);md.sensitivity=s;
  $('sensv').textContent=s<.85?'Rendah':s>1.25?'Tinggi':'Normal';
};

/* ---- layar penuh, tips, orientasi ---- */
var app=$('app'),fsb=$('fs'),de=document;
var reqFS=app.requestFullscreen||app.webkitRequestFullscreen;
if(!reqFS)fsb.classList.add('hide');   // iPhone: tidak ada fullscreen API, layout sudah memenuhi layar
function fsEl(){return de.fullscreenElement||de.webkitFullscreenElement}
function lockLS(){try{var o=screen.orientation;if(o&&o.lock)o.lock('landscape').catch(function(){})}catch(e){}}
function unlockLS(){try{if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock()}catch(e){}}
fsb.onclick=function(){
  if(fsEl()){var x=de.exitFullscreen||de.webkitExitFullscreen;try{x.call(de)}catch(e){}unlockLS();return}
  try{var p=reqFS.call(app);if(p&&p.then)p.then(lockLS).catch(function(){});else lockLS()}catch(e){}
};
function upd(){fsb.textContent=fsEl()?'✕':'⛶';if(!fsEl())unlockLS()}
de.addEventListener('fullscreenchange',upd);
de.addEventListener('webkitfullscreenchange',upd);
$('rotx').onclick=function(){app.classList.add('norot')};
$('tipb').onclick=function(){$('tips').classList.remove('hide')};
$('tipx').onclick=function(){$('tips').classList.add('hide')};
})();
