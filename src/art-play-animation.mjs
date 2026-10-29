// One complete pose per actor. Never splice a second frame across the weapon.
export function artPlayPose(a,count=6) {
  let key='idle:'+(a.dir==='left'?'right':a.dir||'down'),flip=a.dir==='left';
  if(a.dead){key='fall';flip=a.hurtFacing==='left';}
  else if(a.hurt){key='hurt:'+(a.hurt>.18?0:1);flip=a.hurtFacing==='left';}
  else if(a.attack){key='attack:'+Math.min(5,Math.floor(a.attackElapsed/a.duration*6));flip=a.side==='left';}
  else if(a.moving){const dir=a.dir==='left'?'right':a.dir||'down';key='walk:'+dir+':'+Math.min(count-1,Math.floor(a.walkPhase*count));}
  return {key,flip};
}
export function createArtPlayAnimation(meta,images,usedFrames,motion){
  const actors=new Map();
  return {reset:()=>actors.clear(),supports:k=>!!meta[k],draw(c,a,kind,scale=motion.scale){
    const m=meta[kind];if(!m)return false;
    let {key,flip}=artPlayPose(a,m.walkCount||6);
    if(a.actorKey&&Number.isFinite(a.visualTime)){
      let previous=actors.get(a.actorKey);
      if(a.attack||a.hurt||a.dead)actors.delete(a.actorKey);
      else if(a.moving)actors.set(a.actorKey,{phase:a.walkPhase,dir:a.dir,moving:true});
      else if(previous&&previous.dir===a.dir){
        if(previous.moving){previous.moving=false;previous.stoppedAt=a.visualTime;}
        const age=a.visualTime-previous.stoppedAt,duration=m.settleSeconds||0;
        if(age>=0&&age<duration){
          const dir=a.dir==='left'?'right':a.dir,start=Math.round(previous.phase*4)%4,step=age<duration/2?0:1;
          key='settle:'+dir+':'+start+':'+step;
        }else actors.delete(a.actorKey);
      }else actors.delete(a.actorKey);
    }
    const f=m.frames[key]||m.frames['idle:down'];
    usedFrames[kind].add(key);
    const u=motion.height*scale/m.bodyHeight;
    c.save();c.translate(Math.round(a.x),Math.round(a.y));
    if(!!flip!==!!f.flip)c.scale(-1,1);
    const w=Math.round(f.w*u),h=Math.round(f.h*u),dx=Math.round(f.dx*u),dy=Math.round(f.dy*u);
    const feet=(f.feet||[]).map(p=>({x:dx+p.x*w/f.w,y:dy+p.y*h/f.h,width:p.width*w/f.w}));
    const center=feet.length?feet.reduce((s,p)=>s+p.x,0)/feet.length:0;
    if(a.shadows!==false){
    c.fillStyle='#070d0a38';c.beginPath();c.ellipse(center,1.5,Math.max(13,...feet.map(p=>Math.abs(p.x-center)+p.width/2)),3,0,0,Math.PI*2);c.fill();
    if(!a.dead)for(const foot of feet){c.fillStyle='#05090799';c.beginPath();c.ellipse(foot.x,foot.y+.5,Math.max(3,foot.width*.5),1.3,0,0,Math.PI*2);c.fill();}
    }
    if(a.hurt>.29)c.globalAlpha=.7;
    c.drawImage(images[kind],f.x,f.y,f.w,f.h,dx,dy,w,h);
    c.restore();return true;
  }};
}
