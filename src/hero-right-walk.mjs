import {rightWalkPose,drawRightWalkPose} from './hero-walk-motion.mjs';
export function setupRightWalkReview({reference,image,referenceImage,motion,config,audit}){
 const $=id=>document.getElementById(id),u=motion.height*motion.scale/112,state={kind:'male',cycles:0,playing:true,speed:1,moving:true,guides:false,trails:true,key:0},layer=$('rightActorLayer'),lc=layer.getContext('2d',{willReadFrequently:true});
 let last=0,maxObservedDrift=0,anchors=new Map();
 const poseAt=t=>rightWalkPose(config,state.kind,t);
 function compose(c,cycles,rootX,floorY,scale=1,guides=false){
  c.save();c.translate(rootX-80*scale,floorY-148*scale);c.scale(scale,scale);const pose=drawRightWalkPose(c,image,reference,config,state.kind,cycles,{guides});c.restore();return pose;
 }
 function keyframes(){
  const master=$('rightReference').getContext('2d'),ref=reference.frames[state.kind]['idle:right'];master.imageSmoothingEnabled=false;master.fillStyle='#22352b';master.fillRect(0,0,160,180);master.strokeStyle='#d8bd79';master.beginPath();master.moveTo(2,155);master.lineTo(158,155);master.stroke();master.drawImage(referenceImage,ref.x,ref.y,160,160,Math.round(80+ref.dx*u),Math.round(155+ref.dy*u),Math.round(160*u),Math.round(160*u));
  for(let i=0;i<4;i++){
   const canvas=$('rightKey'+i),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#22352b';c.fillRect(0,0,160,180);c.strokeStyle='#d8bd79';c.beginPath();c.moveTo(2,155);c.lineTo(158,155);c.stroke();
   compose(c,config.keyPhases[i],80,155,u,state.guides);
   c.fillStyle='#dcd8be';c.font='10px sans-serif';c.textAlign='center';c.fillText((i+1)+' · '+Math.round(config.keyPhases[i]*100)+'%',80,174);
   $('rightKeyButton'+i).setAttribute('aria-pressed',String(state.key===i));
  }
 }
 function render(){
  const c=$('rightWorld').getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#24362b';c.fillRect(0,0,480,220);
  c.strokeStyle='#53694a';c.lineWidth=1;for(let x=0;x<480;x+=24){c.beginPath();c.moveTo(x,36);c.lineTo(x,209);c.stroke();}for(let y=40;y<220;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(480,y);c.stroke();}
  const cycles=((state.cycles%8)+8)%8,root=80+(state.moving?config.cycleDistance*cycles*u:0),floor=190,pose=poseAt(cycles),[dx,dy]=reference.frames[state.kind]['idle:right'].sourceOffset;
  if(state.trails){
   for(const side of ['far','near']){
    const source=config.roles[state.kind][side],offset=side==='far'?.5:0,neutral=source.hip[0]+source.contact[0]-source.ankle[0],color=side==='near'?'#73d8f9':'#f4ba71';c.fillStyle=color+'77';
    for(let step=-1;step<=8;step++){
     const world=config.cycleDistance*step-config.cycleDistance*offset+neutral+config.cycleDistance*config.stanceFraction/2;
     const x=state.moving?80+(world+dx-80)*u:root+(neutral+dx-80)*u,y=floor+(dy+source.contact[1]-148)*u;
     if(x>=0&&x<=480){c.beginPath();c.ellipse(x,y+2,4,1.3,0,0,Math.PI*2);c.fill();}
    }
   }
  }
  lc.clearRect(0,0,480,220);lc.imageSmoothingEnabled=false;compose(lc,cycles,root,floor,u,state.guides);c.drawImage(layer,0,0);
  for(const [side,l]of Object.entries(pose.legs))if(l.stance){
   const id=state.kind+':'+l.supportId,previous=anchors.get(id);if(previous)maxObservedDrift=Math.max(maxObservedDrift,Math.hypot(l.worldContact[0]-previous[0],l.worldContact[1]-previous[1]));else anchors.set(id,l.worldContact);
   if(anchors.size>40)anchors.delete(anchors.keys().next().value);
   const x=root+(dx+l.contact[0]-80)*u,y=floor+(dy+l.contact[1]-148)*u;c.strokeStyle=side==='near'?'#8ae7ff':'#ffce8b';c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.stroke();
  }
  $('rightStatus').textContent=`${state.moving?'向前移動':'原地看姿勢'}｜${pose.legs.near.stance?'近腳支撐':'遠腳支撐'}｜${state.speed}×`;
  $('rightDrift').textContent=`支撐點計算漂移 ${maxObservedDrift.toFixed(3)} 來源像素；兩節骨長固定，關節拉伸 ${Math.max(...Object.values(pose.legs).map(l=>l.reachError)).toFixed(3)}。`;
  $('rightPhase').value=Math.round(pose.phase*1000);
  return {pose,root,floor,dx,dy};
 }
 function update(){
  for(const b of document.querySelectorAll('[data-right-kind]'))b.setAttribute('aria-pressed',String(b.dataset.rightKind===state.kind));
  for(const b of document.querySelectorAll('[data-right-speed]'))b.setAttribute('aria-pressed',String(Number(b.dataset.rightSpeed)===state.speed));
  for(const [id,key]of [['rightMoving','moving'],['rightGuides','guides'],['rightTrails','trails']])$(id).setAttribute('aria-pressed',String(state[key]));
  $('rightPlay').textContent=state.playing?'暫停':'播放';keyframes();render();
 }
 for(const b of document.querySelectorAll('[data-right-kind]'))b.onclick=()=>{state.kind=b.dataset.rightKind;state.cycles=0;state.key=0;anchors.clear();maxObservedDrift=0;update();};
 for(const b of document.querySelectorAll('[data-right-speed]'))b.onclick=()=>{state.speed=Number(b.dataset.rightSpeed);update();};
 for(let i=0;i<4;i++)$('rightKeyButton'+i).onclick=()=>{state.cycles=config.keyPhases[i];state.key=i;state.playing=false;anchors.clear();update();};
 for(const [id,key]of [['rightMoving','moving'],['rightGuides','guides'],['rightTrails','trails']])$(id).onclick=()=>{state[key]=!state[key];update();};
 $('rightPlay').onclick=()=>{state.playing=!state.playing;update();};
 $('rightPhase').oninput=e=>{state.cycles=Number(e.target.value)/1000;state.playing=false;state.key=Math.floor(state.cycles*4)%4;update();};
 $('rightDownload').onclick=()=>{
  const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=470;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#17291f';c.fillRect(0,0,1100,470);c.fillStyle='#ecdcae';c.font='bold 25px sans-serif';c.fillText((state.kind==='male'?'男角':'女角')+'｜右側四關鍵姿勢・母版校準 v0.9',22,35);
  const im=referenceImage,f=reference.frames[state.kind]['idle:right'];
  for(let i=0;i<5;i++){
   c.save();c.translate(i*220+20,90);c.scale(1.25,1.25);c.fillStyle='#22352b';c.fillRect(0,0,160,190);
   if(i===0)c.drawImage(im,f.x,f.y,160,160,0,7,160,160);else compose(c,config.keyPhases[i-1],80,155,1,state.guides);
   c.restore();c.fillStyle='#e5d4aa';c.font='15px sans-serif';c.fillText(i===0?'固定母版':(i+' '+config.keyLabels[i-1]),i*220+20,70);
  }
  c.font='16px sans-serif';c.fillStyle='#c9cfbd';c.fillText(reference.id+'｜近腿：青色；遠腿：橘色（骨架開啟時）',22,360);c.fillText('同一母版分件、同一尺度；大腿／小腿／靴不獨立縮放，武器保留原持劍手。',22,390);c.fillText('支撐腳先固定，再求膝蓋位置；技術校準通過不等於動作美感已驗收。',22,420);
  const a=document.createElement('a');a.download='right-walk-'+state.kind+'-keyposes-v1.png';a.href=canvas.toDataURL();a.click();
 };
 function tick(now){const dt=document.hidden?0:Math.min(60,now-last||0);last=now;if(state.playing){state.cycles+=dt/1000/config.cycleSeconds*state.speed;render();}requestAnimationFrame(tick);}
 update();requestAnimationFrame(tick);
 Object.defineProperty(window,'heroRightWalk',{value:{inspect:()=>{const cycles=((state.cycles%8)+8)%8,pose=poseAt(cycles);return structuredClone({...state,version:'hero-right-walk-0.9',cycles,pose,unit:u,worldRoot:80+(state.moving?config.cycleDistance*cycles*u:0),floor:190,sourceOffset:reference.frames[state.kind]['idle:right'].sourceOffset,referenceId:reference.id,maxObservedDrift,auditStatus:audit.status});}}});
}
