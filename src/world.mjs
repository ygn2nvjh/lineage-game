import {ART_MOTION} from './art-config.mjs';
import {drawActor} from './sprites.mjs';

const dirFromAngle=a=>Math.abs(Math.cos(a))>Math.abs(Math.sin(a))?(Math.cos(a)>0?'right':'left'):(Math.sin(a)>0?'down':'up');

export class World {
  constructor(canvas,stage,onPoint,art,worldArt){
    this.canvas=canvas;this.stage=stage;this.ctx=canvas.getContext('2d');this.camera={x:0,y:0};this.particles=[];this.art=art;this.worldArt=worldArt;this.motion=new WeakMap();this.drag={x:0,y:0};this.gesture=null;
    this.resize=()=>{
      const b=stage.getBoundingClientRect(),area=document.getElementById('worldArea').getBoundingClientRect();
      const size=Math.max(1,Math.floor(Math.min(area.width,area.height)));
      const clean=document.getElementById('cleanViewport');clean.style.width=`${size}px`;clean.style.height=`${size}px`;
      canvas.parentElement.style.width=`${b.width}px`;canvas.parentElement.style.height=`${b.height}px`;
      this.width=480*b.width/size;this.height=480*b.height/size;
      const center=clean.getBoundingClientRect();
      this.focus={x:(center.left-b.left+size/2)*this.width/b.width,y:(center.top-b.top+size/2)*this.height/b.height};
      const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(this.width*dpr);canvas.height=Math.round(this.height*dpr);
      this.ctx.setTransform(dpr,0,0,dpr,0,0);this.ctx.imageSmoothingEnabled=false;
    };
    const observer=new ResizeObserver(this.resize);observer.observe(stage);observer.observe(document.getElementById('worldArea'));this.resize();
    const clear=()=>{this.gesture=null;this.drag={x:0,y:0};};this.clearDrag=clear;
    canvas.addEventListener('pointerdown',e=>{if(this.gesture)return;this.gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{const g=this.gesture;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y,length=Math.hypot(dx,dy);if(!g.dragged&&length<12)return;g.dragged=true;this.drag={x:dx/Math.max(length,52),y:dy/Math.max(length,52)};});
    canvas.addEventListener('pointerup',e=>{const g=this.gesture;if(!g||g.id!==e.pointerId)return;const dragged=g.dragged;clear();if(dragged)return;const b=canvas.getBoundingClientRect();onPoint({x:(e.clientX-b.left)/b.width*this.width+this.camera.x,y:(e.clientY-b.top)/b.height*this.height+this.camera.y});});
    for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(this.gesture?.id===e.pointerId)clear();});
    window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);

  }
  particle(event){
    if(!['damage','hurt','miss','dodge','potion','heal','level'].includes(event.type))return;
    if(['damage','hurt'].includes(event.type))this.particles.push({x:event.x,y:event.y-60,burst:true,life:.22,color:'#ffe1a0'});
    const text=event.type==='level'?'LEVEL UP':event.type==='potion'||event.type==='heal'?`+${Math.ceil(event.amount)}`:event.text;
    this.particles.push({x:event.x,y:event.y-104,text,life:1,color:event.type==='hurt'?'#ff8b7e':event.type==='heal'||event.type==='potion'?'#b9ed9f':event.type==='level'?'#ffe6a0':'#fff0bf'});
  }
  rect(x,y,w,h,color){this.ctx.fillStyle=color;this.ctx.fillRect(Math.round(x),Math.round(y),w,h);}
  text(text,x,y,color='#f4e5b9',size=12){
    const ctx=this.ctx;ctx.font=`bold ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#142019';ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);
  }
  tree(x,y,small=false){
    const r=(...a)=>this.rect(...a),s=small?.8:1;
    this.ctx.save();this.ctx.translate(x,y);this.ctx.scale(s,s);
    r(-8,0,15,25,'#59452f');r(-4,1,4,22,'#81613a');r(-30,-29,60,41,'#234b31');r(-24,-49,49,38,'#32633c');r(-16,-62,33,32,'#447447');r(-18,-35,12,12,'#4d7d49');r(8,-21,12,10,'#39683f');this.ctx.restore();
  }
  building(b){
    const r=(...a)=>this.rect(...a),x=b.x,y=b.y;
    r(x-90,y-20,180,105,'#63543e');r(x-83,y-13,166,90,'#9c8561');
    for(let i=0;i<9;i++)r(x-86+i*20,y-52+(i%2)*3,23,45,b.action==='shop'?'#654334':'#4b4c3d');
    r(x-92,y-52,184,13,'#30291e');r(x-18,y+25,36,52,'#382d22');r(x-12,y+28,24,45,'#765c3e');
    r(x-63,y+12,25,27,'#242b28');r(x+38,y+12,25,27,'#242b28');r(x-61,y+14,21,4,'#e6c37c');r(x+40,y+14,21,4,'#e6c37c');
    this.text(b.name,x,y-66,'#f6deaa',14);
    r(x-16,y+87,32,5,'#bca071');
  }
  drawGoblin(e,m,g){
    const ctx=this.ctx,r=(...a)=>this.rect(...a),orc=m.sprite==='orc';
    ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y));
    const step=e.moving?Math.sin(g.clock*10)*2:0;
    r(-13,10,26,5,'#17291e88');r(-8,4+step,6,12,'#494938');r(3,4-step,6,12,'#494938');
    r(-11,-14,22,23,orc?'#71603e':'#6e6250');r(-10,-32,20,20,orc?'#94a46c':'#91aa64');r(-15,-27,6,8,'#84985c');r(9,-27,6,8,'#84985c');
    r(-6,-25,4,3,'#292d21');r(3,-25,4,3,'#292d21');r(-3,-17,7,2,'#ddcc8e');r(-16,-11,5,17,'#869a5c');r(11,-11,5,17,'#869a5c');
    r(16,-18,3,30,'#836044');r(13,-22,9,9,'#a9b2a3');if(e.hurt>0)r(-18,-36,36,54,'#fff2c977');
    ctx.restore();
  }
  actorState(entity,source,dir){
    let m=this.motion.get(entity);if(!m){m={x:entity.x,y:entity.y,phase:0};this.motion.set(entity,m);}
    const moved=Math.hypot(entity.x-m.x,entity.y-m.y);if(moved>0&&moved<50)m.phase=(m.phase+moved/ART_MOTION.stride)%1;
    const moving=!!source.moving&&moved>.001;if(!moving)m.phase=0;m.x=entity.x;m.y=entity.y;
    const a=source.animation;
    return {x:entity.x,y:entity.y,dir,moving,walkPhase:m.phase,attack:Math.max(0,(a?.duration||0)-(a?.elapsed||0)),attackElapsed:a?.elapsed||0,duration:a?.duration,attackStyle:a?.style||'slash',side:a?.side||dir,hurt:source.hurt||0,hurtFacing:source.hurtFacing||dir,dead:!!source.dead,fall:source.fall||0};
  }
  render(g,dt=0){
    const ctx=this.ctx,p=g.p,map=g.map,r=(...a)=>this.rect(...a),cam=this.camera;
    cam.x=p.x-this.focus.x;
    cam.y=p.y-this.focus.y;
    ctx.clearRect(0,0,this.width,this.height);r(0,0,this.width,this.height,'#17261c');
    ctx.save();ctx.translate(-Math.round(cam.x),-Math.round(cam.y));
    if(map.art==='twilight'){
      this.worldArt.ground(ctx,map,{x:cam.x,y:cam.y,width:this.width,height:this.height});
      ctx.strokeStyle='#d9c799aa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(map.exit.x,map.exit.y,map.exit.radius,map.exit.radius*.6,0,0,Math.PI*2);ctx.stroke();
      this.text(map.safe?'↑ 北門・前往墓園':'↓ 返回暮色村莊',map.exit.x,map.exit.y-38,'#e4d5ab',12);
    }else{
    const tile=32,sx=Math.floor(cam.x/tile)*tile,sy=Math.floor(cam.y/tile)*tile;
    for(let y=sy;y<cam.y+this.height+tile;y+=tile)for(let x=sx;x<cam.x+this.width+tile;x+=tile){
      // Continue the same terrain behind the HUD and operation dock, including map-edge padding.
      const hash=Math.abs((x*37+y*19)%101),road=map.safe?(Math.abs(x-map.width/2)<86||Math.abs(y-530)<70):(Math.abs(x-600)<34&&y>650);
      if(road){r(x,y,tile,tile,hash%3?'#827b66':'#8b8470');r(x+2,y+2,tile-4,tile-4,hash%4?'#918972':'#7d7865');r(x+4,y+28,22,2,'#696551');}
      else{r(x,y,tile,tile,hash%2?'#426344':'#466748');r(x+5,y+9,4,3,hash%3?'#57734b':'#364f37');r(x+23,y+23,5,3,'#36583b');if(hash%13===0)r(x+18,y+12,3,3,'#b1a26a');}
    }
    const exit=map.exit;
    ctx.strokeStyle='#e3cd8b99';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.ellipse(exit.x,exit.y,exit.radius,exit.radius*.6,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    this.text(map.safe?'↑ 通往古魯丁野外':'↓ 返回城鎮・免費',exit.x,exit.y-34,'#f4dfa2',14);
    this.text(map.safe?'城鎮北方出口':'野外南方出口',exit.x,exit.y+7,'#fff1bf',11);
    if(map.safe){
      for(const b of map.buildings)this.building(b);
      r(452,490,56,38,'#505e53');r(458,486,44,29,'#a6a58a');r(463,491,34,20,'#3c777c');r(471,464,17,40,'#8c8d7b');r(465,461,29,7,'#c0b99b');
      for(const [x,y] of [[150,180],[810,180],[160,650],[800,670],[280,820],[680,840],[110,420],[850,440]])this.tree(x,y);
      this.text('安全區・整備後再出發',480,620,'#d9dda9',12);
    }else{
      for(let i=0;i<24;i++){
        const x=40+((i*241)%1120),y=65+((i*193)%1080);
        if(Math.abs(x-600)<205&&y>680)continue;
        if(map.spawns.some(s=>Math.hypot(s.x-x,s.y-y)<62))continue;
        this.tree(x,y,true);
      }
      for(const o of map.obstacles){
        r(o.x,o.y,o.width,o.height,'#59665b');r(o.x+4,o.y-4,o.width-10,o.height-8,'#7b887a');r(o.x+10,o.y+3,o.width*.45,8,'#9ba491');r(o.x+o.width*.7,o.y+14,5,o.height-20,'#515e53');
      }
    }
    }
    if(g.goal){ctx.strokeStyle='#e9d18b';ctx.lineWidth=2;ctx.strokeRect(g.goal.x-6,g.goal.y-6,12,12);}
    const actors=[...(map.art==='twilight'?this.worldArt.objects(map).map(prop=>({y:prop.y,prop})):[]),...g.enemies.filter(e=>!e.dead||e.fall<3.9).map(e=>({y:e.y,e})),{y:p.y,player:true},...(g.party||[]).map(member=>({y:member.game.p.y,member}))].sort((a,b)=>a.y-b.y);
    const reveal=[p,...g.enemies.filter(e=>e.id===g.target&&!e.dead)];this.lastOccluded=[];
    for(const actor of actors){
      if(actor.member){const m=actor.member,a=m.game.p,v=this.actorState(a,{moving:m.game.moving,animation:m.game.playerAnimation,hurt:m.game.hurt,hurtFacing:m.game.playerHurtFacing,dead:m.game.fallen||m.game.deathPending>0,fall:m.game.fallen?1:ART_MOTION.fall-(m.game.deathPending||0)},dirFromAngle(m.game.face||0));this.art.draw(ctx,v,m.sex);this.text(m.name+(m.connected?'':'・離線'),a.x,a.y-110,'#a4d9ef',11);continue;}

      if(actor.prop){const prop=actor.prop;if(prop.x+prop.width/2>=cam.x&&prop.x-prop.width/2<=cam.x+this.width&&prop.y>=cam.y&&prop.y-prop.height<=cam.y+this.height){this.worldArt.prop(ctx,prop,{reveal,occluded:this.lastOccluded});if(prop.name)this.text(prop.name,prop.x,prop.y-prop.height-8,'#e5d8ba',12);}continue;}
      if(actor.player){
        const visual=this.actorState(p,{moving:g.moving,animation:g.playerAnimation,hurt:g.hurt,hurtFacing:g.playerHurtFacing,dead:g.deathPending>0,fall:g.deathPending>0?ART_MOTION.fall-g.deathPending:0},dirFromAngle(g.face));
        this.art.draw(ctx,visual,p.sex);this.lastPlayerVisual=visual;
        if(!visual.dead)this.text(p.name,p.x,p.y-108,'#e8e4bc',11);continue;
      }
      const e=actor.e,m=g.index.monsters.get(e.monsterId);
      if(e.x<cam.x-80||e.x>cam.x+this.width+80||e.y<cam.y-80||e.y>cam.y+this.height+80)continue;
      if(g.target===e.id){ctx.strokeStyle='#f3d17c';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+12,m.sprite==='ogre'?30:21,10,0,0,Math.PI*2);ctx.stroke();}
      const appearance=g.index.monsterAppearances.get(m.appearanceId),kind=appearance?.id||m.sprite,boneArt=this.art.supports(kind),displayScale=ART_MOTION.scale*(appearance?.scale||1);
      const visual=this.actorState(e,e,e.moving?dirFromAngle(Math.atan2(e.y-(this.previousEnemyY?.get(e)??e.y),e.x-(this.previousEnemyX?.get(e)??e.x))):dirFromAngle(Math.atan2(p.y-e.y,p.x-e.x)));
      this.previousEnemyX??=new WeakMap();this.previousEnemyY??=new WeakMap();this.previousEnemyX.set(e,e.x);this.previousEnemyY.set(e,e.y);
      if(boneArt)this.art.draw(ctx,visual,kind,displayScale);
      else{ctx.save();ctx.translate(e.x,e.y);ctx.scale(1.55,1.55);const local={...e,x:0,y:0};if(m.sprite==='goblin'||m.sprite==='orc')this.drawGoblin(local,m,g);else drawActor(ctx,0,0,m.sprite,visual.dir,e.hurt,e.swing,e.moving,e.dead,g.clock,g.index.monsterAppearances.get(m.appearanceId));ctx.restore();}
      if(e.dead)continue;
      const top=boneArt?108*(appearance?.scale||1):m.sprite==='ogre'?155:86;
      this.text(`Lv.${m.level} ${m.name}`,e.x,e.y-top,m.aggressive?'#f4bb9c':'#e4dec4',10);
      r(e.x-18,e.y-top+5,36,4,'#3b2822');r(e.x-18,e.y-top+5,36*e.hp/m.hp,4,'#b8644e');
      if(e.active)this.text('!',e.x+23,e.y-top+10,'#ffd49a',13);
    }
    for(const particle of this.particles){particle.life-=dt;particle.y-=dt*21;ctx.globalAlpha=Math.min(1,particle.life*2);if(particle.burst){ctx.strokeStyle=particle.color;ctx.lineWidth=2;for(let i=0;i<6;i++){const a=i*Math.PI/3,r=8+(1-particle.life/.22)*16;ctx.beginPath();ctx.moveTo(particle.x+Math.cos(a)*4,particle.y+Math.sin(a)*4);ctx.lineTo(particle.x+Math.cos(a)*r,particle.y+Math.sin(a)*r);ctx.stroke();}}else this.text(particle.text,particle.x,particle.y,particle.color,particle.text==='LEVEL UP'?20:15);}
    ctx.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
    ctx.restore();
    if(!map.safe){
      const vignette=ctx.createRadialGradient(this.width/2,this.height/2,80,this.width/2,this.height/2,this.height*.7);vignette.addColorStop(0,'#0e181000');vignette.addColorStop(1,'#0a140d55');ctx.fillStyle=vignette;ctx.fillRect(0,0,this.width,this.height);
    }
  }
}
