import {artAnatomyDimensions,drawArtProductionGuides} from './art-production.mjs';
import {ART_MOTION} from './art-config.mjs';
import {createArtPlayAnimation} from './art-play-animation.mjs';

export const ART_COMPARE_ROLES=[
  {kind:'male',name:'男角',legacy:false},
  {kind:'female',name:'女角',legacy:false},
  {kind:'skeleton',name:'骷髏',legacy:false},
  {kind:'spartoi',name:'史巴托',legacy:true},
  {kind:'skeleton_fighter',name:'骷髏鬥士',legacy:true}
];
export function artComparePositions(layout){
  const offsets={line:[[-192,0],[-96,0],[0,0],[96,0],[192,0]],
    stagger:[[-150,-55],[-70,30],[10,-45],[80,35],[150,-20]],
    close:[[-46,0],[0,24],[46,-18],[-18,-42],[22,46]]};
  return (offsets[layout]||offsets.line).map(([x,y],i)=>({...ART_COMPARE_ROLES[i],x:480+x,y:550+y}));
}
export function createArtPlayComparison({world,images,meta,legacy,previous,standard,getView,onMode}){
  const $=id=>document.getElementById(id),state={active:false,loading:false,ready:false,layout:'line',dir:'down',guides:true,shadows:true,labels:true,variant:'current',anatomy:false,collision:false,error:null};
  let renderer,metrics={},referenceMeta={},variants={},loading;
  const controls=()=>{
    $('compareDock').hidden=!state.active;$('dock').hidden=state.active;
    $('compareDetails').hidden=!state.active;
    $('compare').hidden=state.active;
    for(const id of ['bounds','playHelp','playRange'])$(id).hidden=state.active;
    document.querySelectorAll('[data-compare-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compareLayout===state.layout)));
    document.querySelectorAll('[data-compare-dir]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compareDir===state.dir)));
    $('compareGuides').setAttribute('aria-pressed',String(state.guides));
    $('compareShadows').setAttribute('aria-pressed',String(state.shadows));
    $('compareAnatomy').setAttribute('aria-pressed',String(state.anatomy));
    $('compareCollision').setAttribute('aria-pressed',String(state.collision));
    $('compareVersion').textContent=state.variant==='current'?'本版 v0.7':'前版 v0.6';
    $('compareVersion').setAttribute('aria-pressed',String(state.variant==='current'));
    $('compareLabels').setAttribute('aria-pressed',String(state.labels));
  };
  const updateTable=()=>{
    if(!state.ready)return;
    $('compareRows').replaceChildren(...ART_COMPARE_ROLES.map(role=>{
      const row=document.createElement('tr'),m=metrics[role.kind][state.dir==='left'?'right':state.dir];
      const anatomy=artAnatomyDimensions(standard,role.kind,state.dir,m.unit);
      for(const text of [role.name+(role.legacy?'（舊）':''),anatomy?anatomy.torsoWidth.toFixed(1):'待標記',anatomy?anatomy.headHeight.toFixed(1):'待標記',`${m.width.toFixed(1)} × ${m.height.toFixed(1)}`,`${(-m.rawFloor).toFixed(1)}`]){
        const td=document.createElement('td');td.textContent=text;row.append(td);
      }return row;
    }));
    $('compareCaption').textContent=state.layout==='line'?'同一條腳底線；金線是地面、藍線是顯示高度參考。':state.layout==='stagger'?'前後交錯；沿用同一倍率，遠處角色不縮小。':'近距離重疊檢視；可關閉名稱，專看輪廓與前後遮擋。';
  };
  async function load(){
    if(loading)return loading;
    loading=(async()=>{
      state.loading=true;state.error=null;
      const im=new Image();im.src=legacy.url;await im.decode();
      const refImages={...images,spartoi:im,skeleton_fighter:im};
      const oldImages={...refImages};
      await Promise.all(['male','female'].map(async kind=>{const image=new Image();image.src='/game-assets/art-play/'+previous[kind].atlas;await image.decode();oldImages[kind]=image;}));
      for(const variant of ['current','previous']){
      referenceMeta={};metrics={};const variantMeta=variant==='current'?meta:previous,variantImages=variant==='current'?refImages:oldImages;
      for(const role of ART_COMPARE_ROLES){
        const kind=role.kind,source=role.legacy?legacy.meta:variantMeta[kind],bodyHeight=role.legacy?source.bodyPixels:source.bodyHeight;
        referenceMeta[kind]={bodyHeight,frames:{}};metrics[kind]={};
        for(const dir of ['down','right','up']){
          let f;
          if(role.legacy){
            const old=source.frames[kind+':idle:'+dir];
            f={x:old.x,y:old.y,w:old.width,h:old.height,dx:old.offsetX??-source.originX,
              dy:(old.offsetY??-source.originY)+8*bodyHeight/ART_MOTION.height};
          }else f={...source.frames['idle:'+dir]};
          const canvas=document.createElement('canvas');canvas.width=f.w;canvas.height=f.h;
          const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(variantImages[kind],f.x,f.y,f.w,f.h,0,0,f.w,f.h);
          const pixels=c.getImageData(0,0,f.w,f.h).data;
          let minX=f.w,maxX=0,minY=f.h,maxY=0;
          for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(pixels[(y*f.w+x)*4+3]>=160){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
          const appearance=getView().index.monsterAppearances.get(kind);
          const u=ART_MOTION.height*ART_MOTION.scale*(appearance?.scale||1)/bodyHeight;
          metrics[kind][dir]={width:(maxX-minX+1)*u,height:(maxY-minY+1)*u,rawFloor:(f.dy+maxY)*u,unit:u,pixelBounds:[minX,minY,maxX-minX+1,maxY-minY+1]};
          const runs=[];
          for(let x=0;x<f.w;x++){
            let found=false;for(let y=Math.max(0,maxY-3);y<=maxY;y++)if(pixels[(y*f.w+x)*4+3]>=160)found=true;
            if(found){if(!runs.length||x-runs.at(-1).at(-1)>2)runs.push([]);runs.at(-1).push(x);}
          }
          f.feet=runs.map(run=>{let bottom=0;for(let y=0;y<f.h;y++)for(const x of run)if(pixels[(y*f.w+x)*4+3]>=160)bottom=Math.max(bottom,y);return {x:(run[0]+run.at(-1))/2,y:bottom,width:run.at(-1)-run[0]+1};});
          // Translate only; retain original image, proportions and rendering scale.
          f.dy=-maxY;referenceMeta[kind].frames['idle:'+dir]=f;
        }
      }
      renderer=createArtPlayAnimation(referenceMeta,variantImages,Object.fromEntries(ART_COMPARE_ROLES.map(r=>[r.kind,new Set()])),ART_MOTION);
      variants[variant]={renderer,metrics,referenceMeta};
      }
      ({renderer,metrics,referenceMeta}=variants[state.variant]);
      state.ready=true;state.loading=false;updateTable();
    })().catch(e=>{state.error='角色素材載入失敗，請重新整理再試。';state.loading=false;loading=null;throw e;});
    return loading;
  }
  const setLayout=layout=>{state.layout=layout;controls();updateTable();};
  document.querySelectorAll('[data-compare-layout]').forEach(b=>b.onclick=()=>setLayout(b.dataset.compareLayout));
  document.querySelectorAll('[data-compare-dir]').forEach(b=>b.onclick=()=>{state.dir=b.dataset.compareDir;controls();updateTable();});
  for(const [id,key] of [['compareGuides','guides'],['compareShadows','shadows'],['compareLabels','labels'],['compareAnatomy','anatomy'],['compareCollision','collision']])$(id).onclick=()=>{state[key]=!state[key];controls();};
  $('compareVersion').onclick=()=>{if(!state.ready)return;state.variant=state.variant==='current'?'previous':'current';({renderer,metrics,referenceMeta}=variants[state.variant]);controls();updateTable();};
  $('compareBack').onclick=()=>{state.active=false;controls();onMode(false);};
  function guides(c){
    if(!state.guides)return;
    c.save();c.lineWidth=1;c.strokeStyle='#f0cc7cb8';
    if(state.layout==='line'){
      c.beginPath();c.moveTo(260,550);c.lineTo(700,550);c.stroke();c.setLineDash([4,5]);c.strokeStyle='#86d8df9c';
      c.beginPath();c.moveTo(260,550-ART_MOTION.height*ART_MOTION.scale);c.lineTo(700,550-ART_MOTION.height*ART_MOTION.scale);c.stroke();
    }
    c.setLineDash([]);c.strokeStyle='#f0cc7cb8';
    for(const a of artComparePositions(state.layout)){c.beginPath();c.moveTo(a.x-10,a.y);c.lineTo(a.x+10,a.y);c.moveTo(a.x,a.y-4);c.lineTo(a.x,a.y+4);c.stroke();}
    c.restore();
  }
  function render(){
    if(!state.ready)return;
    const base=getView(),actors=artComparePositions(state.layout),male=actors[0],female=actors[1],view=Object.create(base);
    const index=base.index,monsterFor=kind=>[...index.monsters.values()].find(m=>m.appearanceId===kind);
    const enemies=actors.slice(2).map(a=>{const m=monsterFor(a.kind);return {id:'compare:'+a.kind,monsterId:m.id,x:a.x,y:a.y,hp:m.hp,dead:false,fall:0,hurt:0,active:false,moving:false};});
    const party=[{id:'compare:female',name:'女角',sex:'female',connected:true,game:{p:{...base.p,x:female.x,y:female.y,sex:'female'},moving:false}}];
    Object.defineProperties(view,{p:{value:{...base.p,x:male.x,y:male.y,sex:'male',name:'男角'}},enemies:{value:enemies},party:{value:party},goal:{value:null},target:{value:null},moving:{value:false},playerAnimation:{value:null},hurt:{value:0},deathPending:{value:0}});
    const saved={art:world.art,actorState:world.actorState,text:world.text,rect:world.rect,worldArt:world.worldArt,focus:world.focus,particles:world.particles,visual:world.lastPlayerVisual};
    const ground=world.worldArt.ground.bind(world.worldArt),referenceWorld=Object.create(world.worldArt);referenceWorld.ground=(c,m,v)=>{ground(c,m,v);guides(c);};
    state.drawOrder=[];
    world.worldArt=referenceWorld;world.art={supports:kind=>renderer.supports(kind),draw:(c,a,kind,scale)=>{state.drawOrder.push(kind);const result=renderer.draw(c,{...a,shadows:state.shadows},kind,scale);
      drawArtProductionGuides(c,a,kind,referenceMeta[kind].frames['idle:'+(state.dir==='left'?'right':state.dir)],metrics[kind][state.dir==='left'?'right':state.dir],standard,ART_MOTION,state);return result;}};
    world.actorState=entity=>({x:entity.x,y:entity.y,dir:state.dir,moving:false,attack:0,hurt:0,dead:false});
    world.text=(text,...args)=>{
      const role=actors.find(a=>a.x===args[0]&&Math.abs(args[1]-(a.y-108))<5);
      if(role){if(!state.labels)return;return saved.text.call(world,role.name,...args);}
      return saved.text.call(world,text,...args);
    };
    world.rect=(x,y,w,h,color)=>{if(!state.labels&&w===36&&h===4)return;saved.rect.call(world,x,y,w,h,color);};
    world.focus={x:Math.round(saved.focus.x)+male.x-480,y:Math.round(saved.focus.y)+male.y-550};world.particles=[];
    try{world.render(view,0);}finally{Object.assign(world,{art:saved.art,actorState:saved.actorState,text:saved.text,rect:saved.rect,worldArt:saved.worldArt,focus:saved.focus,particles:saved.particles,lastPlayerVisual:saved.visual});}
  }
  return {get active(){return state.active;},get loading(){return state.loading;},get error(){return state.error;},
    async open(){state.active=true;controls();onMode(true);try{await load();}catch{ /* readable error remains in the HUD */ }},render,
    inspect:()=>structuredClone({...state,actors:artComparePositions(state.layout),metrics,nominalHeight:ART_MOTION.height*ART_MOTION.scale})};
}
