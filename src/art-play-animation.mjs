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
  return {supports:k=>!!meta[k],draw(c,a,kind,scale=motion.scale){
    const m=meta[kind];if(!m)return false;
    const {key,flip}=artPlayPose(a,m.walkCount||6),f=m.frames[key]||m.frames['idle:down'];
    usedFrames[kind].add(key);
    const u=motion.height*scale/m.bodyHeight;
    c.save();c.translate(Math.round(a.x),Math.round(a.y));
    c.fillStyle='#101a1555';c.beginPath();c.ellipse(0,3,14*scale/motion.scale,4,0,0,Math.PI*2);c.fill();
    if(!!flip!==!!f.flip)c.scale(-1,1);
    if(a.hurt>.29)c.globalAlpha=.7;
    c.drawImage(images[kind],f.x,f.y,f.w,f.h,Math.round(f.dx*u),Math.round(f.dy*u),Math.round(f.w*u),Math.round(f.h*u));
    c.restore();return true;
  }};
}
