export const REGION_AT=(map,p)=>map.regions?.find(r=>p.x>=r.x&&p.x<r.x+r.width&&p.y>=r.y&&p.y<r.y+r.height)?.name||(map.river&&p.y>=map.river.y&&p.y<=map.river.y+map.river.height?'林間木橋':map.name);
export class WorldArt {
 constructor(images,meta){this.images=images;this.meta=meta;this.patterns=new WeakMap();}
 pattern(c,key){let patterns=this.patterns.get(c);if(!patterns){patterns={};this.patterns.set(c,patterns);}if(!patterns[key]){const f=this.meta.tiles.frames[key],tile=document.createElement('canvas');tile.width=tile.height=128;const tc=tile.getContext('2d');tc.imageSmoothingEnabled=false;tc.drawImage(this.images.tiles,f.x,f.y,f.width,f.height,0,0,128,128);patterns[key]=c.createPattern(tile,'repeat');}return patterns[key];}
 fill(c,key,x,y,w,h){c.fillStyle=this.pattern(c,key);c.fillRect(x,y,w,h);}
 ground(c,map,view){
  const x=Math.floor(view.x/64)*64,y=Math.floor(view.y/64)*64,w=view.width+128,h=view.height+128;
  const region=map.regions?.find(r=>y>=r.y&&y<r.y+r.height)||map.regions?.at(-1);
  this.fill(c,map.safe?'grass':region?.ground||'forest',x,y,w,h);
  for(const region of map.regions||[]){const top=Math.max(y,region.y),bottom=Math.min(y+h,region.y+region.height);if(bottom>top)this.fill(c,region.ground,x,top,w,bottom-top);}
  for(const path of map.paths||[])this.fill(c,path.ground,path.x,path.y,path.width,path.height);
  if(!map.safe){
   if(map.river){const r=map.river;this.fill(c,'water',r.x,r.y,r.width,r.height);c.fillStyle='#182e27';c.fillRect(r.x,r.y-8,r.width,8);c.fillRect(r.x,r.y+r.height,r.width,8);c.fillStyle='#526650';c.fillRect(r.x,r.y-4,r.width,4);c.fillRect(r.x,r.y+r.height,r.width,4);}
  }
  for(const prop of map.scenery||[])if(prop.layer==='ground'||prop.kind==='gate')this.prop(c,prop,{pass:'back'});
  if(map.river){const b=map.river.bridge;this.prop(c,{kind:'bridge',x:b.x+b.width/2,y:b.y+b.height,width:b.width+32,height:b.height});}
 }
 bounds(p){const pack=p.kind==='warehouse'?'warehouse':'props',f=this.meta[pack].frames[p.kind],scale=Math.min(p.width/f.width,p.height/f.height),w=f.width*scale,h=f.height*scale;return {pack,f,x:p.x-w/2,y:p.y-h,width:w,height:h};}
 prop(c,p,options={}){
  const b=this.bounds(p),{f,x,y,width:w,height:h}=b,img=this.images[b.pack],draw=()=>c.drawImage(img,f.x,f.y,f.width,f.height,Math.round(x),Math.round(y),w,h);
  if(p.kind==='gate'&&options.pass!=='back'&&options.pass!=='full'){
   // Foundations belong behind the character; pillars and arch fascia are separate foreground parts.
   c.save();c.beginPath();c.rect(x,y+h*.44,w*.38,h*.42);c.rect(x+w*.68,y+h*.44,w*.32,h*.42);c.clip();draw();c.restore();
   const through=(options.reveal||[]).some(a=>a.y<p.y&&a.y>y&&Math.abs(a.x-p.x)<w*.22);
   c.save();c.beginPath();c.rect(x,y,w,h*.44);c.clip();c.globalAlpha*=through?.24:1;draw();c.restore();return;
  }
  if(['conifer','broadleaf'].includes(p.kind)){
   const crownBottom=y+h*.72;
   const hidden=(options.reveal||[]).filter(a=>a.y<p.y&&a.x+26>x&&a.x-26<x+w&&a.y-110<crownBottom&&a.y>y);
   if(hidden.length){
    const minX=Math.min(...hidden.map(a=>a.x))-34,maxX=Math.max(...hidden.map(a=>a.x))+34,minY=Math.min(...hidden.map(a=>a.y))-120,maxY=Math.max(...hidden.map(a=>a.y))+8,cx=(minX+maxX)/2,cy=(minY+maxY)/2,rx=(maxX-minX)/2,ry=(maxY-minY)/2;
    // Trunk/base remain opaque. Only a local crown window fades around the player/locked target.
    c.save();c.beginPath();c.rect(x,crownBottom,w,h*.28+1);c.clip();draw();c.restore();
    c.save();c.beginPath();c.rect(x,y,w,h*.72);c.clip();c.beginPath();c.rect(x-1,y-1,w+2,h*.72+2);c.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);c.clip('evenodd');draw();c.restore();
    c.save();c.beginPath();c.rect(x,y,w,h*.72);c.clip();c.beginPath();c.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);c.clip();c.globalAlpha*=.18;draw();c.restore();
    options.occluded?.push(p.id);return;
   }
  }
  draw();
 }

 objects(map){return [...(map.scenery||[]).filter(p=>p.layer!=='ground'),...map.buildings.map((b,i)=>({id:'building_'+i,kind:b.art|| (b.action==='rest'?'inn':b.action==='warehouse'?'warehouse':'shop'),x:b.x,y:b.y+70,width:240,height:240,name:b.name}))];}
 overview(c,map,width,height){const s=Math.min(width/map.width,height/map.height),ox=(width-map.width*s)/2,oy=(height-map.height*s)/2;c.fillStyle='#16251e';c.fillRect(0,0,width,height);c.save();c.translate(ox,oy);c.scale(s,s);this.ground(c,map,{x:0,y:0,width:map.width,height:map.height});for(const p of this.objects(map).sort((a,b)=>a.y-b.y))this.prop(c,p,{pass:'full'});c.restore();return {s,ox,oy};}
}
export async function loadWorldArt(){let manifest=globalThis.LINEAGE_WORLD;if(!manifest){const r=await fetch(new URL('../assets/world/manifest.json',import.meta.url));if(!r.ok)throw Error('地圖素材載入失敗');manifest=await r.json();}const images={},meta={};await Promise.all(Object.entries(manifest).map(async([key,a])=>{meta[key]=a.meta;images[key]=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('地圖素材載入失敗：'+key));im.src=a.url.startsWith('data:')?a.url:new URL('../assets/world/'+a.url,import.meta.url).href;});}));return new WorldArt(images,meta);}
