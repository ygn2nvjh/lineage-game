const assert=require('node:assert/strict'),fs=require('node:fs/promises');const{chromium}=require('playwright');
(async()=>{
 const {buildOnline}=await import('../scripts/build-online.mjs'),{createState,Game}=await import('../src/core.mjs'),{adventureCatalog,saveSolo}=await import('../src/online/adventure.mjs');
 const c=adventureCatalog(JSON.parse(await fs.readFile('data/game/catalog.json','utf8'))),g=new Game(c,createState(c,'步行測試','male'));
 g.travel('field');const enemy=g.enemies[0];g.travel('town');g.p.x=380;g.p.y=800;g.goal={x:620,y:800};g.moving=true;enemy.x=420;enemy.y=830;enemy.moving=true;g.enemies=[enemy];
 let html=await buildOnline('',{websocket:true,unified:true});
 // Test-only capture of actual ActorArt.draw input; production exposes no mutable game handle.
 html=html.replace('onlineWorld.render(onlineGame,dt);',`const originalDraw=onlineWorld.art.draw;onlineWorld.art.draw=function(ctx,a,kind,...rest){window.__walkSamples??=[];window.__walkSamples.push({kind,moving:a.moving,phase:a.walkPhase,dir:a.dir});return originalDraw.call(this,ctx,a,kind,...rest);};onlineWorld.render(onlineGame,dt);onlineWorld.art.draw=originalDraw;`);
 let revision=0,timer;const data=()=>({id:'self',player:g.p,solo:saveSolo(g),room:null,paused:false,sequence:0,revision:++revision,events:[]});
 const b=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://localhost:9878/**',route=>{const path=new URL(route.request().url()).pathname;return path==='/play'?route.fulfill({contentType:'text/html',body:html}):path.startsWith('/game-assets/')?route.fulfill({path:'assets/'+path.slice('/game-assets/'.length)}):route.fulfill({status:404,body:''});});
 await p.routeWebSocket('**/play-ws',ws=>{ws.onMessage(raw=>{const m=JSON.parse(raw);ws.send(JSON.stringify({id:m.id,data:m.action==='auth'?{authenticated:true}:m.action==='ping'?{pong:true}:data(),timing:{}}));});timer=setInterval(()=>{g.p.x+=6;enemy.x+=4;ws.send(JSON.stringify({push:true,data:data()}));},100);});
 await p.goto('http://localhost:9878/play');await p.waitForFunction(()=>window.lineageOnline?.inspect().state?.player);await p.waitForTimeout(2400);
 const samples=await p.evaluate(()=>window.__walkSamples),frames=kind=>new Set(samples.filter(a=>a.kind===kind&&a.moving).map(a=>Math.floor(a.phase*6)));
 assert.equal(frames('male').size,6,'player should render all six lateral walking frames across prediction/snapshots');
 const monsterKind=c.monsterAppearances.find(a=>a.id===g.index.monsters.get(enemy.monsterId).appearanceId)?.id||'skeleton';assert.equal(frames(monsterKind).size,6,'monster should render all six lateral walking frames across snapshots');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:'actual renderer preserves all six player and monster lateral frames across 100ms replacement snapshots',playerFrames:[...frames('male')].sort(),monsterFrames:[...frames(monsterKind)].sort(),errors}));
 }finally{clearInterval(timer);await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
