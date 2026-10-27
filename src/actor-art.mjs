import {ART_MOTION} from './art-config.mjs';
export class ActorArt {
 constructor(images,meta){this.images=images;this.meta=meta;this.depth={};
  // Separate near/far boots visually across opposite contacts, whose side silhouettes coincide.
  for(const [key,color] of Object.entries({far:'rgba(0,0,0,.33)',near:'rgba(255,255,235,.17)'})){
   const layer=document.createElement('canvas');layer.width=images.side.width;layer.height=images.side.height;const c=layer.getContext('2d');c.drawImage(images.side,0,0);c.globalCompositeOperation='source-atop';c.fillStyle=color;c.fillRect(0,0,layer.width,layer.height);this.depth[key]=layer;
  }
 }
 supports(kind){return ['male','female','skeleton'].includes(kind)||!!this.meta.monsters?.frames[kind+':idle:right'];}
 draw(c,a,kind,scale=ART_MOTION.scale){
  if(!this.supports(kind))return false;
  const hurt=a.hurt>0&&!a.dead,attacking=a.attack>0&&!hurt&&!a.dead,walking=a.moving&&!attacking&&!hurt&&!a.dead;
  const dir=hurt||a.dead?(a.hurtFacing||a.side||'right'):attacking?(a.side||'right'):a.dir||'down',flip=dir==='left';
  const duration=a.duration||(kind==='skeleton'?ART_MOTION.enemy:a.attackStyle==='chop'?ART_MOTION.chop:ART_MOTION.slash);
  let source='actors',key=kind+':'+dir;
  if(a.dead){source='reaction';key=kind+':'+(2+Math.min(3,Math.floor((a.fall||0)/ART_MOTION.fall*4)));}
  else if(hurt){source='reaction';key=kind+':'+(a.hurt>ART_MOTION.hurt*.48?0:1);}
  else if(attacking){const f=Math.min(5,Math.floor((a.attackElapsed||0)/duration*6));source=a.attackStyle==='chop'?'cycle':'combat';key=(source==='cycle'?'chop:':'')+kind+':'+f;}
  else if(walking){const side=dir==='left'||dir==='right';source=side?'side':'cycle';const count=side?6:4;key=kind+':'+(side?'right':dir)+':'+Math.floor(((a.walkPhase||0)%1)*count);}
  else if(dir==='left'||dir==='right'){source='combat';key=kind+':0';}
  if(this.meta.monsters?.frames[kind+':idle:right']){
   source='monsters';key=kind+':'+(a.dead?'reaction:'+(2+Math.min(3,Math.floor((a.fall||0)/ART_MOTION.fall*4))):hurt?'reaction:'+(a.hurt>ART_MOTION.hurt*.48?0:1):attacking?'attack:'+Math.min(5,Math.floor((a.attackElapsed||0)/duration*6)):walking?'walk:'+(dir==='up'||dir==='down'?dir+':'+Math.floor(((a.walkPhase||0)%1)*4):'right:'+Math.floor(((a.walkPhase||0)%1)*6)):'idle:'+(flip?'right':dir));
  }
  const meta=this.meta[source],f=meta.frames[key];if(!f)return false;
  const unit=ART_MOTION.height/meta.bodyPixels*scale,img=this.images[source];
  c.save();c.translate(a.x,a.y);c.fillStyle='#09110c66';c.beginPath();c.ellipse(0,4,(a.dead?24:13)*scale,4*scale,0,0,Math.PI*2);c.fill();
  if(a.dead)c.globalAlpha=(a.fall||0)>2.5?Math.max(0,1-((a.fall||0)-2.5)/1.4):1;
  if(hurt)c.translate((a.hurtSide??(a.hurtFacing==='right'?-1:1))*Math.sin(a.hurt/ART_MOTION.hurt*Math.PI)*4*scale,0);
  if(flip)c.scale(-1,1);
  const dx=(f.offsetX??-meta.originX)*unit,dy=(f.offsetY??-meta.originY)*unit+8*scale,dw=f.width*unit,dh=f.height*unit;
  c.drawImage(img,f.x,f.y,f.width,f.height,Math.round(dx),Math.round(dy),dw,dh);
  if(walking&&source==='side'){
   const half=Math.floor(((a.walkPhase||0)%1)*2);
   for(const [right,key] of [[true,half?'far':'near'],[false,half?'near':'far']]){
    c.save();c.beginPath();c.rect(right?0:-80*unit,(8*scale)-(meta.originY-105)*unit,80*unit,48*unit);c.clip();c.drawImage(this.depth[key],f.x,f.y,f.width,f.height,Math.round(dx),Math.round(dy),dw,dh);c.restore();
   }
  }
  if(hurt&&a.hurt>ART_MOTION.hurt-.09){c.save();c.globalCompositeOperation='screen';c.globalAlpha=.65;c.drawImage(img,f.x,f.y,f.width,f.height,Math.round(dx),Math.round(dy),dw,dh);c.restore();}
  c.restore();return true;
 }
}
export async function loadActorArt(){
 let manifest=globalThis.LINEAGE_ART;
 if(!manifest){const r=await fetch(new URL('../assets/art/manifest.json',import.meta.url));if(!r.ok)throw Error('角色素材載入失敗');manifest=await r.json();}
 const images={},meta={};
 await Promise.all(Object.entries(manifest).map(async([key,value])=>{meta[key]=value.meta;images[key]=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('角色素材載入失敗：'+key));im.src=value.url.startsWith('data:')?value.url:new URL('../assets/art/'+value.url,import.meta.url).href;});}));
 return new ActorArt(images,meta);
}
