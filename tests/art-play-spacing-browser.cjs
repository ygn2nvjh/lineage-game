const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(process.env.ART_PLAY_URL||'http://127.0.0.1:8801/art-play.html');await p.waitForFunction(()=>window.artPlay);
  const samples={};
  for(const sex of ['female','male']){
   if(sex==='male')await p.locator('#sex').click();
   await p.keyboard.down('d');await p.waitForTimeout(200);
   samples[sex]=await p.evaluate(async()=>{
    const heads=[],ground=[];
    for(let i=0;i<60;i++){
     await new Promise(requestAnimationFrame);
     const s=window.artPlay.inspect(),canvas=document.getElementById('playCanvas'),c=canvas.getContext('2d'),scale=canvas.width/s.width;
     const read=(x,y,w,h)=>Array.from(c.getImageData(Math.round(x*scale),Math.round(y*scale),Math.round(w*scale),Math.round(h*scale)).data).join(',');
     heads.push(read(Math.round(s.player.x)-Math.round(s.camera.x)-5,Math.round(s.player.y)-Math.round(s.camera.y)-101,10,6));
     ground.push(read(650-Math.round(s.camera.x),1000-Math.round(s.camera.y),12,12));
    }
    return {headUnique:new Set(heads).size,groundUnique:new Set(ground).size,samples:heads.length};
   });
   await p.keyboard.up('d');assert.equal(samples[sex].headUnique,1,sex+' head must remain stable');assert.equal(samples[sex].groundUnique,1,'same terrain must remain stable');
  }
  await p.waitForTimeout(100);let s=await p.evaluate(()=>window.artPlay.inspect());
  assert.equal(s.diagnostics.version,'art-play-0.7');assert.equal(s.playerVisual.dir,'right');assert.equal(s.combatRange,70);assert.equal(s.bodySeparation,56);
  await p.locator('#bounds').click();await p.locator('#attack').click();
  await p.waitForFunction(()=>window.artPlay.inspect().events.includes('damage'),null,{timeout:15000});await p.waitForTimeout(2500);
  s=await p.evaluate(()=>window.artPlay.inspect());assert(s.diagnostics.minimumActorDistance>=55.99);assert.notEqual(s.playerVisual.dir,'up');
  await p.screenshot({path:'/tmp/art-play-spacing-v6.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:'both characters stable during gait, stable terrain, right-facing idle, body separation and real male combat',samples,minimumActorDistance:s.diagnostics.minimumActorDistance,errors}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
