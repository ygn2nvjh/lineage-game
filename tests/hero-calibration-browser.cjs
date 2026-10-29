const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const viewport of [{width:390,height:844},{width:960,height:900}]){
  const p=await b.newPage({viewport,isMobile:viewport.width<500,hasTouch:true,acceptDownloads:true}),errors=[],bad=[];let sockets=0;
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push(r.url());});p.on('websocket',()=>sockets++);
  await p.goto(process.env.HERO_CALIBRATION_URL||'http://127.0.0.1:8802/art-calibration.html');await p.waitForFunction(()=>window.heroCalibration);
  const inspect=()=>p.evaluate(()=>heroCalibration.inspect());
  for(const kind of ['male','female']){await p.locator('[data-kind='+kind+']').click();
   for(const dir of ['down','right','up']){await p.locator('[data-dir='+dir+']').click();assert.equal((await inspect()).referenceDifference,0);
    assert(await p.evaluate(()=>{
     const a=document.getElementById('referenceCanvas').getContext('2d').getImageData(0,0,160,161).data,b=document.getElementById('candidateCanvas').getContext('2d').getImageData(0,0,160,161).data;return a.every((x,i)=>x===b[i]);
    }),'candidate idle must match the fixed reference pixels');
    await p.locator('[data-action=walk]').click();await p.waitForTimeout(210);let s=await inspect();assert.equal(s.action,'walk');assert(s.phase>0);
    await p.locator('#play').click();s=await inspect();assert(!s.playing);const before=s.phase;
    await p.waitForTimeout(130);assert.equal((await inspect()).phase,before);
    await p.locator('#step').click();assert.equal((await inspect()).phase,(before+1)%12);
    await p.locator('[data-action=idle]').click();await p.locator('#play').click();
   }
  }
  for(const id of ['guides','overlay','zoom']){await p.locator('#'+id).click();assert.equal(await p.locator('#'+id).getAttribute('aria-pressed'),'true');}
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'zoom must scroll its own container');
  await p.locator('#zoom').click();await p.locator('#overlay').click();
  const downloadEvent=p.waitForEvent('download');await p.locator('#download').click();const download=await downloadEvent;assert(download.suggestedFilename().endsWith('.png'));await download.saveAs('/tmp/hero-calibration-'+viewport.width+'.png');
  assert.equal((await inspect()).dir,'up','export must restore the selected direction');
  await p.screenshot({path:'/tmp/hero-calibration-page-'+viewport.width+'.png',fullPage:true});
  assert.deepEqual((await inspect()).supportedActions,['idle','walk']);assert((await inspect()).pendingActions.includes('attack'));
  assert.equal(sockets,0);assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);console.log(JSON.stringify({viewport,passed:'fixed idle identity, six views, walk/pause/step, bounded zoom, PNG export, pending actions, no errors or WebSockets'}));await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
