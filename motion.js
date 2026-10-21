/* motion.js – pembaca gerakan dari kamera (tanpa library, offline).
   Peningkatan dari versi awal:
   1. Kompensasi kecerahan: perubahan exposure otomatis kamera tidak dihitung sebagai gerakan.
   2. Filter noise: piksel gerak yang sendirian dibuang.
   3. Kalibrasi: noise ruangan diukur saat hitung mundur.
   4. Deteksi lompatan berdasar arah VERTIKAL gerakan (bukan sekadar lonjakan energi),
      jadi berlari di tempat tidak mudah terhitung sebagai lompatan.
   API: var md=new MotionDetector(); md.update(video) tiap frame;
        md.energy, md.jumps, md.pts, md.isMoving(), md.isStill() */
(function(global){
'use strict';
function MotionDetector(opt){
  opt=opt||{};
  this.W=opt.width||64; this.H=opt.height||48; this.n=this.W*this.H;
  this.sensitivity=opt.sensitivity||1;
  this.c=document.createElement('canvas'); this.c.width=this.W; this.c.height=this.H;
  this.ctx=this.c.getContext('2d',{willReadFrequently:true});
  this.noise=.004; this.cal=null;
  this.reset();
}
var P=MotionDetector.prototype;

P.reset=function(){
  this.prev=null; this.raw=0; this.energy=0; this.pts=[];
  this.y=null; this.base=null; this.armed=true; this.lastJ=0; this.jumps=0; this.delta=0;
};
P.resetJumps=function(){this.jumps=0;this.armed=true;this.lastJ=0};

/* kalibrasi: panggil start saat semua diam, end beberapa detik kemudian */
P.startCalibration=function(){this.cal=[]};
P.endCalibration=function(){
  var a=this.cal; this.cal=null;
  if(!a||a.length<4)return;
  var m=0,i; for(i=0;i<a.length;i++)m+=a[i]; m/=a.length;
  var s=0; for(i=0;i<a.length;i++)s+=(a[i]-m)*(a[i]-m); s=Math.sqrt(s/a.length);
  this.noise=Math.min(.03,Math.max(.003,m+2*s));
};

P.isMoving=function(){return this.energy>.022/this.sensitivity};
P.isStill=function(){return this.energy<.010*this.sensitivity};

P.update=function(video,now){
  now=now||performance.now();
  var W=this.W,H=this.H,n=this.n,i,x,y;
  var vw=video.videoWidth||W,vh=video.videoHeight||H,sw=vw,sh=vh,sxo=0,syo=0;
  if(vw/vh>W/H){sw=vh*W/H;sxo=(vw-sw)/2}else{sh=vw*H/W;syo=(vh-sh)/2}   // crop ala object-fit:cover
  this.ctx.drawImage(video,sxo,syo,sw,sh,0,0,W,H);
  var d=this.ctx.getImageData(0,0,W,H).data, cur=new Uint8Array(n);
  for(i=0;i<n;i++){cur[i]=(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11)|0}
  var prev=this.prev; this.prev=cur;
  if(!prev){this.pts=[];return this}

  // 1) kompensasi perubahan kecerahan global
  var shift=0; for(i=0;i<n;i++)shift+=cur[i]-prev[i]; shift/=n;
  var thr=26/this.sensitivity, raw=new Uint8Array(n);
  for(i=0;i<n;i++){ if(Math.abs(cur[i]-prev[i]-shift)>thr)raw[i]=1 }

  // 2) buang piksel sendirian (noise sensor)
  var pts=[],rows=new Uint16Array(H),cnt=0,sumY=0;
  for(y=0;y<H;y++)for(x=0;x<W;x++){
    i=y*W+x; if(!raw[i])continue;
    var nb=(x>0&&raw[i-1])+(x<W-1&&raw[i+1])+(y>0&&raw[i-W])+(y<H-1&&raw[i+W]);
    if(nb>=2){pts.push(i);rows[y]++;cnt++;sumY+=y}
  }
  this.pts=pts;
  this.raw=cnt/n;
  if(this.cal){this.cal.push(this.raw)}
  var e=Math.max(0,this.raw-this.noise);
  this.energy=this.energy*.55+e*.45;

  // 3) posisi vertikal gerakan (0 = atas, 1 = bawah): campuran titik tengah & tepi atas
  if(cnt>n*.012){
    var acc=0,top=0; for(y=0;y<H;y++){acc+=rows[y]; if(acc>=cnt*.1){top=y;break}}
    var m=(sumY/cnt/H)*.5+(top/H)*.5;
    this.y=this.y===null?m:this.y*.4+m*.6;
    this.base=this.base===null?this.y:this.base+(this.y-this.base)*.08;
    this.delta=this.base-this.y;               // positif = gerakan naik
    var jt=.055/this.sensitivity;
    if(this.armed&&this.delta>jt&&this.energy>.03/this.sensitivity&&now-this.lastJ>320){
      this.jumps++; this.lastJ=now; this.armed=false;
    }
    if(!this.armed&&this.delta<jt*.25)this.armed=true;  // siap hitung lompatan berikutnya
  }else{
    this.delta*=.9; if(this.delta<.01)this.armed=true;
  }
  return this;
};
global.MotionDetector=MotionDetector;
})(window);
