// Manual semantic marks and measured image bounds are deliberately separate.
export function artAnatomyDimensions(standard,kind,dir,unit=1){
  const a=standard.actors[kind],view=a?.views[dir==='left'?'right':dir];
  return view?{method:a.markMethod,torsoWidth:view.torso[2]*unit,headHeight:view.head[3]*unit,head: view.head,torso:view.torso}:null;
}
export function drawArtProductionGuides(c,a,kind,frame,measurement,standard,motion,options){
  const unit=measurement.unit,w=Math.round(frame.w*unit),h=Math.round(frame.h*unit),dx=Math.round(frame.dx*unit),dy=Math.round(frame.dy*unit);
  c.save();c.translate(Math.round(a.x),Math.round(a.y));
  if(options.collision){c.strokeStyle='#fbad59';c.lineWidth=1;c.setLineDash([3,3]);c.beginPath();c.arc(0,0,standard.shared.sandboxCollisionRadius,0,Math.PI*2);c.stroke();c.setLineDash([]);}
  if(options.anatomy){
    if(a.dir==='left')c.scale(-1,1);
    const rect=(r,color,dash=[])=>{c.strokeStyle=color;c.setLineDash(dash);c.strokeRect(dx+r[0]*w/frame.w,dy+r[1]*h/frame.h,r[2]*w/frame.w,r[3]*h/frame.h);};
    rect(measurement.pixelBounds,'#f3d782',[3,3]);
    const marks=artAnatomyDimensions(standard,kind,a.dir);
    if(marks){rect(marks.torso,'#ff8ed2');rect(marks.head,'#88e6ff');}
  }
  c.restore();
}
