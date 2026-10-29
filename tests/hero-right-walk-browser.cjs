const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),records=[];
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const viewport of [{width:390,height:844},{width:960,height:900}]){
  const p=await b.newPage({viewport,isMobile:viewport.width<500,hasTouch:true,acceptDownloads:true}),errors=[],bad=[];let sockets=0;
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push(r.url());});p.on('websocket',()=>sockets++);
  await p.goto(process.env.HERO_CALIBRATION_URL||'http://127.0.0.1:8812/art-calibration.html');await p.waitForFunction(()=>window.heroRightWalk);
  const inspect=()=>p.evaluate(()=>heroRightWalk.inspect());
  for(const kind of ['male','female']){
   await p.locator('[data-right-kind='+kind+']').click();
   if((await inspect()).guides)await p.locator('#rightGuides').click();
   for(let i=0;i<4;i++){await p.locator('#rightKeyButton'+i).click();const s=await inspect();assert.equal(s.kind,kind);assert(!s.playing);assert.equal(s.pose.phase,i/4);assert.equal(s.pose.legs.near.stance,i<2);assert.equal(s.pose.legs.far.stance,i>=2);}
   const raster=await p.evaluate(()=>{
    const rows={near:[],far:[]};
    for(const [side,phases]of [['near',[.02,.1,.2,.3,.4,.48]],['far',[.52,.6,.7,.8,.9,.98]]])for(const phase of phases){
     const range=document.getElementById('rightPhase');range.value=Math.round(phase*1000);range.dispatchEvent(new Event('input'));
     const s=heroRightWalk.inspect(),l=s.pose.legs[side],x=s.worldRoot+(s.sourceOffset[0]+l.contact[0]-80)*s.unit,y=s.floor+(s.sourceOffset[1]+l.contact[1]-148)*s.unit,c=document.getElementById('rightActorLayer').getContext('2d');
     const xx=Math.round(x),yy=Math.round(y),pixels=c.getImageData(xx-1,yy-1,3,3).data;let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>=160)count++;
     const line=Array.from(c.getImageData(xx-1,Math.floor(y),3,1).data);rows[side].push({x,y,count,line});
    }return rows;
   });
   for(const [side,samples]of Object.entries(raster)){
    assert(samples.every(s=>s.count>0),kind+' '+side+' computed anchor must touch rendered boot pixels');
    assert(Math.max(...samples.map(s=>s.x))-Math.min(...samples.map(s=>s.x))<1e-6);assert(Math.max(...samples.map(s=>s.y))-Math.min(...samples.map(s=>s.y))<1e-6);
    if(new Set(samples.map(s=>JSON.stringify(s.line))).size!==1)console.log(JSON.stringify({unstable:kind+' '+side,samples}));
    assert.equal(new Set(samples.map(s=>JSON.stringify(s.line))).size,1,kind+' '+side+' actual planted sole pixels must remain stable');
   }
   await p.locator('[data-right-speed="2"]').click();await p.locator('#rightPlay').click();const before=await inspect();await p.waitForTimeout(160);const after=await inspect();assert(after.cycles>before.cycles);assert(after.worldRoot>before.worldRoot);assert(after.maxObservedDrift<1e-6);
   await p.locator('#rightPlay').click();await p.locator('#rightGuides').click();await p.locator('#rightGuides').click();
   const event=p.waitForEvent('download');await p.locator('#rightDownload').click();const download=await event;await download.saveAs('/tmp/right-walk-'+kind+'-'+viewport.width+'.png');
   await p.screenshot({path:'/tmp/right-walk-page-'+kind+'-'+viewport.width+'.png',fullPage:true});records.push({viewport,kind,legs:Object.fromEntries(Object.entries(raster).map(([side,samples])=>[side,{samples:samples.length,solePixelVariants:new Set(samples.map(s=>JSON.stringify(s.line))).size,maxWorldDrift:Math.max(...samples.map(s=>s.x))-Math.min(...samples.map(s=>s.x))}]))});console.log(JSON.stringify({viewport,kind,passed:'four key poses, alternating support, real moving root, constant planted sole pixels, PNG export'}));
  }
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(sockets,0);assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);await p.close();
 }
const root=path.resolve(__dirname,'..'),files=['data/art/right-walk-v1.json','src/hero-walk-motion.mjs','src/hero-right-walk.mjs','assets/art-calibration/reference-parts-v1.webp'];fs.writeFileSync(path.join(root,'assets/art-calibration/right-walk-raster-v1.json'),JSON.stringify({status:'sampled-browser-pass',scope:'planted boot sole samples in transparent rendered actor layer; diagnostic overlays disabled',artApproval:'pending-user-review',records,hashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]))},null,2)+'\n');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
