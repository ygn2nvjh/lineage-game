// Preview-only distance-driven gait. Does not alter live movement or combat.
export function gaitSample(distance,stridePx=64,frames=8){
 if(!Number.isFinite(distance)||!Number.isFinite(stridePx)||stridePx<=0||!Number.isInteger(frames)||frames<1)throw new RangeError('Invalid gait configuration');
 const phase=((distance/stridePx)%1+1)%1;return {phase,index:Math.min(frames-1,Math.floor((phase+1e-10)*frames)),cycle:Math.floor(distance/stridePx)};
}
export function advanceWalk(state,elapsedMs,{speed=80,rate=1,paused=false}={}){
 if(![state.distance,elapsedMs,speed,rate].every(Number.isFinite)||elapsedMs<0||speed<0||rate<0)throw new RangeError('Invalid walk update');
 return {...state,distance:state.distance+(paused?0:speed*rate*Math.min(elapsedMs,100)/1000)};
}
