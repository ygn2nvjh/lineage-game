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
  for(const prop of map.scenery||[])if(prop.layer==='ground')this.prop(c,prop);
  if(map.river){const b=map.river.bridge;this.prop(c,{kind:'bridge',x:b.x+b.width/2,y:b.y+b.height,width:b.width+32,height:b.height});}
 }
 prop(c,p){const f=this.meta.props.frames[p.kind];if(!f)return;const scale=Math.min(p.width/f.width,p.height/f.height),w=f.width*scale,h=f.height*scale;c.drawImage(this.images.props,f.x,f.y,f.width,f.height,Math.round(p.x-w/2),Math.round(p.y-h),w,h);}
 objects(map){return [...(map.scenery||[]).filter(p=>p.layer!=='ground'),...map.buildings.map((b,i)=>({id:'building_'+i,kind:b.art|| (b.action==='rest'?'inn':'shop'),x:b.x,y:b.y+70,width:240,height:240,name:b.name}))];}
 overview(c,map,width,height){const s=Math.min(width/map.width,height/map.height),ox=(width-map.width*s)/2,oy=(height-map.height*s)/2;c.fillStyle='#16251e';c.fillRect(0,0,width,height);c.save();c.translate(ox,oy);c.scale(s,s);this.ground(c,map,{x:0,y:0,width:map.width,height:map.height});for(const p of this.objects(map).sort((a,b)=>a.y-b.y))this.prop(c,p);c.restore();return {s,ox,oy};}
}
export async function loadWorldArt(){let manifest=globalThis.LINEAGE_WORLD;if(!manifest){const r=await fetch(new URL('../assets/world/manifest.json',import.meta.url));if(!r.ok)throw Error('地圖素材載入失敗');manifest=await r.json();}const images={},meta={};await Promise.all(Object.entries(manifest).map(async([key,a])=>{meta[key]=a.meta;images[key]=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('地圖素材載入失敗：'+key));im.src=a.url.startsWith('data:')?a.url:new URL('../assets/world/'+a.url,import.meta.url).href;});}));return new WorldArt(images,meta);}
