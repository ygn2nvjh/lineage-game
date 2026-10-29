// Pre-bake independently jointed legs. The complete torso contains the only weapon.
const artPlayRigBodies=new WeakMap();
export function artPlayLegPose(phase,far=false,side=true){
  const t=phase*Math.PI*2+(far?Math.PI:0),s=Math.sin(t),swing=Math.max(0,Math.cos(t));
  return side?{thigh:-s*.58,knee:swing*.94,depth:1,lift:swing*9}:
    {thigh:s*.05,knee:-s*.08,depth:1,lift:swing*9};
}
export function bakeArtPlayRig(ctx,image,parts,dir,phase,standing=false){
  const side=dir==='right',hipY=-45,thigh=19,shin=26;
  const part=(index,height)=>{
    const f=parts[index],u=height/f.h;
    ctx.drawImage(image,f.x,f.y,f.w,f.h,-f.anchor*u,-2,f.w*u,height);
  };
  const leg=(far)=>{
    const pose=standing?{thigh:0,knee:0,depth:1,lift:0}:artPlayLegPose(phase,far,side);
    // Keep the support foot at ground level; only the swing foot lifts.
    const projected=thigh*Math.cos(pose.thigh)+shin*Math.cos(pose.thigh+pose.knee);
    ctx.save();ctx.translate(side?(far?-3:3):(far?-7:7),hipY);
    ctx.scale(1,(45-pose.lift)/projected);ctx.rotate(pose.thigh);
    if(far)ctx.filter='brightness(0.72)';
    part(far?1:3,thigh+4);ctx.translate(0,thigh);ctx.rotate(pose.knee);part(far?2:4,shin+2);
    ctx.restore();
  };
  leg(true);leg(false);
  const body=parts[0],height=82,u=height/body.h;
  let cached=artPlayRigBodies.get(image);if(!cached){cached={};artPlayRigBodies.set(image,cached);}
  if(!cached[dir]){
    const canvas=document.createElement('canvas');canvas.width=Math.round(body.w*u);canvas.height=height;
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    c.drawImage(image,body.x,body.y,body.w,body.h,0,0,canvas.width,height);cached[dir]=canvas;
  }
  ctx.drawImage(cached[dir],Math.round(-body.anchor*u),-112);
}
