// Pre-bake independently jointed legs. The complete torso contains the only weapon.
const artPlayRigBodies=new WeakMap();
export function artPlayLegPose(phase,far=false,side=true){
  const t=phase*Math.PI*2+(far?Math.PI:0),s=Math.sin(t),swing=Math.max(0,Math.cos(t));
  return side?{thigh:-s*.58,knee:swing*.94,depth:1,lift:swing*9}:
    {thigh:s*.05,knee:-s*.08,depth:1,lift:swing*9};
}
export function artPlayStandLeg(far,side){
  return side?{thigh:far?.16:-.18,knee:far?.06:.20,lift:0}:
    {thigh:far?.06:-.06,knee:far?-.04:.04,lift:0};
}
export function bakeArtPlayRig(ctx,image,parts,dir,phase,standing=false,kind='female',settle=0){
  const side=dir==='right',hipY=-45,thigh=19,shin=26;
  const blend=standing?1:settle,legWidth=kind==='male'?1.22:kind==='female'?1.06:1;
  // Each cutout leg is grounded from its real opaque sole, not the box bottom.
  let target=ctx;
  const part=(index,height)=>{
    const f=parts[index],u=height/f.h;
    target.save();target.scale(legWidth,1);
    target.drawImage(image,f.x,f.y,f.w,f.h,-f.anchor*u,-2,f.w*u,height);target.restore();
  };
  const leg=(far)=>{
    const walk=artPlayLegPose(phase,far,side),rest=artPlayStandLeg(far,side),pose={};
    for(const key of ['thigh','knee','lift'])pose[key]=walk[key]*(1-blend)+rest[key]*blend;
    // Keep the support foot at ground level; only the swing foot lifts.
    const projected=thigh*Math.cos(pose.thigh)+shin*Math.cos(pose.thigh+pose.knee);
    const layer=document.createElement('canvas');layer.width=layer.height=160;
    target=layer.getContext('2d',{willReadFrequently:true});target.imageSmoothingEnabled=false;
    const spread=side?4+(kind==='male'?4:0)*blend:7;
    target.translate(80,100);target.translate(far?-spread:spread,hipY);
    target.scale(1,(45-pose.lift)/projected);target.rotate(pose.thigh);
    if(far)target.filter='brightness(0.72)';
    part(far?1:3,thigh+4);target.translate(0,thigh);target.rotate(pose.knee);part(far?2:4,shin+2);
    const pixels=target.getImageData(0,0,160,160).data;let bottom=0;
    for(let y=159;y>=0;y--){let found=false;for(let x=0;x<160;x++)if(pixels[(y*160+x)*4+3]>=160){bottom=y;found=true;break;}if(found)break;}
    const floor=Math.round(-pose.lift-(far?blend:0));
    ctx.drawImage(layer,-80,-100+floor-(bottom-100));
  };
  leg(true);leg(false);
  const body=parts[0],height=kind==='male'&&side?76:82,u=height/(body.bodyHeight||body.h),drawHeight=Math.round(body.h*u);
  let cached=artPlayRigBodies.get(image);if(!cached){cached={};artPlayRigBodies.set(image,cached);}
  if(!cached[dir]){
    const canvas=document.createElement('canvas');canvas.width=Math.round(body.w*u);canvas.height=drawHeight;
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    c.drawImage(image,body.x,body.y,body.w,body.h,0,0,canvas.width,drawHeight);cached[dir]=canvas;
  }
  ctx.drawImage(cached[dir],Math.round(-body.anchor*u),-112);
}
