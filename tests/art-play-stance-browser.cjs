const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.ART_PLAY_URL||'http://127.0.0.1:8801/art-play.html');await p.waitForFunction(()=>window.artPlay);
  for(const sex of ['female','male']){
   if(sex==='male')await p.locator('#sex').click();
   await p.keyboard.down('d');await p.waitForTimeout(570);await p.keyboard.up('d');
   const stopped=await p.evaluate(()=>window.artPlay.inspect().player.x);await p.waitForTimeout(220);
   const s=await p.evaluate(()=>window.artPlay.inspect());assert(Math.abs(s.player.x-stopped)<.001,'visual settling must not move the actual character');
   assert(s.frames[sex].filter(k=>k.startsWith('settle:right:')).length>=2,'both visual settling stages must render');
   assert.equal(s.playerVisual.moving,false);assert.equal(s.playerVisual.dir,'right');
   const feet=await p.evaluate(sex=>window.ART_PLAY_META[sex].frames['idle:right'].feet,sex);assert.equal(feet.length,2);
   await p.screenshot({path:'/tmp/art-play-idle-'+sex+'-v4.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);console.log('Female and male settle visually without position drift; both idle feet remain distinct; zero page errors.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
