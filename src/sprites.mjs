// Pixel actor renderer retained from lineage_v0583.html. Gameplay is supplied by core.mjs.
export function drawActor(ctx,x,y,kind,dir,hurt=0,attack=0,moving=false,dead=false,clock=0,appearance=null){
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(1.05,1.05);
 const p=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(a),Math.round(b),w,h)};
 const isKnight=kind==='knight',isOgre=kind==='ogre',isArcher=kind==='archer';
 const isSkeleton=kind==='skeleton';
 const palette=appearance?.colorTone==='blue'?{bone:'#8fc6e1',dark:'#4d779a',rib:'#79a9c8',joint:'#3f647f'}:appearance?.colorTone==='gold'?{bone:'#e6c765',dark:'#9b7c35',rib:'#d1af50',joint:'#806631'}:{bone:'#d9d2b7',dark:'#968f7d',rib:'#bcb6a2',joint:'#716f64'};
 const side=dir==='left'?-1:1,back=dir==='up',front=dir==='down';
 const phase=Math.floor(clock*9)%4;
 const step=moving&&attack<=0?([0,1,0,-1][phase]):0;
 const bob=moving&&attack<=0?Math.abs(step)*.4:0;
 const swing=attack>0?(attack>.12?-1:1):0;
 const bone=palette.bone,boneDark=palette.dark,steel='#b8c3cb',steelShadow='#687e8f',gold='#d7a65b',blue='#274d85',blueLight='#4779b2';
 const flesh=isOgre?'#8d9a65':isKnight?'#e6b78b':bone;
 const coat=isKnight?blue:isOgre?'#735844':'#7c7770';
 const leg=isOgre?'#675442':isKnight?'#4e5c72':boneDark;
 const scale=isOgre?2:1;ctx.scale(scale,scale);
 if(hurt>0){ctx.translate((Math.floor(clock*35)%2?1:-1),0)}
 p(-12,9,24,4,'#16251e77');
 if(dead){ctx.rotate(Math.PI/2);ctx.translate(0,11)}
 const sway=moving&&attack<=0?step:0;
 // back cape, silhouette and moving boots
 if(isKnight){p(-11,-12+bob,22,26,'#172d57');p(-9,-12+bob,18,25,blue);p(-2,-4+bob,4,13,gold)}
 p(-9,4+step,7,10,leg);p(2,4-step,7,10,leg);
 p(-10,12+step,9,4,isKnight?'#a5afb9':leg);p(1,12-step,9,4,isKnight?'#a5afb9':leg);
 // torso, shoulder pads and belt
 p(-11,-18+bob,22,24,coat);
 p(-10,-18+bob,20,5,isKnight?steel:isOgre?'#66543d':boneDark);
 if(isKnight){p(-9,-13+bob,18,14,steelShadow);p(-6,-11+bob,12,11,blue);p(-2,-11+bob,4,11,gold);p(-12,-19+bob,8,7,steel);p(4,-19+bob,8,7,steel);p(-9,1+bob,18,4,'#5e4636');p(-2,1+bob,4,4,gold)}
 if(!isKnight&&!isOgre){p(-8,-14+bob,16,15,palette.rib);p(-5,-10+bob,10,3,palette.joint);p(-5,-4+bob,10,3,palette.joint);p(-3,-15+bob,6,18,boneDark)}
 if(isOgre){p(-10,-14+bob,20,17,'#7b8a5d');p(-7,-5+bob,14,5,'#514632')}
 // face or back of head
 p(-9,-34+bob,18,17,flesh);
 if(isKnight){
   if(back){p(-10,-36+bob,20,13,'#80502e');p(-8,-25+bob,16,7,'#9a633c')}
   else{p(-10,-37+bob,20,9,'#8c5735');p(-10,-30+bob,5,6,'#9e663f');p(5,-30+bob,5,6,'#9e663f');p(-5,-24+bob,3,2,'#27394a');p(3,-24+bob,3,2,'#27394a');p(-2,-19+bob,4,2,'#9a604d')}
 }else if(isOgre){
   p(-10,-36+bob,20,7,'#62543c');p(-7,-27+bob,4,4,'#2c2b24');p(3,-27+bob,4,4,'#2c2b24');p(-3,-21+bob,6,3,'#443d32');p(-12,-25+bob,4,8,'#d8d0ad');p(8,-25+bob,4,8,'#d8d0ad')
 }else{
   p(-9,-35+bob,18,4,boneDark);p(-6,-29+bob,5,5,'#1e2324');p(2,-29+bob,5,5,'#1e2324');p(-2,-23+bob,4,4,boneDark);p(-5,-18+bob,10,3,'#403e39')
 }
 if(isSkeleton&&appearance?.helmet){
   p(-12,-39+bob,24,11,'#6d7c83');p(-10,-41+bob,20,9,'#c4cdd0');p(-7,-42+bob,14,4,'#e2e4d3');p(-13,-32+bob,26,4,'#82969b');p(-12,-29+bob,4,10,'#a8b5b7');p(8,-29+bob,4,10,'#a8b5b7');p(-2,-40+bob,4,13,'#dbc078');
 }
 // arms, shield and weapon animated independently
 const handY=-12+bob+(swing===-1?-7:swing===1?3:0);
 const shieldX=side===1?-19:11,weaponX=side===1?13:-18;
 p(shieldX===-19?-14:9,-15+bob,6,17,isKnight?steelShadow:isOgre?'#819069':bone);
 if(isKnight){
  p(shieldX,-17+bob,10,22,'#bb934e');p(shieldX+2,-15+bob,6,18,blue);p(shieldX+4,-13+bob,2,13,gold);p(shieldX+2,-8+bob,6,2,gold);
 }else if(isOgre){p(shieldX,-13+bob,8,19,'#8d9a65')}
 else{p(shieldX,-13+bob,5,18,bone)}
 if(isSkeleton&&appearance?.shield!=='none'&&appearance?.shield){
   const sx=side===1?-29:12,sy=-20+bob,wood=appearance.shield==='large_wooden';
   p(sx,sy,19,30,wood?'#57412b':'#4c606b');p(sx+2,sy+2,15,26,wood?'#b28b51':'#b6c4c9');
   if(wood){p(sx+6,sy+3,2,25,'#71542e');p(sx+12,sy+3,2,25,'#71542e');p(sx+2,sy+7,15,3,'#65716a');p(sx+2,sy+21,15,3,'#65716a');}
   else{p(sx+4,sy+3,11,22,'#819aa7');p(sx+8,sy+3,3,24,'#e1e3d6');p(sx+3,sy+12,13,3,'#d4dcd8');}
   p(sx+7,sy+12,6,6,wood?'#c9c4a4':'#e8e6cf');p(sx+4,sy+30,11,3,wood?'#715334':'#71858d');
 }
 p(weaponX,-14+bob,6,16,isKnight?steelShadow:isOgre?'#8c9870':bone);
 ctx.save();ctx.translate(weaponX+3,handY);ctx.rotate(swing===-1?-.95*side:swing===1?.75*side:moving?Math.sin(clock*9)*.13:0);
 if(isArcher){
  ctx.strokeStyle='#b89460';ctx.lineWidth=2;ctx.beginPath();ctx.arc(side*8,0,11,-Math.PI/2,Math.PI/2,side===-1);ctx.stroke();
  p(side*8-1,-11,1,22,'#d8d1ae');if(attack>0){p(side*2,-1,18,2,'#d9d9c6')}
 }else if(isOgre){
  p(-2,-3,4,27,'#68482b');p(-7,-13,14,12,'#797d6a');p(-8,-14,16,4,'#a2a593')
 }else if(isSkeleton&&appearance?.weapon==='scimitar'){
  ctx.save();ctx.scale(.55,.55);
  // Stepped curved blade silhouette, deliberately distinct from the straight sword.
  p(-2,-2,4,12,'#72503a');
  ctx.fillStyle='#d7e2df';ctx.strokeStyle='#f3edcc';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(-3,-4);ctx.lineTo(-5,-17);ctx.lineTo(-3,-28);ctx.lineTo(3,-38);ctx.lineTo(13,-45);ctx.lineTo(19,-48);ctx.lineTo(14,-40);ctx.lineTo(10,-29);ctx.lineTo(4,-17);ctx.lineTo(3,-4);ctx.closePath();ctx.fill();ctx.stroke();
  p(-6,-4,12,3,gold);
  ctx.restore();
 }else{
  p(-2,-26,4,30,'#dce5e7');p(-1,-28,2,4,'#f2f0dd');p(-7,1,14,3,gold);p(-2,4,4,8,'#6b4a32')
 }
 ctx.restore();
 if(hurt>0){p(-15,-38,30,55,'#fff3d055')}
 ctx.restore();
}
