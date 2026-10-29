// One fixed source identity; fixed bone lengths; planted feet determine the pose.
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
export function solveWalkLeg(hip,target,upperLength,lowerLength){
 const dx=target[0]-hip[0],dy=target[1]-hip[1],raw=Math.hypot(dx,dy),d=Math.max(.00001,Math.min(upperLength+lowerLength-.000001,Math.max(Math.abs(upperLength-lowerLength)+.000001,raw)));
 const ux=dx/(raw||1),uy=dy/(raw||1),along=(upperLength**2-lowerLength**2+d*d)/(2*d),across=Math.sqrt(Math.max(0,upperLength**2-along**2));
 const knee=[hip[0]+ux*along+uy*across,hip[1]+uy*along-ux*across],ankle=[hip[0]+ux*d,hip[1]+uy*d];
 return {hip,knee,ankle,reachError:Math.abs(raw-d),upperLength,lowerLength};
}
export function rightWalkPose(config,kind,cycles){
 const phase=((cycles%1)+1)%1,D=config.cycleDistance,bob=config.bodyLowering[0]+(config.bodyLowering[1]-config.bodyLowering[0])*(1+Math.cos(phase*4*Math.PI))/2;
 const legs={};
 for(const [side,offset]of [['near',0],['far',.5]]){
  const source=config.roles[kind][side],legCycles=cycles+offset,p=((legCycles%1)+1)%1,stance=p<config.stanceFraction,t=stance?p/config.stanceFraction:(p-config.stanceFraction)/(1-config.stanceFraction);
  const halfTravel=D*config.stanceFraction/2;
  const local=stance?halfTravel-D*p:-halfTravel+2*halfTravel*(t*t*(3-2*t));
  const lift=stance?0:Math.sin(Math.PI*t)*config.swingLift;
  const neutral=source.hip[0]+source.contact[0]-source.ankle[0];
  const contact=[neutral+local,source.contact[1]-lift],target=[contact[0]-(source.contact[0]-source.ankle[0]),contact[1]-(source.contact[1]-source.ankle[1])],hip=[source.hip[0],source.hip[1]+bob];
  const solved=solveWalkLeg(hip,target,length(source.hip,source.knee),length(source.knee,source.ankle));
  legs[side]={...solved,side,stance,phase:p,contact,source,neutral,supportId:side+':'+Math.floor(legCycles),worldContact:[D*cycles+contact[0],contact[1]],thighRotation:angle(hip,solved.knee)-angle(source.hip,source.knee),shinRotation:angle(solved.knee,solved.ankle)-angle(source.knee,source.ankle)};
 }
 return {kind,phase,cycles,rootDistance:D*cycles,bob,legs,drawOrder:['far','near','upper'],sourceScale:1};
}
export function drawRightWalkPose(c,image,reference,config,kind,cycles,{guides=false,drawLog}={}){
 const pose=rightWalkPose(config,kind,cycles),parts=reference.parts[kind].right,ref=reference.frames[kind]['idle:right'],[dx,dy]=ref.sourceOffset;
 c.save();c.imageSmoothingEnabled=false;
 for(const side of ['far','near']){
  const f=parts[side],leg=pose.legs[side],source=leg.source,ky=source.knee[1],ay=source.ankle[1];
  // Slices are disjoint in source space. Every part retains its original scale.
  c.save();c.translate(dx+leg.hip[0],dy+leg.hip[1]);c.rotate(leg.thighRotation);
  c.drawImage(image,f.x,f.y,f.w,ky,-source.hip[0],-source.hip[1],f.w,ky);c.restore();
  c.save();c.translate(dx+leg.knee[0],dy+leg.knee[1]);c.rotate(leg.shinRotation);
  c.drawImage(image,f.x,f.y+ky,f.w,ay-ky,-source.knee[0],0,f.w,ay-ky);c.restore();
  // The boot remains flat during support; its contact point determines the ankle.
  const bx=dx+leg.ankle[0]-source.ankle[0],by=dy+leg.ankle[1],matrix=c.getTransform?.();
  if(matrix&&Math.abs(matrix.b)<1e-10&&Math.abs(matrix.c)<1e-10){
   // Quantize once in final screen space. Floating transform accumulation must
   // not change the planted boot's nearest-neighbor sample from frame to frame.
   c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(image,f.x,f.y+ay,f.w,f.h-ay,Math.round(matrix.e+bx*matrix.a),Math.round(matrix.f+by*matrix.d),f.w*matrix.a,(f.h-ay)*matrix.d);c.restore();
  }else c.drawImage(image,f.x,f.y+ay,f.w,f.h-ay,bx,by,f.w,f.h-ay);
  drawLog?.push({side,partScale:1,source:[f.x,f.y,f.w,f.h]});
 }
 const f=parts.upper;c.drawImage(image,f.x,f.y,f.w,f.h,dx,dy+pose.bob,f.w,f.h);drawLog?.push({side:'upper',weaponCopies:1,partScale:1});
 if(guides){
  for(const side of ['far','near']){const l=pose.legs[side];c.strokeStyle=side==='near'?'#78e4ff':'#ffc575';c.lineWidth=.8;c.beginPath();c.moveTo(dx+l.hip[0],dy+l.hip[1]);c.lineTo(dx+l.knee[0],dy+l.knee[1]);c.lineTo(dx+l.ankle[0],dy+l.ankle[1]);c.stroke();for(const point of [l.hip,l.knee,l.contact]){c.fillStyle=c.strokeStyle;c.beginPath();c.arc(dx+point[0],dy+point[1],1.4,0,Math.PI*2);c.fill();}}
 }
 c.restore();return pose;
}
