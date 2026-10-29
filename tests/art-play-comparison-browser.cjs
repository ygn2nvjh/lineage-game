const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const viewport of [{width:390,height:844},{width:960,height:900}]){
  const p=await b.newPage({viewport,isMobile:viewport.width<500,hasTouch:true}),errors=[],bad=[];let legacyRequests=0,sockets=0;
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push(r.url())});p.on('request',r=>{if(r.url().endsWith('/art/monsters.webp'))legacyRequests++});p.on('websocket',()=>sockets++);
  await p.goto(process.env.ART_PLAY_URL||'http://127.0.0.1:8801/art-play.html');await p.waitForFunction(()=>window.artPlay);
  const state=()=>p.evaluate(()=>window.artPlay.inspect());const before=await state();assert.equal(legacyRequests,0,'old monster atlas loads only on demand');
  await p.locator('#compare').click();await p.waitForFunction(()=>window.artPlay.inspect().comparison.ready);await p.waitForTimeout(100);
  let s=await state(),camera=s.camera;assert.equal(s.mode,'static-art-comparison');assert.equal(s.comparison.actors.length,5);assert.equal(new Set(s.comparison.actors.map(a=>a.y)).size,1);assert.equal(await p.locator('#compareRows tr').count(),5);
  assert.equal(new Set(Object.values(s.comparison.metrics).map(m=>m.down.unit)).size,1,'same scale for all five');
  assert(s.comparison.metrics.spartoi.down.rawFloor>12);assert(s.comparison.metrics.skeleton_fighter.down.rawFloor>12);
  await p.keyboard.press('Space');assert.equal((await state()).autoAttack,before.autoAttack,'static reference must not toggle live combat');
  for(const layout of ['stagger','close','line']){
   await p.locator('[data-compare-layout='+layout+']').click();await p.waitForTimeout(60);s=await state();assert.deepEqual(s.camera,camera,'camera scale and center must remain fixed');
   if(layout!=='line')assert.deepEqual(s.comparison.drawOrder,s.comparison.actors.slice().sort((a,b)=>a.y-b.y).map(a=>a.kind),'shared World must sort the five sprites by foot depth');else assert.deepEqual([...s.comparison.drawOrder].sort(),s.comparison.actors.map(a=>a.kind).sort());
  }
  for(const dir of ['right','up','left','down']){await p.locator('[data-compare-dir='+dir+']').click();await p.waitForTimeout(60);assert.equal((await state()).comparison.dir,dir);}
  for(const id of ['compareGuides','compareShadows','compareLabels','compareAnatomy','compareCollision']){const before=await p.locator('#'+id).getAttribute('aria-pressed');await p.locator('#'+id).click();assert.equal(await p.locator('#'+id).getAttribute('aria-pressed'),before==='true'?'false':'true');await p.locator('#'+id).click();}
  assert.equal(s.comparison.variant,'current');
  await p.locator('[data-compare-dir=right]').click();await p.waitForTimeout(60);
  const revised=await p.locator('#playCanvas').screenshot();
  await p.locator('#compareVersion').click();await p.waitForTimeout(60);assert.equal((await state()).comparison.variant,'previous');
  const original=await p.locator('#playCanvas').screenshot();assert(!original.equals(revised),'local refinements must visibly change image pixels');
  await p.locator('#compareVersion').click();await p.waitForTimeout(60);assert.equal((await state()).comparison.variant,'current');
  await p.locator('#compareAnatomy').click();await p.locator('#compareCollision').click();
  assert.equal((await state()).comparison.anatomy,true);assert.equal((await state()).comparison.collision,true);
  assert.equal(await p.locator('#compareRows tr:first-child td').count(),5);
  assert.equal(await p.locator('#compareRows tr:nth-child(4) td:nth-child(2)').innerText(),'待標記');
  assert.equal(legacyRequests,1);assert.equal((await state()).player.x,before.player.x);assert.equal((await state()).player.hp,before.player.hp);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.locator('[data-compare-dir=right]').click();await p.waitForTimeout(100);
  await p.screenshot({path:'/tmp/art-compare-v7-line-'+viewport.width+'.png',fullPage:true});
  await p.locator('[data-compare-layout=close]').click();await p.waitForTimeout(60);await p.screenshot({path:'/tmp/art-compare-v7-close-'+viewport.width+'.png',fullPage:true});
  await p.locator('#compareBack').click();await p.waitForTimeout(80);assert.equal((await state()).mode,'local-art-sandbox');assert(await p.locator('#dock').isVisible());assert(await p.locator('#playHelp').isVisible());
  await p.keyboard.down('d');await p.waitForTimeout(300);await p.keyboard.up('d');assert((await state()).player.x>before.player.x+20,'original movement must still work after comparison');
  assert.equal(sockets,0);assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);console.log(JSON.stringify({viewport,passed:'five actors, lazy old assets, fixed camera/scale, actual depth order, controls, no mutation, movement restored, no errors'}));await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
