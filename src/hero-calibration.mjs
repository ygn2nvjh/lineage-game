// Review fixed source identity before approving any replacement animation.
const data=globalThis.HERO_CALIBRATION,$=id=>document.getElementById(id),state={kind:'male',dir:'down',action:'idle',playing:true,phase:0,guides:false,overlay:false,zoom:false};
const images={};await Promise.all(Object.entries(data.images).map(async([key,url])=>{const im=new Image();im.src=url;await im.decode();images[key]=im;}));
const u=data.motion.height*data.motion.scale/112;
function source(which,key){
 if(which==='reference')return {image:images.reference,f:data.reference.frames[state.kind]['idle:'+state.dir],offset:0};
 if(which==='candidate')return {image:images.candidate,f:data.candidate[state.kind].frames[key],offset:0};
 const f=data.previous[state.kind].frames[key],feet=f.feet||[],center=feet.length?feet.reduce((s,p)=>s+p.x,0)/feet.length+f.dx:0;
 return {image:images[state.kind],f,offset:-center};
}
function sprite(c,which,key,x=80,y=155,alpha=1){
 const {image,f,offset}=source(which,key);if(!f)return;
 c.save();c.globalAlpha=alpha;
 c.drawImage(image,f.x,f.y,f.w,f.h,Math.round(x+(f.dx+offset)*u),Math.round(y+f.dy*u),Math.round(f.w*u),Math.round(f.h*u));c.restore();
}
function guide(c,which,x=80,y=155){
 const {f,offset}=source(which,'idle:'+state.dir),m=which==='previous'?data.standard.actors[state.kind].views[state.dir]:data.reference.records[state.kind][state.dir].marks;
 c.save();c.lineWidth=1;
 for(const [name,color]of [['head','#8de8fc'],['torso','#ff92d9']]){
  const mark=m[name],dx=which==='previous'?0:data.reference.frames[state.kind]['idle:'+state.dir].sourceOffset[0],dy=which==='previous'?0:37;
  c.strokeStyle=color;c.strokeRect(x+(f.dx+offset+dx+mark[0])*u,y+(f.dy+dy+mark[1])*u,mark[2]*u,mark[3]*u);
 }
 c.restore();
}
function board(id,which,key){
 const c=$(id).getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,160,180);c.fillStyle='#22352b';c.fillRect(0,0,160,180);
 c.strokeStyle='#d9bf7877';c.beginPath();c.moveTo(3,155.5);c.lineTo(157,155.5);c.stroke();
 c.fillStyle='#070d0a60';c.beginPath();c.ellipse(80,157,17,3,0,0,Math.PI*2);c.fill();
 if(state.overlay&&which!=='reference'&&state.action==='idle'){sprite(c,'reference','idle:'+state.dir,80,155,.5);sprite(c,which,key,80,155,.5);}
 else sprite(c,which,key);
 if(state.guides&&state.action==='idle')guide(c,which);
 c.fillStyle='#e9dbb7';c.font='9px sans-serif';c.textAlign='center';c.fillText(which==='reference'?'固定參考':state.action==='walk'?'步行 '+(state.phase+1)+'/12':'待機',80,173);
}
function render(){
 const key=state.action==='walk'?'walk:'+state.dir+':'+state.phase:'idle:'+state.dir;
 board('referenceCanvas','reference','idle:'+state.dir);board('previousCanvas','previous',key);board('candidateCanvas','candidate',key);
 $('frame').value=state.phase;$('frameLabel').textContent=`第 ${state.phase+1} / 12 格`;
}
function strip(){
 const c=$('cycle').getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#22352b';c.fillRect(0,0,1440,180);
 for(let i=0;i<12;i++){sprite(c,'candidate','walk:'+state.dir+':'+i,60+i*120,155);c.fillStyle='#e9dbb7';c.font='12px sans-serif';c.textAlign='center';c.fillText(String(i+1),60+i*120,175);}
}
function update(){
 document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===state.kind)));
 document.querySelectorAll('[data-dir]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dir===state.dir)));
 document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===state.action)));
 for(const key of ['guides','overlay','zoom'])$(key).setAttribute('aria-pressed',String(state[key]));
 $('play').textContent=state.playing?'暫停逐格看':'繼續播放';$('boards').dataset.zoom=String(state.zoom);
 $('overlay').disabled=state.action!=='idle';$('guides').disabled=state.action!=='idle';$('frame').disabled=state.action!=='walk';
 $('explanation').textContent=state.action==='walk'?'母版保持原站姿；中、右兩欄同步播放同一格。不同步態不能用像素差評分，請看鎧甲、腿甲、靴型是否保持。':'三欄同倍率、腳底基準對齊。可開疊圖與部位框；站姿不同也會造成差異，數值不等於美術評分。';
 const m=data.audit.measurements[state.kind][state.dir];$('measureRows').replaceChildren(...[
  ['完整外框寬 × 高',m.reference.width.toFixed(0)+' × '+m.reference.height,m.previous.width.toFixed(0)+' × '+m.previous.height,m.reference.width.toFixed(0)+' × '+m.reference.height],
  ['頭高（人工估測）',m.reference.headHeightEstimate,m.previous.headHeightEstimate,m.reference.headHeightEstimate],
  ['軀幹寬（人工估測）',m.reference.torsoWidthEstimate,m.previous.torsoWidthEstimate,m.reference.torsoWidthEstimate],
  ['待機相對母版差異像素','基準','不當品質分數',m.candidateIdlePixelDifferences],
  ['腿甲、靴子來源','原靜態稿','另生成的分件','同一母版像素']
 ].map(cells=>{const tr=document.createElement('tr');for(const cell of cells){const td=document.createElement('td');td.textContent=cell;tr.append(td);}return tr;}));
 strip();render();
}
for(const field of ['kind','dir','action'])document.querySelectorAll('[data-'+field+']').forEach(b=>b.onclick=()=>{state[field]=b.dataset[field];state.phase=0;update();});
for(const key of ['guides','overlay','zoom'])$(key).onclick=()=>{state[key]=!state[key];update();};
$('play').onclick=()=>{state.playing=!state.playing;update();};
$('frame').oninput=e=>{state.phase=Number(e.target.value);state.playing=false;update();};
$('step').onclick=()=>{state.action='walk';state.playing=false;state.phase=(state.phase+1)%12;update();};
$('cycle').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();state.phase=Math.min(11,Math.floor((e.clientX-r.left)/r.width*12));state.action='walk';state.playing=false;update();};
$('download').onclick=()=>{
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=1000;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#14251c';c.fillRect(0,0,960,1000);c.fillStyle='#f0dfb2';c.font='bold 26px sans-serif';c.fillText((state.kind==='male'?'男角':'女角')+'｜固定母版校準 v0.8',22,38);c.font='16px sans-serif';
 for(const [i,label]of ['固定靜態母版','目前動態 v0.7：待機','母版分件候選：待機'].entries())c.fillText(label,i*320+24,76);
 const previousDir=state.dir;
 try{for(const [row,dir]of ['down','right','up'].entries()){
  state.dir=dir;
  for(const [col,which]of ['reference','previous','candidate'].entries()){
   c.save();c.translate(col*320+24,90+row*275);c.scale(1.7,1.7);c.fillStyle='#22352b';c.fillRect(0,0,160,155);c.strokeStyle='#d8be7a';c.beginPath();c.moveTo(0,148.5);c.lineTo(160,148.5);c.stroke();sprite(c,which,'idle:'+dir,80,148);c.restore();
  }
  c.fillStyle='#e8d9b6';c.fillText({down:'正面',right:'右側',up:'背面'}[dir],24,90+row*275+20);
 }}finally{state.dir=previousDir;}
 c.fillStyle='#c3ccb8';c.font='14px sans-serif';c.fillText(data.reference.id,22,946);c.fillText('母版固定；同倍率／同地面基準；不同站姿的像素差不等於品質評分。',22,971);
 const a=document.createElement('a');a.download='hero-calibration-'+state.kind+'-reference-v1.png';a.href=canvas.toDataURL('image/png');a.click();
};
let last=0,accumulator=0;
function tick(now){const dt=document.hidden?0:Math.min(80,now-last||0);last=now;if(state.playing&&state.action==='walk'){accumulator+=dt;if(accumulator>=90){state.phase=(state.phase+1)%12;accumulator%=90;render();}}requestAnimationFrame(tick);}
update();requestAnimationFrame(tick);
Object.defineProperty(window,'heroCalibration',{value:{inspect:()=>structuredClone({...state,referenceId:data.reference.id,version:'hero-calibration-0.8',frameCount:data.audit.frameCount,referenceDifference:data.audit.measurements[state.kind][state.dir].candidateIdlePixelDifferences,supportedActions:data.audit.supportedActions,pendingActions:data.audit.pendingActions})}});document.documentElement.dataset.ready='true';
